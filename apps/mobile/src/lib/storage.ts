/**
 * AsyncStorage wrapper — typed JSON get/set/remove for the auth tokens.
 *
 * Thin on purpose: the only thing we persist in v1 is the JWT pair.
 * Anything bigger (drafts, cached feeds) graduates to a real store later.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt entry — clear it so the next write is clean.
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export const STORAGE_KEYS = {
  tokens: "@crowdshipping/tokens",
  user: "@crowdshipping/user",
  pushEnabled: "@crowdshipping/push-enabled",
  pushToken: "@crowdshipping/push-token",
} as const;

// ── GET cache helpers ───────────────────────────────────────────────

const CACHE_PREFIX = "@crowdshipping/cache:";
const MAX_CACHE_ENTRIES = 20;

export interface CacheEntry {
  data: string;
  cachedAt: number;
}

/** Read a cached GET response by key. */
export async function readCache(key: string): Promise<CacheEntry | null> {
  return loadJSON<CacheEntry>(CACHE_PREFIX + key);
}

/** Write a cached GET response. Evicts oldest entry if at capacity. */
export async function writeCache(key: string, entry: CacheEntry): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));

  if (cacheKeys.length >= MAX_CACHE_ENTRIES && !cacheKeys.includes(CACHE_PREFIX + key)) {
    // Evict the oldest entry — read all, sort by cachedAt, remove the oldest.
    const entries: [string, CacheEntry][] = [];
    for (const ck of cacheKeys) {
      const val = await loadJSON<CacheEntry>(ck);
      if (val) entries.push([ck, val]);
    }
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    if (entries.length > 0) {
      await AsyncStorage.removeItem(entries[0][0]);
    }
  }

  await saveJSON(CACHE_PREFIX + key, entry);
}

/** Clear all cached GET responses. */
export async function clearCache(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}
