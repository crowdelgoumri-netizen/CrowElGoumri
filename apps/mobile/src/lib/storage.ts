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
} as const;
