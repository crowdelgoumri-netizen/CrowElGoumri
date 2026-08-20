/**
 * Language store (zustand) — UI language selection (fr / en).
 *
 * Mirrors the theme store's shape: the root layout calls `init()` once at
 * boot to hydrate the persisted preference (default fr — the product
 * default), then applies it to i18next. Settings renders the selector and
 * calls `setLang()`, which persists and switches i18next live.
 */
import { create } from "zustand";
import { loadJSON, saveJSON, STORAGE_KEYS } from "../lib/storage";
import i18n from "../lib/i18n";

export type Lang = "fr" | "en";

interface LangState {
  lang: Lang;
  hydrated: boolean;
  init: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;
}

export const useLang = create<LangState>((set) => ({
  lang: "fr",
  hydrated: false,

  async init() {
    const stored = await loadJSON<Lang>(STORAGE_KEYS.lang);
    const lang: Lang = stored === "en" ? "en" : "fr";
    await i18n.changeLanguage(lang);
    set({ lang, hydrated: true });
  },

  async setLang(lang: Lang) {
    set({ lang });
    await i18n.changeLanguage(lang);
    await saveJSON(STORAGE_KEYS.lang, lang);
  },
}));
