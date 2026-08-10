/**
 * Auth store (zustand) — single source of truth for session state.
 *
 * Holds the JWT pair + user, persists to AsyncStorage, and wires the API
 * client's auth callbacks so the refresh-on-401 loop closes back here.
 *
 * The root layout calls `init()` once at boot to hydrate from storage;
 * screens subscribe via `useAuth()` and the AuthGate redirects based on
 * `isAuthenticated`.
 */
import { create } from "zustand";
import { configureAuth, type AuthTokens } from "../lib/api";
import * as authApi from "../lib/auth";
import { loadJSON, saveJSON, remove, STORAGE_KEYS } from "../lib/storage";

interface PersistedSession {
  tokens: AuthTokens;
  user: authApi.Me | null;
}

interface AuthState {
  user: authApi.Me | null;
  tokens: AuthTokens | null;
  hydrated: boolean; // has init() finished reading storage?
  init: () => Promise<void>;
  setSession: (tokens: AuthTokens, user?: authApi.Me | null) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  hydrated: false,

  async init() {
    // Wire the API client back here BEFORE reading tokens, so a racing
    // 401 during hydration can resolve against the about-to-be-loaded state.
    configureAuth({
      getTokens: () => get().tokens,
      onRefresh: async (t) => {
        await saveJSON(STORAGE_KEYS.tokens, t);
        set({ tokens: t });
      },
      onAuthFailed: async () => {
        await get().logout();
      },
    });

    const persisted = await loadJSON<PersistedSession>(STORAGE_KEYS.user);
    if (persisted?.tokens) {
      set({ tokens: persisted.tokens, user: persisted.user ?? null });
    }
    set({ hydrated: true });

    // Background-refresh the user profile so stale cached data doesn't
    // linger (e.g. KYC level bumped on another device). Best-effort.
    if (get().tokens) {
      get().refreshUser().catch(() => {/* network down — keep cached */});
    }
  },

  async setSession(tokens, user) {
    set({ tokens, user: user ?? get().user });
    const current = get();
    await saveJSON<PersistedSession>(STORAGE_KEYS.user, {
      tokens: current.tokens!,
      user: current.user,
    });
  },

  async refreshUser() {
    if (!get().tokens) return;
    const { user } = await authApi.fetchMe();
    set({ user });
    const t = get().tokens;
    if (t) await saveJSON<PersistedSession>(STORAGE_KEYS.user, { tokens: t, user });
  },

  async logout() {
    set({ user: null, tokens: null });
    await remove(STORAGE_KEYS.user);
  },
}));

export const isAuthenticated = (s: AuthState) => s.tokens !== null;
