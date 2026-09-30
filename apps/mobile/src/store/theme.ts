/**
 * Theme store (zustand) — color-mode selection (system / dark / bright).
 *
 * Mirrors the auth store's shape: the root layout calls `init()` once at
 * boot to hydrate the persisted preference, screens read `resolvedScheme`
 * (never `mode` directly — that's the setting, this is what to render) and
 * call `setMode()` to change it. "system" tracks the OS appearance via
 * react-native's `Appearance` API and updates live if the user flips their
 * OS theme without reopening the app.
 */
import { create } from "zustand";
import { Appearance } from "react-native";
import { loadJSON, saveJSON, STORAGE_KEYS } from "../lib/storage";
import type { ColorScheme } from "../theme/tokens";

export type ThemeMode = "system" | ColorScheme;

function resolveScheme(mode: ThemeMode): ColorScheme {
  if (mode !== "system") return mode;
  // Appearance can report null (unknown) on some Android/web hosts, so
  // default to bright (the product's primary light look) rather than
  // leaving resolvedScheme in an undefined state.
  return Appearance.getColorScheme() === "dark" ? "dark" : "bright";
}

interface ThemeState {
  mode: ThemeMode;
  resolvedScheme: ColorScheme;
  hydrated: boolean;
  init: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useTheme = create<ThemeState>((set, get) => ({
  // Default to the explicit bright mode rather than "system": app.json's
  // userInterfaceStyle forces the native Appearance API to report "dark"
  // regardless of the device's real setting, so a "system" default would
  // never show the product's primary light look out of the box. Users can
  // still opt into "system" or "dark" from Settings.
  mode: "bright",
  resolvedScheme: resolveScheme("bright"),
  hydrated: false,

  async init() {
    const stored = await loadJSON<ThemeMode>(STORAGE_KEYS.themeMode);
    const mode = stored ?? "bright";
    set({ mode, resolvedScheme: resolveScheme(mode), hydrated: true });

    // Live-update while in "system" mode if the OS theme changes underneath us.
    Appearance.addChangeListener(() => {
      if (get().mode === "system") {
        set({ resolvedScheme: resolveScheme("system") });
      }
    });
  },

  async setMode(mode: ThemeMode) {
    set({ mode, resolvedScheme: resolveScheme(mode) });
    await saveJSON(STORAGE_KEYS.themeMode, mode);
  },
}));
