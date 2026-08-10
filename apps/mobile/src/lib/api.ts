/**
 * API client — fetch wrapper with JWT attach + transparent refresh.
 *
 * Every authenticated screen calls `apiFetch`. The wrapper:
 *   1. Attaches `Authorization: Bearer <accessToken>` (read from the auth
 *      store getter so it's always current).
 *   2. On 401, attempts ONE `/auth/refresh` using the stored refresh token,
 *      retries the original request, and on failure clears auth (the root
 *      layout's AuthGate then redirects to login).
 *
 * Base URL comes from `EXPO_PUBLIC_API_URL` (Expo's public-env convention —
 * inlined at build time, no runtime secrets). One constant, no hardcoded
 * host, so dev/prod/CI each point at their own backend.
 */
import Constants from "expo-constants";

// expo's public env: must be prefixed EXPO_PUBLIC_, inlined at build.
// Prefer EXPO_PUBLIC_* (works with a plain app.json, overrideable per env);
// fall back to the app.json `extra` block, then localhost for dev.
const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; twilioVerifySid?: string }
  | undefined;
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? "http://localhost:4000";

/**
 * Whether the backend is running in dev OTP mode (TWILIO_VERIFY_SERVICE_SID
 * unset → accepts "000000"). Read from build-time env so it tree-shakes
 * out in production builds.
 */
export function isDevOtpMode(): boolean {
  return !extra?.twilioVerifySid;
}

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

/** Tokens are managed by the zustand store; the client reads via a getter. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

let getTokens: () => AuthTokens | null = () => null;
let onRefresh: ((t: AuthTokens) => Promise<void>) | null = null;
let onAuthFailed: (() => Promise<void>) | null = null;
let refreshing: Promise<AuthTokens | null> | null = null;

/**
 * Wire the client to the auth store. Called once at app boot from the
 * store's init(). Avoids a circular import (store ↔ client).
 */
export function configureAuth(config: {
  getTokens: () => AuthTokens | null;
  onRefresh: (tokens: AuthTokens) => Promise<void>;
  onAuthFailed: () => Promise<void>;
}) {
  getTokens = config.getTokens;
  onRefresh = config.onRefresh;
  onAuthFailed = config.onAuthFailed;
}

async function refreshTokens(): Promise<AuthTokens | null> {
  if (refreshing) return refreshing; // dedupe concurrent refresh attempts
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;

  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      const next: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: tokens.refreshToken, // refresh token isn't rotated in v1
      };
      await onRefresh?.(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip auth header (for /auth/* endpoints that don't want it). */
  noAuth?: boolean;
  /** Skip the 401 auto-refresh (used by the refresh call itself). */
  noRefresh?: boolean;
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, noAuth, noRefresh } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tokens = getTokens();
  if (!noAuth && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const doFetch = (auth: AuthTokens | null) =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...headers,
        ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(tokens);

  // 401 → try one refresh, then retry. Don't recurse.
  if (res.status === 401 && !noRefresh && tokens?.refreshToken) {
    const next = await refreshTokens();
    if (next) {
      res = await doFetch(next);
    } else {
      await onAuthFailed?.(); // clear auth; AuthGate redirects to login
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      /* non-JSON error */
    }
    const message =
      (errBody && typeof errBody === "object" && "error" in errBody
        ? String((errBody as { error: unknown }).error)
        : res.statusText) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, errBody);
  }

  // 204 / empty bodies shouldn't break JSON parsing.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
