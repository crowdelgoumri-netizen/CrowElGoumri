/**
 * Network state + reconnect event emitter.
 *
 * Provides a synchronous offline check for the mutation queue (non-hook
 * callers) and a reconnect event emitter so the queue flushes on reconnect.
 *
 * The useIsOffline hook calls setIsOffline() + emitReconnect() on NetInfo
 * transitions. Everything else reads the cached boolean here.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

let _isOffline = true;

/** Cached latest connectivity — callable from any context (no React). */
export function isOfflineSync(): boolean {
  return _isOffline;
}

/** Called by useIsOffline on NetInfo state changes. Returns previous value. */
export function setIsOffline(value: boolean): boolean {
  const prev = _isOffline;
  _isOffline = value;
  return prev;
}

export function subscribeReconnect(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitReconnect(): void {
  for (const cb of listeners) cb();
}
