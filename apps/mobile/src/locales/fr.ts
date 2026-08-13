/**
 * French translations — the product default (the corridor is France↔Algerie,
 * FR-first copy). Keys are grouped per screen/area; add a group when you
 * migrate a screen. Keep the key shape identical to en.ts.
 *
 * Migration pattern: import { useTranslation } from "react-i18next" in the
 * screen, `const { t } = useTranslation()`, and replace the hardcoded string
 * with `t("area.key")`. See app/settings.tsx for the worked example.
 */
export const fr = {
  settings: {
    title: "Paramètres",
    account: "Compte",
    preferences: "Préférences",
    pushNotifications: "Notifications push",
    howItWorks: "Comment ça marche",
    about: "À propos",
    appName: "CrowdShipping",
    aboutTagline:
      "Marketplace de livraison entre particuliers · Europe → Algérie. v0.1",
    logout: "Se déconnecter",
    pushAlertTitle: "Notifications",
    pushAlertBody:
      "Inscription impossible (simulateur ou permission refusée).",
  },
} as const;
