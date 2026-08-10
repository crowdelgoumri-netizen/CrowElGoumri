/**
 * Socket.IO client — singleton realtime connection for live chat.
 *
 * Matches packages/api/src/plugins/realtime.ts exactly:
 *   - same host/port as the HTTP API (BASE_URL), default /socket.io path
 *   - auth handshake: io({ auth: { token } }) with the JWT access token
 *   - rooms are server-authorized: emit `thread:join { parcelId }` → ack
 *     { ok: true } or { ok:false, error, status }; the server joins us to
 *     room `parcel:<id>` only after verifying we're a participant
 *
 * Server→client events we listen for:
 *   - chat:message  { id, parcelId, senderId, body, attachments, createdAt }
 *   - chat:read     { parcelId, userId, at }
 *
 * The connection is wired from the root layout on auth state changes (connect
 * on login, disconnect on logout) so screens just subscribe via `on()`.
 */
import { io, type Socket } from "socket.io-client";
import { BASE_URL } from "./api";

type AckResult = { ok: true } | { ok: false; error: string; status: number };

let socket: Socket | null = null;

/** Connect (or reconnect) with the given access token. No-op if already live. */
export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;
  // Tear down any half-open instance from a prior session before reconnecting.
  if (socket) socket.removeAllListeners(), socket.disconnect();

  socket = io(BASE_URL, {
    auth: { token: accessToken },
    transports: ["websocket"],
    // The HTTP client retries/refreshes on 401; for the socket, a dropped
    // connection just reconnects (the next token is passed on reconnect via
    // the auth function below if we ever rotate it).
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function isSocketConnected(): boolean {
  return !!socket?.connected;
}

/** Subscribe to a server→client event. Returns an unsubscribe fn. */
export function onSocketEvent<T = unknown>(
  event: "chat:message" | "chat:read" | "connect" | "disconnect",
  handler: (payload: T) => void,
): () => void {
  if (!socket) return () => {};
  socket.on(event, handler as (...args: unknown[]) => void);
  return () => {
    socket?.off(event, handler as (...args: unknown[]) => void);
  };
}

/**
 * Join a parcel's chat room. Resolves true on the server's { ok: true } ack,
 * false otherwise (403 = not a participant, 400 = bad payload). The promise
 * rejects only if no socket is connected.
 */
export function joinThread(parcelId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Socket not connected"));
    socket.emit("thread:join", { parcelId }, (ack: AckResult) => {
      resolve(!!ack?.ok);
    });
  });
}

export function leaveThread(parcelId: string): void {
  socket?.emit("thread:leave", { parcelId });
}
