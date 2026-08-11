# Settings Push Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Réactiver les notifications" from a one-way re-register button into a real ON/OFF push-notification toggle, and remove the dev-only "Serveur API" row from Settings.

**Architecture:** `apps/mobile/src/lib/push.ts` becomes the single source of truth for whether push is active: a locally-persisted preference (default on) gates `registerForPush()`, so the existing unconditional boot-time call in `_layout.tsx` respects it automatically with no changes to that file. `apps/mobile/app/settings.tsx` reads/writes that preference through a native `Switch` and calls the existing `unregisterDeviceToken` on opt-out. No backend changes — `POST`/`DELETE /notifications/device-token` already exist and are already wired into `lib/notifications-api.ts`.

**Tech Stack:** Expo Router + React Native + NativeWind (mobile only — no backend package touched), `@react-native-async-storage/async-storage` via the existing `src/lib/storage.ts` wrapper.

## Global Constraints

- Mobile has no test suite; verification is `pnpm --filter @crowdshipping/mobile typecheck`.
- French UI copy throughout.
- Payment methods and language selector are explicitly out of scope for this plan (no saved-card API exists; no i18n infrastructure exists) — do not add either.
- The "e-mails d'actualité" toggle is explicitly out of scope (the email channel isn't connected to a real provider yet) — do not add it.
- Default behavior for existing users must be unchanged: push stays on unless a user explicitly disables it in Settings (the stored preference defaults to `true` when never set).
- No new shared UI component — the toggle uses React Native's built-in `Switch`, styled inline with the app's existing hex color literals (`#FF6A2B` accent, `#16213B` navySoft, `#F5F7FA` mist — the same literals already used via `Ionicons color=` props elsewhere in this file), not a new abstraction.

---

### Task 1: `push.ts` gains a persisted on/off preference

**Files:**
- Modify: `apps/mobile/src/lib/storage.ts`
- Modify: `apps/mobile/src/lib/push.ts`

**Interfaces:**
- Consumes: `loadJSON`, `saveJSON`, `remove` from `./storage` (existing); `unregisterDeviceToken` from `./notifications-api` (existing, not yet imported in `push.ts`).
- Produces: `isPushEnabled(): Promise<boolean>`, `setPushEnabled(enabled: boolean): Promise<void>` — both consumed by Task 2. `registerForPush()`'s existing signature (`Promise<string | null>`) is unchanged, but it now also returns `null` immediately when push is disabled.

- [ ] **Step 1: Add the new storage keys**

In `apps/mobile/src/lib/storage.ts`, change:

```ts
export const STORAGE_KEYS = {
  tokens: "@crowdshipping/tokens",
  user: "@crowdshipping/user",
} as const;
```

to:

```ts
export const STORAGE_KEYS = {
  tokens: "@crowdshipping/tokens",
  user: "@crowdshipping/user",
  pushEnabled: "@crowdshipping/push-enabled",
  pushToken: "@crowdshipping/push-token",
} as const;
```

- [ ] **Step 2: Rewrite push.ts**

Replace the full contents of `apps/mobile/src/lib/push.ts` with:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors. (`push.ts` isn't imported by the new toggle yet — that's Task 2 — but it must compile standalone, and `_layout.tsx`'s existing `registerForPush()` call must still typecheck against the unchanged signature.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/storage.ts apps/mobile/src/lib/push.ts
git commit -m "feat(mobile): gate push registration behind a persisted on/off preference"
```

---

### Task 2: Real toggle in Settings, remove the debug row

**Files:**
- Modify: `apps/mobile/app/settings.tsx`

**Interfaces:**
- Consumes: `isPushEnabled`, `setPushEnabled`, `registerForPush` from `../src/lib/push` (Task 1).

- [ ] **Step 1: Rewrite settings.tsx**

Replace the full contents of `apps/mobile/app/settings.tsx` with:

```tsx
/**
 * Settings (board 18) — account preferences + danger zone.
 *
 * Push notification toggle, help/guide (onboarding), and logout.
 * Lightweight on purpose: payment methods and a language selector aren't
 * buildable yet (no saved-card API, no i18n infrastructure) — see
 * docs/superpowers/specs/2026-08-11-settings-push-toggle-design.md.
 */
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { useAuth } from "../src/store/auth";
import { isPushEnabled, registerForPush, setPushEnabled } from "../src/lib/push";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    isPushEnabled().then(setPushOn);
  }, []);

  async function onTogglePush(next: boolean) {
    setPushOn(next);
    await setPushEnabled(next);
    if (next) {
      const token = await registerForPush();
      if (!token) {
        Alert.alert(
          "Notifications",
          "Inscription impossible (simulateur ou permission refusée).",
        );
      }
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Paramètres" />

      <Card className="gap-1">
        <Row icon="information-circle-outline" label="Compte" value={user?.email} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">Préférences</Text>
      <Card className="gap-1">
        <View className="flex-row items-center py-sm">
          <Ionicons name="notifications" size={20} color="#FF6A2B" />
          <Text className="text-white font-body flex-1 ml-md">Notifications push</Text>
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            trackColor={{ false: "#16213B", true: "#FF6A2B" }}
            thumbColor="#F5F7FA"
          />
        </View>
        <Divider />
        <PressableRow icon="help-circle-outline" label="Comment ça marche" onPress={() => router.push("/onboarding")} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">À propos</Text>
      <Card>
        <Text className="text-white font-heading font-bold">CrowdShipping</Text>
        <Text className="text-muted font-body text-xs mt-1">
          Marketplace de livraison entre particuliers · Europe → Algérie. v0.1
        </Text>
      </Card>

      <View className="mt-lg">
        <Button label="Se déconnecter" variant="secondary" onPress={() => logout()} />
      </View>
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View className="flex-row items-center py-sm">
      <Ionicons name={icon} size={20} color="#FF6A2B" />
      <Text className="text-white font-body flex-1 ml-md">{label}</Text>
      {value ? <Text className="text-muted font-body text-xs">{value}</Text> : null}
    </View>
  );
}

function PressableRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-sm active:opacity-70">
      <Ionicons name={icon} size={20} color="#FF6A2B" />
      <Text className="text-white font-body flex-1 ml-md">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#8A94A6" />
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-line" />;
}
```

This removes the `BASE_URL` import and the "Serveur API" `Row` entirely (both the row and the now-unused import), and removes the `Divider` that used to sit between "Compte" and "Serveur API" (that card now holds a single row, so no internal divider is needed).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors, no unused-import warnings.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/settings.tsx
git commit -m "feat(mobile): real push-notification toggle, remove debug settings row"
```

---

## Self-Review Notes

- **Spec coverage:** persisted on/off preference defaulting to true (Task 1) ✓, `registerForPush()` respects it with no changes needed to `_layout.tsx`'s existing unconditional call (Task 1) ✓, opt-out unregisters the known token (Task 1's `setPushEnabled`) ✓, real `Switch` toggle reading/writing the preference (Task 2) ✓, immediate registration on turning on (Task 2) ✓, "Serveur API" row + `BASE_URL` import removed (Task 2) ✓. Payment methods, language selector, and email toggle are explicitly not implemented, per spec.
- **Type consistency:** `isPushEnabled`/`setPushEnabled`/`registerForPush`'s signatures in Task 1 match their usage in Task 2 exactly (`Promise<boolean>`, `(enabled: boolean) => Promise<void>`, `Promise<string | null>`). `STORAGE_KEYS.pushEnabled`/`STORAGE_KEYS.pushToken` are defined in Task 1 Step 1 before Task 1 Step 2 uses them.
- **Task ordering:** Task 1 (library layer, self-contained) → Task 2 (UI, depends on Task 1's exports). Each task typechecks green before the next starts.
