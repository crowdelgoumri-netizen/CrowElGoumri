/**
 * i18n setup — i18next + react-i18next.
 *
 * FR is the product default (France↔Algerie corridor, FR-first copy); every
 * screen is migrated, so EN is a first-class alternative. `lng` starts at
 * "fr" and the lang store (src/store/lang.ts) applies the persisted choice
 * at boot — Settings switches it live via i18n.changeLanguage().
 *
 * Initialize by importing this module once at boot — app/_layout.tsx does a
 * side-effect import. Screens consume translations via react-i18next's
 * useTranslation() hook; non-component code (format.ts) uses the default
 * export's .t().
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
