/**
 * Gemini Multi-Model Pool Orchestrator (Option B: Non-Lite First + Lite Backup)
 * 
 * Aggregates multiple Gemini Flash models:
 * - Priority 1: gemini-3.6-flash (Non-Lite, high quality flagship)
 * - Priority 2: gemini-3-flash-preview (Non-Lite, high capacity backup)
 * - Priority 3: gemini-3.1-flash-lite (Lite, ultra-fast peak surge buffer)
 * - Priority 4: gemini-flash-lite-latest (Lite, peak surge buffer)
 * 
 * Total capacity: ~55 requests/minute without hitting 429 Rate Limit errors.
 */

export interface GeminiPoolModelConfig {
  name: string;
  maxRpm: number;
  priority: number; // Lower number = higher priority
  isLite: boolean;
}

// Option B: Non-Lite models have highest priority; Lite models absorb peak traffic
export const POOL_MODELS: GeminiPoolModelConfig[] = [
  { name: 'gemini-3.6-flash', maxRpm: 10, priority: 1, isLite: false },
  { name: 'gemini-3-flash-preview', maxRpm: 15, priority: 2, isLite: false },
  { name: 'gemini-3.1-flash-lite', maxRpm: 15, priority: 3, isLite: true },
  { name: 'gemini-flash-lite-latest', maxRpm: 15, priority: 4, isLite: true },
];

interface ModelHealthState {
  recentTimestamps: number[]; // Epoch ms of requests in the last 60 seconds
  cooldownUntil: number;      // Timestamp until which this model is in cooldown
  consecutiveErrors: number;
}

const modelStates = new Map<string, ModelHealthState>();

// Initialize states
for (const m of POOL_MODELS) {
  modelStates.set(m.name, {
    recentTimestamps: [],
    cooldownUntil: 0,
    consecutiveErrors: 0,
  });
}

/**
 * Prune timestamps older than 60s and return current RPM usage
 */
export function getActiveRpmUsage(state: ModelHealthState, now: number): number {
  state.recentTimestamps = state.recentTimestamps.filter((t) => now - t < 60000);
  return state.recentTimestamps.length;
}

export interface GeminiCallResponse {
  ok: boolean;
  text?: string;
  modelUsed?: string;
  isLite?: boolean;
  error?: string;
}

/**
 * Call Gemini API using Option B multi-model load balancing and instant failover
 */
export async function callGeminiWithPool(
  prompt: string,
  options: {
    temperature?: number;
    responseMimeType?: 'application/json' | 'text/plain';
    timeoutMs?: number;
  } = {}
): Promise<GeminiCallResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY is not set' };
  }

  const timeoutMs = options.timeoutMs || 8000;
  const triedModels = new Set<string>();
  const maxAttempts = POOL_MODELS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    // Filter out models already tried in this call
    const candidates = POOL_MODELS.filter((m) => !triedModels.has(m.name));
    if (candidates.length === 0) break;

    // Option B Candidate selection:
    // 1. Healthy (not in cooldown)
    // 2. Under maxRpm limit
    // 3. Lower priority number (Non-Lite first)
    const chosen = candidates
      .slice()
      .sort((a, b) => {
        const stateA = modelStates.get(a.name)!;
        const stateB = modelStates.get(b.name)!;
        const isCoolA = stateA.cooldownUntil > now ? 1 : 0;
        const isCoolB = stateB.cooldownUntil > now ? 1 : 0;
        if (isCoolA !== isCoolB) return isCoolA - isCoolB;

        const usageA = getActiveRpmUsage(stateA, now);
        const usageB = getActiveRpmUsage(stateB, now);
        const isFullA = usageA >= a.maxRpm ? 1 : 0;
        const isFullB = usageB >= b.maxRpm ? 1 : 0;
        if (isFullA !== isFullB) return isFullA - isFullB;

        // Non-Lite priority first, then lowest usage
        return a.priority - b.priority || usageA - usageB;
      })[0];

    triedModels.add(chosen.name);
    const state = modelStates.get(chosen.name)!;
    state.recentTimestamps.push(now);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosen.name}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            responseMimeType: options.responseMimeType ?? 'application/json',
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          state.consecutiveErrors = 0;
          state.cooldownUntil = 0;
          return { ok: true, text, modelUsed: chosen.name, isLite: chosen.isLite };
        }
      }

      // Handle 429 Rate Limit or 503 Overloaded
      if (res.status === 429 || res.status === 503) {
        state.consecutiveErrors++;
        const cooldownMs = res.status === 429 ? 40000 : 15000;
        state.cooldownUntil = Date.now() + cooldownMs;
        console.warn(`[GeminiPool] Model ${chosen.name} (${chosen.isLite ? 'Lite' : 'Non-Lite'}) returned ${res.status}. Cooling down ${cooldownMs / 1000}s. Failing over...`);
        continue; // Try next model immediately
      }

      const errJson = await res.json().catch(() => ({}));
      console.warn(`[GeminiPool] Model ${chosen.name} failed with status ${res.status}:`, errJson);
    } catch (err: any) {
      console.warn(`[GeminiPool] Request to ${chosen.name} threw error: ${err.message}. Failing over...`);
      state.consecutiveErrors++;
      state.cooldownUntil = Date.now() + 10000;
    }
  }

  return { ok: false, error: 'All Gemini models in pool exhausted or cooling down' };
}

/**
 * Diagnostic status function for monitoring and tests
 */
export function getGeminiPoolStatus(): Record<string, { rpm: number; maxRpm: number; inCooldown: boolean; isLite: boolean }> {
  const now = Date.now();
  const result: Record<string, { rpm: number; maxRpm: number; inCooldown: boolean; isLite: boolean }> = {};
  for (const m of POOL_MODELS) {
    const state = modelStates.get(m.name)!;
    result[m.name] = {
      rpm: getActiveRpmUsage(state, now),
      maxRpm: m.maxRpm,
      inCooldown: state.cooldownUntil > now,
      isLite: m.isLite,
    };
  }
  return result;
}
