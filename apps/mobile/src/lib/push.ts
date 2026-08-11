/**
 * Push notifications — register this device's Expo push token with the backend.
 *
 * Wires the Phase 7 backend (POST/DELETE /notifications/device-token). The
 * registration flow:
 *   1. Check the local pushEnabled preference (default true) — skip
 *      entirely if the user has turned notifications off in Settings.
 *   2. Ask the OS for notification permission (iOS prompt; Android is implicit).
 *   3. getExpoPushTokenAsync() — needs `expo.extra.eas.projectId` in dev
 *      builds; in Expo Go it uses the Go project. Failures here are expected
 *      on iOS simulators / without a projectId, so we swallow + log.
 *   4. POST the token so notify() can target this device, and save it
 *      locally so a later opt-out can unregister the exact same token.
 *
 * Graceful by design: push is a best-effort channel. A failure to register
 * never blocks app use; the in-app notification list (screen 11) still works.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDeviceToken, unregisterDeviceToken } from "./notifications-api";
import { loadJSON, saveJSON, remove, STORAGE_KEYS } from "./storage";

/**
 * Configure how incoming notifications appear while the app is foregrounded.
 * Call once at boot (root layout) so pushes show a banner instead of silently
 * landing in the tray.
 */
export function configurePresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Whether the user has push enabled. Defaults to true — preserves the prior
 * always-on behavior for anyone who never touches the Settings toggle.
 */
export async function isPushEnabled(): Promise<boolean> {
  const stored = await loadJSON<boolean>(STORAGE_KEYS.pushEnabled);
  return stored ?? true;
}

/**
 * Flip the push preference. Disabling unregisters the last-known token from
 * the backend (best-effort) and clears it locally, so a later re-enable
 * requests a fresh token instead of assuming the old one still resolves.
 */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  await saveJSON(STORAGE_KEYS.pushEnabled, enabled);
  if (!enabled) {
    const token = await loadJSON<string>(STORAGE_KEYS.pushToken);
    if (token) {
      await unregisterDeviceToken(token).catch(() => {
        /* best-effort; the token still gets dropped locally below */
      });
      await remove(STORAGE_KEYS.pushToken);
    }
  }
}

/**
 * Request permission + obtain + register the Expo push token. Safe to call on
 * every boot; the backend dedupes the token per user. Returns the token on
 * success, null if push is disabled or unavailable (sim, denied, no projectId).
 */
export async function registerForPush(): Promise<string | null> {
  if (!(await isPushEnabled())) return null;

  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!status.granted) return null;

    // Android needs a notification channel for heads-up display.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "CrowdShipping",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { data } = await Notifications.getExpoPushTokenAsync();
    const token = typeof data === "string" ? data : String(data);
    await registerDeviceToken(token);
    await saveJSON(STORAGE_KEYS.pushToken, token);
    return token;
  } catch (e) {
    // Expected on iOS simulators or without a configured projectId — non-fatal.
    console.warn("[push] registration skipped:", (e as Error).message);
    return null;
  }
}
