/**
 * Chat API — REST persistence for parcel-threaded chat over /chat.
 *
 * Mirrors packages/api/src/routes/chat.ts. Live delivery is Socket.IO
 * (see socket.ts); this module owns the durable layer: inbox, paginated
 * history, send (which also broadcasts server-side), and read-state.
 *
 * The messages endpoint returns oldest-first so the list can be prepended
 * directly; cursor pagination walks backward via `before`.
 */
import { apiFetch } from "./api";
import type { ParcelStatus, TrustBadge } from "./types";

export interface ChatThread {
  parcelId: string;
  description: string;
  status: ParcelStatus;
  counterparty: { id: string; firstName: string; trustBadge?: TrustBadge | null };
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  parcelId: string;
  senderId: string;
  body: string;
  attachments?: string[];
  createdAt: string;
  readAt?: string | null;
}

export function listThreads(): Promise<{ threads: ChatThread[] }> {
  return apiFetch("/chat/threads");
}

export function getHistory(
  parcelId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<{ messages: ChatMessage[]; cursor: string | null }> {
  const sp = new URLSearchParams();
  if (opts.before) sp.set("before", opts.before);
  if (opts.limit) sp.set("limit", String(opts.limit));
  return apiFetch(`/chat/${parcelId}?${sp.toString()}`);
}

export function sendMessage(
  parcelId: string,
  body: string,
  attachments: string[] = [],
): Promise<{ message: ChatMessage }> {
  return apiFetch(`/chat/${parcelId}`, {
    method: "POST",
    body: { body, attachments },
  });
}

export function markRead(parcelId: string): Promise<{ markedRead: number }> {
  return apiFetch(`/chat/${parcelId}/read`, { method: "POST" });
}
