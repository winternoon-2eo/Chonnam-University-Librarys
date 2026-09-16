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
          data,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('[Supabase Cache] Upsert failed:', err);
    }
  }
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
