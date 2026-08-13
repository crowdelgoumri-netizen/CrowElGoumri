/**
 * i18n setup — i18next + react-i18next.
 *
 * FR is the product default (France↔Algerie corridor, FR-first copy). EN is
 * wired as a parallel resource so the language selector can land once screen
 * coverage is real — until then we pin `lng: "fr"` so the app never shows a
 * half-translated UI. Device-locale detection is intentionally deferred (it
 * would switch to EN before most screens are migrated).
 *
 * Initialize by importing this module once at boot — app/_layout.tsx does a
 * side-effect import. Screens consume translations via react-i18next's
 * useTranslation() hook.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { fr } from "../locales/fr";
import { en } from "../locales/en";

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: {
    // React already escapes by default; i18next escaping is redundant.
    escapeValue: false,
  },
});

export default i18n;
