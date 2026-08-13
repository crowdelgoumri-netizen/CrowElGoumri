/**
 * API client — fetch wrapper with JWT attach for the admin dashboard.
 *
 * No refresh-token flow (see design spec): a 401 clears the stored
 * session and the next AuthGate check redirects to /login.
 */
import { clearToken, getToken } from "./storage";

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip attaching the Authorization header (used by /auth/login itself). */
  noAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, noAuth } = opts;
  // Only set Content-Type when there's a body: this backend's Fastify JSON
  // parser rejects an empty body sent with 'application/json'.
  const headers: Record<string, string> =
    body !== undefined ? { "Content-Type": "application/json" } : {};

  if (!noAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const message =
      (errBody && typeof errBody === "object" && "error" in errBody
        ? String((errBody as { error: unknown }).error)
        : res.statusText) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, errBody);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
