/**
 * Mutation queue — AsyncStorage-persisted FIFO for offline mutations.
 *
 * When the device is offline and a POST/PATCH/DELETE request is made,
 * the caller enqueues the request instead of sending it. On reconnect,
 * the queue flushes sequentially, each request carrying the original
 * idempotency key so the server deduplicates.
 *
 * Storage key: @crowdshipping/queue  (JSON array of QueueEntry).
 * Max entries: 50. Max retries per entry: 3.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

const QUEUE_KEY = "@crowdshipping/queue";
const MAX_QUEUE_SIZE = 50;
const MAX_RETRIES = 3;

export interface QueueEntry {
  id: string;
  path: string;
  method: string;
  body: unknown;
  idempotencyKey: string;
  createdAt: number;
  retries: number;
}

let _pendingCount = 0;
let _isFlushing = false;
const countListeners = new Set<() => void>();

function notifyCountListeners() {
  for (const cb of countListeners) cb();
}

export function subscribeCount(cb: () => void): () => void {
  countListeners.add(cb);
  return () => countListeners.delete(cb);
}

export async function queueSize(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;
    const entries: QueueEntry[] = JSON.parse(raw);
    _pendingCount = entries.length;
    return entries.length;
  } catch {
    return 0;
  }
}

export function getPendingCount(): number {
  return _pendingCount;
}

export function getIsFlushing(): boolean {
  return _isFlushing;
}

export async function enqueue(entry: QueueEntry): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const entries: QueueEntry[] = raw ? JSON.parse(raw) : [];

  if (entries.length >= MAX_QUEUE_SIZE) {
    throw new Error("La file d'attente est pleine — attendez la connexion.");
  }

  entries.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  _pendingCount = entries.length;
  notifyCountListeners();
}

async function loadQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(entries: QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  _pendingCount = entries.length;
  notifyCountListeners();
}

/**
 * Flush all queued mutations sequentially.
 *
 * Stops at the first network error (will retry on next reconnect).
 * Removes entries that get a 4xx response (client error = never gonna work).
 */
export async function flushQueue(): Promise<void> {
  if (_isFlushing) return;
  _isFlushing = true;
  notifyCountListeners();

  try {
    let entries = await loadQueue();
    while (entries.length > 0) {
      const entry = entries[0];

      try {
        await apiFetch(entry.path, {
          method: entry.method as "POST" | "PATCH" | "DELETE",
          body: entry.body as Record<string, unknown> | undefined,
          noQueue: true,
          idempotencyKey: entry.idempotencyKey,
        });

        // Success — remove the entry.
        entries = entries.slice(1);
        entry.retries = 0;
        await saveQueue(entries);
      } catch (e: unknown) {
        const status =
          e && typeof e === "object" && "status" in e
            ? (e as { status: number }).status
            : undefined;

        if (status && status >= 400 && status < 500) {
          // Client error — remove this entry, it'll never succeed.
          console.warn(`[queue] Dropping entry ${entry.id}: client error ${status}`);
          entries = entries.slice(1);
          await saveQueue(entries);
          continue;
        }

        // Network error or 5xx — stop flushing, will retry later.
        entry.retries += 1;
        if (entry.retries >= MAX_RETRIES) {
          console.warn(`[queue] Dropping entry ${entry.id}: max retries exceeded`);
          entries = entries.slice(1);
          await saveQueue(entries);
          continue;
        }
        entries[0] = entry;
        await saveQueue(entries);
        console.warn(`[queue] Flush paused at entry ${entry.id}: will retry on reconnect`);
        break;
      }
    }
  } finally {
    _isFlushing = false;
    notifyCountListeners();
  }
}
