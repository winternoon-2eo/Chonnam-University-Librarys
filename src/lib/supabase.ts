export interface CurateCacheItem {
  query: string;
  intent: 'beginner' | 'practical';
  data: any;
  cachedAt: number;
}

export interface PushSubscriber {
  id?: string;
  isbn: string;
  bookTitle: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

// In-Memory Fallback Cache for local dev & 0-config operation
const memoryCache = new Map<string, CurateCacheItem>();
const memorySubscribers: PushSubscriber[] = [];

/**
 * Look up 2-tier cache for pre-computed or recent searches
 */
export async function getCachedCurateResult(
  query: string,
  intent: 'beginner' | 'practical',
  campus = 'gwangju'
): Promise<any | null> {
  const cacheKey = `${query.trim().toLowerCase()}_${intent}_${campus}`;
  const hit = memoryCache.get(cacheKey);

  if (hit) {
    // 24-hour cache expiry
    const isExpired = Date.now() - hit.cachedAt > 24 * 60 * 60 * 1000;
    if (!isExpired) {
      return hit.data;
    }
    memoryCache.delete(cacheKey);
  }

  // If Supabase credentials exist, try querying Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/books_cache?query_key=eq.${encodeURIComponent(cacheKey)}&select=*`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const cachedRow = rows[0];
          memoryCache.set(cacheKey, {
            query,
            intent,
            data: cachedRow.data,
            cachedAt: new Date(cachedRow.updated_at).getTime(),
          });
          return cachedRow.data;
        }
      }
    } catch (err) {
      console.warn('[Supabase Cache] Query failed, using local cache:', err);
    }
  }

  return null;
}

/**
 * Store curated results in cache
 */
export async function setCachedCurateResult(
  query: string,
  intent: 'beginner' | 'practical',
  data: any,
  campus = 'gwangju'
): Promise<void> {
  const cacheKey = `${query.trim().toLowerCase()}_${intent}_${campus}`;
  memoryCache.set(cacheKey, {
    query,
    intent,
    data,
    cachedAt: Date.now(),
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/books_cache`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          query_key: cacheKey,
          query,
          intent,
          recommended_titles: (data || []).map((b: any) => b.title),
          data,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('[Supabase Cache] Upsert failed:', err);
    }
  }
}

export interface SearchLogItem {
  id?: string;
  query: string;
  intent: 'beginner' | 'practical';
  campus: string;
  recommended_titles: string[];
  created_at?: string;
}

const memorySearchLogs: SearchLogItem[] = [];

/**
 * Record user search query and the 5 recommended book titles to Supabase & memory
 */
export async function recordSearchLog(
  query: string,
  intent: 'beginner' | 'practical',
  campus: string,
  books: { title: string }[]
): Promise<void> {
  const titles = (books || []).map((b) => b.title).filter(Boolean);
  const logItem: SearchLogItem = {
    query: query.trim(),
    intent,
    campus,
    recommended_titles: titles,
    created_at: new Date().toISOString(),
  };

  // 1. In-memory log (for 0-config dev)
  memorySearchLogs.push(logItem);
  if (memorySearchLogs.length > 500) memorySearchLogs.shift();

  // 2. Supabase persistent table: `search_logs`
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/search_logs`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: logItem.query,
          intent: logItem.intent,
          campus: logItem.campus,
          recommended_titles: logItem.recommended_titles,
          created_at: logItem.created_at,
        }),
      });
    } catch (err) {
      console.warn('[Supabase SearchLog] Failed saving search log:', err);
    }
  }
}

/**
 * Retrieve recent search logs (from Supabase or memory)
 */
export async function getRecentSearchLogs(limit = 50): Promise<SearchLogItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/search_logs?select=*&order=created_at.desc&limit=${limit}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[Supabase SearchLog] Fetch logs failed, falling back to memory:', err);
    }
  }

  return [...memorySearchLogs].reverse().slice(0, limit);
}

/**
 * Register a user push subscription for a checked-out book
 */
export async function registerPushSubscriber(sub: PushSubscriber): Promise<boolean> {
  memorySubscribers.push(sub);
  console.log(`[Push Notification] Registered subscriber for ${sub.bookTitle} (${sub.isbn})`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/push_subscribers`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sub),
      });
      return res.ok;
    } catch (err) {
      console.warn('[Supabase Push] Registration failed:', err);
    }
  }

  return true;
}

/**
 * Retrieve subscribers for an ISBN when book is returned
 */
export async function getSubscribersForIsbn(isbn: string): Promise<PushSubscriber[]> {
  const localMatches = memorySubscribers.filter((s) => s.isbn === isbn);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/push_subscribers?isbn=eq.${encodeURIComponent(isbn)}&select=*`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[Supabase Push] Fetch subscribers failed:', err);
    }
  }

  return localMatches;
}
