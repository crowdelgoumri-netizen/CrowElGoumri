/**
 * Notifications API — the bell-icon surface over /notifications.
 *
 * Mirrors packages/api/src/routes/notifications.ts. The notify() helper
 * creates rows whenever a lifecycle event fires (match, escrow funded,
 * delivered, chat…); these routes are the read/management layer plus
 * device-token registration that makes Expo push actually deliver.
 */
import { apiFetch } from "./api";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface ListNotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  cursor: string | null;
}

export function listNotifications(
  opts: { unreadOnly?: boolean; limit?: number; before?: string } = {},
): Promise<ListNotificationsResponse> {
  const sp = new URLSearchParams();
  if (opts.unreadOnly) sp.set("unreadOnly", "true");
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.before) sp.set("before", opts.before);
  return apiFetch(`/notifications?${sp.toString()}`);
}

/** Mark all read (no id) or a single notification read (with id). */
export function markRead(id?: string): Promise<{ markedRead: number }> {
  return apiFetch("/notifications/read", { method: "POST", body: id ? { id } : {} });
}

/** Register an Expo push token so the server can target this device. */
export function registerDeviceToken(token: string): Promise<{ registered: true }> {
  return apiFetch("/notifications/device-token", { method: "POST", body: { token } });
}

export function unregisterDeviceToken(token: string): Promise<{ unregistered: true }> {
  return apiFetch("/notifications/device-token", { method: "DELETE", body: { token } });
}
