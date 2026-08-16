/**
 * API client — fetch wrapper with JWT attach, transparent refresh,
 * stale GET cache, and offline mutation queue.
 *
 * Every authenticated screen calls `apiFetch`. The wrapper:
 *   1. Attaches `Authorization: Bearer <accessToken>` (read from the auth
 *      store getter so it's always current).
 *   2. On 401, attempts ONE `/auth/refresh` using the stored refresh token,
 *      retries the original request, and on failure clears auth (the root
 *      layout's AuthGate then redirects to login).
 *   3. GET requests: caches successful responses in AsyncStorage; on failure
 *      returns stale cache if available (within TTL).
 *   4. POST/PATCH/DELETE requests: when offline, enqueues the request to
 *      the mutation queue instead of sending it (unless noQueue is set).
 *
 * Base URL comes from `EXPO_PUBLIC_API_URL` (Expo's public-env convention —
 * inlined at build time, no runtime secrets). One constant, no hardcoded
 * host, so dev/prod/CI each point at their own backend.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

// expo's public env: must be prefixed EXPO_PUBLIC_, inlined at build.
// Prefer EXPO_PUBLIC_* (works with a plain app.json, overrideable per env);
// fall back to the app.json `extra` block, then localhost for dev.
const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; twilioVerifySid?: string; stripePublishableKey?: string }
  | undefined;
const configuredUrl = process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl;

// The Android emulator is its own network namespace — "localhost" there
// resolves to the emulator device itself, not the host machine running the
// API, and connections fail outright. 10.0.2.2 is the emulator's standing
// alias for the host loopback (iOS simulator and web don't need this: they
// share the host's network stack, so plain localhost already works there).
// Only rewrite the default we fall back to ourselves — an explicitly
// configured EXPO_PUBLIC_API_URL/app.json value (e.g. a LAN IP for physical
// devices) is left untouched.
const DEV_DEFAULT =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

export const BASE_URL = configuredUrl ?? DEV_DEFAULT;

/** Stripe publishable key — safe to embed in the client (designed to be public). */
export const STRIPE_PK =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  extra?.stripePublishableKey ??
  "";

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

/**
 * Thrown when a mutation is enqueued instead of sent because the device
 * is offline. Screens can catch this for optimistic UI updates.
 */
export class OfflineQueuedError extends Error {
  constructor(message = "Action enqueued — will send on reconnect") {
    super(message);
    this.name = "OfflineQueuedError";
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

// ── GET cache (AsyncStorage-backed) ─────────────────────────────────

import { readCache, writeCache } from "./storage";
import { isOfflineSync } from "./network";
import { enqueue, type QueueEntry } from "./mutation-queue";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip auth header (for /auth/* endpoints that don't want it). */
  noAuth?: boolean;
  /** Skip the 401 auto-refresh (used by the refresh call itself). */
  noRefresh?: boolean;
  /** Skip GET cache read/write. */
  noCache?: boolean;
  /** Skip mutation queue — send immediately even when offline (Stripe, uploads, auth). */
  noQueue?: boolean;
  /** Client-generated idempotency key (UUID). Sent as Idempotency-Key header. */
  idempotencyKey?: string;
}

function cacheKey(path: string, body: unknown): string {
  const suffix = body ? `:${JSON.stringify(body)}` : "";
  return `GET:${path}${suffix}`;
}

async function readCachedResponse(path: string, body: unknown): Promise<unknown | null> {
  const key = cacheKey(path, body);
  const entry = await readCache(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  try {
    return JSON.parse(entry.data);
  } catch {
    return null;
  }
}

async function writeCachedResponse(path: string, body: unknown, data: unknown): Promise<void> {
  const key = cacheKey(path, body);
  await writeCache(key, {
    data: JSON.stringify(data),
    cachedAt: Date.now(),
  });
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, noAuth, noRefresh, noCache, noQueue, idempotencyKey } = opts;

  // ── Mutation queue: enqueue if offline (unless opted out) ─────────
  if (method !== "GET" && !noQueue && isOfflineSync()) {
    if (!idempotencyKey) {
      // Generate a UUID using crypto.randomUUID (available in Expo 52+).
      const key = crypto.randomUUID();
      const entry: QueueEntry = {
        id: key,
        path,
        method,
        body,
        idempotencyKey: key,
        createdAt: Date.now(),
        retries: 0,
      };
      await enqueue(entry);
      throw new OfflineQueuedError();
    } else {
      const entry: QueueEntry = {
        id: idempotencyKey,
        path,
        method,
        body,
        idempotencyKey,
        createdAt: Date.now(),
        retries: 0,
      };
      await enqueue(entry);
      throw new OfflineQueuedError();
    }
  }

  // Only set Content-Type when there's a body: Fastify's JSON body parser
  // rejects an empty body sent with 'application/json' (FST_ERR_CTP_EMPTY_JSON_BODY),
  // which every bodyless POST (escrow fund/release, parcel lifecycle, chat read) hits otherwise.
  const headers: Record<string, string> = body !== undefined ? { "Content-Type": "application/json" } : {};
  const tokens = getTokens();
  if (!noAuth && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
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

  let res: Response;

  try {
    res = await doFetch(tokens);
  } catch (fetchErr) {
    // Network-level failure (no response at all).
    if (method === "GET" && !noCache) {
      const stale = await readCachedResponse(path, body);
      if (stale) {
        console.warn(`[api] Returning stale cache for GET ${path}`);
        return stale as T;
      }
    }
    throw fetchErr;
  }

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
    // For GET requests, try stale cache on server errors too.
    if (method === "GET" && !noCache && res.status >= 500) {
      const stale = await readCachedResponse(path, body);
      if (stale) {
        console.warn(`[api] Returning stale cache for GET ${path} (server error ${res.status})`);
        return stale as T;
      }
    }

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
  const parsed = (text ? JSON.parse(text) : null) as T;

  // Cache successful GET responses.
  if (method === "GET" && !noCache && parsed !== null) {
    writeCachedResponse(path, body, parsed).catch(() => {
      /* best-effort; non-fatal */
    });
  }

  return parsed;
}
