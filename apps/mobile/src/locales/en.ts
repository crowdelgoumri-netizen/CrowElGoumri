/**
 * English translations. Mirror of fr.ts — same key shape, English values.
 * Coverage is partial (settings only for now); the language selector lands
 * once enough screens are migrated. See fr.ts for the migration pattern.
 */
export const en = {
  settings: {
    title: "Settings",
    account: "Account",
    preferences: "Preferences",
    pushNotifications: "Push notifications",
    howItWorks: "How it works",
    about: "About",
    appName: "CrowdShipping",
    aboutTagline: "Peer-to-peer delivery marketplace · Europe → Algeria. v0.1",
    logout: "Log out",
    pushAlertTitle: "Notifications",
    pushAlertBody: "Could not register (simulator or permission denied).",
  },
} as const;
