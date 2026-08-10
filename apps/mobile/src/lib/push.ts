/**
 * Push notifications — register this device's Expo push token with the backend.
 *
 * Wires the Phase 7 backend (POST /notifications/device-token). The flow:
 *   1. Ask the OS for notification permission (iOS prompt; Android is implicit).
 *   2. getExpoPushTokenAsync() — needs `expo.extra.eas.projectId` in dev
 *      builds; in Expo Go it uses the Go project. Failures here are expected
 *      on iOS simulators / without a projectId, so we swallow + log.
 *   3. POST the token so notify() can target this device.
 *
 * Graceful by design: push is a best-effort channel. A failure to register
 * never blocks app use; the in-app notification list (screen 11) still works.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDeviceToken } from "./notifications-api";

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
 * Request permission + obtain + register the Expo push token. Safe to call on
 * every boot; the backend dedupes the token per user. Returns the token on
 * success, null if unavailable (sim, denied, no projectId).
 */
export async function registerForPush(): Promise<string | null> {
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
    return token;
  } catch (e) {
    // Expected on iOS simulators or without a configured projectId — non-fatal.
    console.warn("[push] registration skipped:", (e as Error).message);
    return null;
  }
}
