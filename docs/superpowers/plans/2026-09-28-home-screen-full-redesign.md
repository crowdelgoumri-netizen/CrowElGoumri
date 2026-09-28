# Home Screen Full Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mobile app's Home screen and bottom tab bar to match the DiasporaCart mockup (`NewDesign/ChatGPT Image 28 sept. 2026, 13_47_01.png`): hero text overlaid on the Algiers photo, a floating community card, a new 3-way action bar (send/travel/search), a 4-stat bar, a "Comment ça marche ?" section, two promo cards, and a restructured tab bar (center "Créer un envoi" action, Messages folded into the notification bell).

**Architecture:** `apps/mobile/app/(tabs)/index.tsx` composes a sequence of focused, single-purpose components (`HomeHero`, `HomeActionBar`, an inline stats block, `HowItWorks`, `PromoCards`) rather than one large screen file. Navigation changes are isolated to `apps/mobile/app/(tabs)/_layout.tsx` plus moving `messages.tsx` out of the tabs group. No backend/API changes anywhere in this plan.

**Tech Stack:** React Native 0.86 / Expo SDK 57, expo-router (file-based, `Tabs` navigator), NativeWind 4 (Tailwind className), react-i18next (fr/en), existing `useAsync` hook for data fetching.

**Spec:** `docs/superpowers/specs/2026-09-28-home-screen-full-redesign-design.md`

## Global Constraints

- French (`fr.ts`) is the reference copy; every new key gets a matching `en.ts` entry, same key shape (per `fr.ts`'s own header comment).
- No backend/API changes (spec Non-goals).
- No merge of `trips.tsx` + `parcels.tsx` (spec Non-goals) — "Mes envois" is a label change only.
- No route-param prefill into `post-parcel.tsx`/`post-trip.tsx` (spec Non-goals) — those screens don't accept params today.
- No new photo assets — card 1 of `PromoCards` reuses the existing `SenderArt` SVG illustration; card 2 reuses `assets/plane-window.jpg` (spec Non-goals).
- Every changed line must trace to this feature (AGENTS.md "Surgical Changes") — orphaned imports/i18n keys created by a task's own edit are removed in that same task; pre-existing unrelated dead code is left alone.
- Always read colors via `useThemeColors()` / `colors.*`, never a hardcoded hex, in any new component (existing project convention, see `src/hooks/useThemeColors.ts`).

## Review Focus

- **Guest (logged-out) users hitting `HomeHero`'s new combined-badge queries** — `listNotifications`/`listThreads` must stay guarded behind `tokens ?` (guests get `null`, not a 401). A guest opening Home must not crash or show a phantom badge.
- **The center "Créer un envoi" tab flashing an empty screen or leaving a dead back-stack entry** — it must never render real content, and its safety-net redirect must use `router.replace`, not `push`, so back navigation doesn't land the user on a blank screen.
- **`HomeActionBar`'s "Rechercher un voyage" segment with both De/Vers fields empty** — pressing search must still navigate to `/(tabs)/search` (browse-all), not throw on a malformed `corridor` param.
- **Combined unread badge math when one source has zero results** — `threads.reduce(...)` over an empty array must yield `0`, and `notifUnread + messagesUnread` must never render `NaN`/`undefined` in the badge.
- **Segmented control's default active state** — must default to "Envoyer un colis" (matches the mockup's default), verified explicitly rather than left to array order.

---

## Task 1: Tab bar restructure + Messages relocation

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx` (full rewrite of the `Tabs` block)
- Move: `apps/mobile/app/(tabs)/messages.tsx` → `apps/mobile/app/messages.tsx` (via `git mv`, no content changes)
- Create: `apps/mobile/app/(tabs)/create.tsx` (redirect-only placeholder for the center tab's route slot)
- Modify: `apps/mobile/src/locales/fr.ts:311` (`tabs.trips` value) and `apps/mobile/src/locales/en.ts:305` (or wherever `tabs.trips` currently sits — grep first, see Step 1)

**Interfaces:**
- Produces: no new exports; `TabsLayout` remains the default export of `_layout.tsx` with the same (no-props) signature.

- [ ] **Step 1: Locate the `tabs.*` i18n keys**

Run: `grep -n "tabs:" -A 8 apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts`

Expected: a block like `tabs: { home: "...", search: "...", trips: "...", messages: "...", profile: "..." }` in both files — note the exact line numbers for `trips` and `messages` for the next steps.

- [ ] **Step 2: Rename "Mes voyages" → "Mes envois", drop the `messages` tab key**

In `fr.ts`, change the `trips` value under `tabs` from `"Mes voyages"` to `"Mes envois"`, and delete the `messages: "Messages"` line from that same `tabs` block. Mirror both edits in `en.ts` (`trips: "My trips"` → `"My shipments"` — pick the closest natural English equivalent; delete `messages: "Messages"` there too).

- [ ] **Step 3: Move `messages.tsx` out of the tabs group**

Run: `git mv apps/mobile/app/\(tabs\)/messages.tsx apps/mobile/app/messages.tsx`

This is a pure file move — no content edit. It now behaves like `apps/mobile/app/notifications.tsx` or `apps/mobile/app/parcels.tsx`: a stack-only screen reachable via `router.push("/messages")`, not a tab.

- [ ] **Step 4: Create the center tab's placeholder route**

Create `apps/mobile/app/(tabs)/create.tsx`:

```tsx
/**
 * Create (tab bar center slot) — never rendered in normal use.
 *
 * The center "Créer un envoi" tab intercepts its own press in
 * (tabs)/_layout.tsx and pushes /post-parcel directly, so this screen is
 * only reached if that interception somehow doesn't fire (e.g.
 * programmatic/accessibility navigation). It immediately redirects rather
 * than showing blank content, using `replace` so it never sits in the
 * back stack.
 */
import { useEffect } from "react";
import { router } from "expo-router";

export default function CreateRedirect() {
  useEffect(() => {
    router.replace("/post-parcel");
  }, []);
  return null;
}
```

- [ ] **Step 5: Rewrite the tab bar**

Replace the full contents of `apps/mobile/app/(tabs)/_layout.tsx` with:

```tsx
/**
 * Tabs layout — the main app shell (guests welcome).
 *
 * Five tabs (Accueil / Rechercher / Créer un envoi / Mes envois / Profil)
 * per the 2026-09-28 Home redesign. The center "Créer un envoi" tab has no
 * screen of its own — pressing it pushes /post-parcel directly (see
 * `tabPress` listener below); trip-posting stays reachable from the "Mes
 * envois" tab's own CTA and from Home's action bar. Messages moved out of
 * the tab bar entirely — chat threads are now reached via the Home
 * header's notification bell (see HomeHero.tsx) and a "Messages" row on
 * /notifications.
 */
import { Tabs } from "expo-router";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Lift the tab bar above the Android gesture/3-button nav bar — without
  // this, the system bar overlays the tabs on physical devices.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.chromeBar,
          borderTopColor: colors.chromeBorder,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontFamily: "PlusJakartaSans", fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarButton: () => (
            <Pressable
              onPress={() => router.push("/post-parcel")}
              hitSlop={8}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              <Pressable
                onPress={() => router.push("/post-parcel")}
                style={{
                  marginTop: -22,
                  height: 52,
                  width: 52,
                  borderRadius: 26,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: colors.accentGlow,
                }}
              >
                <Ionicons name="add" size={26} color={colors.accentOn} />
              </Pressable>
            </Pressable>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/post-parcel");
          },
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t("tabs.trips"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "airplane" : "airplane-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

Notes on this rewrite versus the current file: the `useAuth`/`listNotifications`/`useAsync` unread-badge plumbing is deleted from here entirely — that logic moves into `HomeHero.tsx` in Task 3 (the bell now lives on Home, not the tab bar). The outer `Pressable` wrapping the inner one in the `create` tab's `tabBarButton` gives the whole tab-bar-height slot a tap target (matching how React Navigation expects `tabBarButton` to fill the slot) while the inner one is the visible raised circle; both call the same handler so the whole slot is tappable, not just the circle.

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. If `messages.tsx`'s relative imports (`../../src/...`) break after the move, fix them — the file now sits one directory shallower (`app/messages.tsx` vs `app/(tabs)/messages.tsx`), so every `../../src/...` import becomes `../src/...`.

- [ ] **Step 7: Run the existing test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still 1 suite / 5 tests passing (unaffected — no tests touch these files today).

- [ ] **Step 8: Manual tab bar check**

Rebuild the debug APK, reload via Metro, relaunch on the emulator, screenshot. Confirm: the tab bar shows 5 slots (Accueil, Rechercher, a raised circular button with no label, "Mes envois", Profil). Tap the raised center button from each of the other 4 tabs in turn — each time it must push `/post-parcel` immediately (no blank/flashing screen), and pressing the device back button from the post-parcel form must return to whichever tab you tapped it from, not to a blank "create" screen (confirms the `tabPress` interception fires and the `create.tsx` safety-net's `router.replace` never leaves a dead back-stack entry). Also confirm "Mes envois" opens the same trips list as before, just relabeled, and that there is no "Messages" tab anymore.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/messages.tsx apps/mobile/app/\(tabs\)/create.tsx apps/mobile/app/\(tabs\)/_layout.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: restructure tab bar (center Créer un envoi, Mes envois, Messages relocated)"
```

---

## Task 2: Add a Messages entry point to Notifications

**Files:**
- Modify: `apps/mobile/app/notifications.tsx`
- Modify: `apps/mobile/src/locales/fr.ts` (new `notifications.messagesRow` key), `apps/mobile/src/locales/en.ts` (same)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: nothing consumed by later tasks (this is the only remaining discoverable entry point to `/messages` besides deep links from a trip/parcel chat button).

- [ ] **Step 1: Add the i18n key**

In `fr.ts`, inside the `notifications: { ... }` block, add:
```ts
    messagesRow: "Messages",
```
In `en.ts`, same block:
```ts
    messagesRow: "Messages",
```

- [ ] **Step 2: Add the row to the screen**

In `apps/mobile/app/notifications.tsx`, add a new import line right after the `Ionicons` import:

```tsx
import { router } from "expo-router";
```

Then insert a new Pressable row right after the `<ScreenHeader .../>` block (before the `{data && data.unreadCount > 0 ? (...) : null}` unread-count line):

```tsx
      <Pressable
        onPress={() => router.push("/messages")}
        className="flex-row items-center gap-stack-gap py-card-padding mb-1 rounded-card bg-glass border border-hairline px-card-padding active:opacity-80"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-accent/15">
          <Ionicons name="chatbubbles-outline" size={17} color={colors.accent} />
        </View>
        <Text className="flex-1 text-text-primary font-body font-semibold text-sm">
          {t("notifications.messagesRow")}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/notifications.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: add Messages entry row to Notifications (Messages tab relocated)"
```

---

## Task 3: Rewrite `HomeHero.tsx` — header, photo-overlaid copy, floating community card

**Files:**
- Modify: `apps/mobile/src/components/HomeHero.tsx` (full rewrite)
- Modify: `apps/mobile/src/locales/fr.ts:318-351` (home block), `apps/mobile/src/locales/en.ts:312-344`

**Interfaces:**
- Consumes: `PERSONAS` from `src/theme/tokens.ts` (existing export, `{ name: string; role: string; initials: string }[]`), `Avatar` from `./Avatar` (existing, `{ name?, size?, className? }`), `listNotifications` from `../lib/notifications-api` (existing), `listThreads`/`ChatThread` from `../lib/chat` (existing, `ChatThread.unreadCount: number`).
- Produces: `HomeHero()` — same no-props signature as before. No longer renders a stats bar (moved to Task 6) or the old traveler CTA (superseded by `HomeActionBar`, Task 5).

- [ ] **Step 1: Confirm `home.heroTitle`/`heroBody`/`heroCta` have no other callers**

Run: `grep -rn "home.heroTitle\|home.heroBody\|home.heroCta" apps/mobile/app apps/mobile/src`

Expected: only matches inside `HomeHero.tsx` itself (the file this task is about to rewrite). If anything else matches, stop and investigate before deleting the keys in Step 3.

- [ ] **Step 2: Replace `HomeHero.tsx`**

Replace the full contents of `apps/mobile/src/components/HomeHero.tsx` with:

```tsx
/**
 * HomeHero — DiasporaCart brand hero for the top of the Home screen.
 *
 * Logo lockup + a combined-inbox bell + avatar, then the Algiers photo with
 * the tagline/value props/quote overlaid directly on it and a floating
 * "community" card. The old dedicated traveler CTA moved into
 * HomeActionBar's "Je voyage" segment; the stats bar is now its own
 * section in index.tsx, below HomeActionBar.
 */
import { router } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";
import { useAuth } from "../store/auth";
import { useAsync } from "../hooks/useAsync";
import { useThemeColors } from "../hooks/useThemeColors";
import { listNotifications } from "../lib/notifications-api";
import { listThreads } from "../lib/chat";
import { PERSONAS } from "../theme/tokens";
import heroAlgiers from "../../assets/hero-algiers.jpg";

export function HomeHero() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const user = useAuth((s) => s.user);

  // Combined inbox badge: the bell now also stands in for the (removed)
  // Messages tab, so its count folds in unread chat threads too.
  const { data: notifData } = useAsync(
    () =>
      tokens
        ? listNotifications({ unreadOnly: true, limit: 1 })
        : Promise.resolve(null),
    [!!tokens],
  );
  const { data: threadsData } = useAsync(
    () => (tokens ? listThreads() : Promise.resolve(null)),
    [!!tokens],
  );
  const notifUnread = notifData?.unreadCount ?? 0;
  const messagesUnread = (threadsData?.threads ?? []).reduce(
    (sum, th) => sum + th.unreadCount,
    0,
  );
  const unread = notifUnread + messagesUnread;

  return (
    <View className="mt-md">
      {/* Logo lockup + bell + avatar */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Ionicons name="heart" size={16} color={colors.accentOn} />
          </View>
          <Text className="font-heading text-lg font-extrabold">
            <Text className="text-text-primary">Diaspora</Text>
            <Text className="text-accent">Cart</Text>
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/notifications")}
            className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unread > 0 ? (
              <View className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-accent">
                <Text className="text-accent-on text-[10px] font-bold">
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Avatar name={user?.firstName} size="sm" />
          </Pressable>
        </View>
      </View>

      {/* Photo card — tagline/quote overlaid directly, floating community card */}
      <View className="mt-section-gap rounded-card overflow-hidden">
        <ImageBackground source={heroAlgiers} resizeMode="cover">
          <View style={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 120 }}>
            <Text className="text-text-primary font-heading text-2xl font-bold leading-7">
              {t("home.heroBanner.tagline")}
            </Text>
            <Text className="text-text-secondary font-body text-sm mt-1.5">
              {t("home.heroBanner.valueProps")}
            </Text>
            <Text
              className="text-accent font-script text-lg mt-2"
              style={{ transform: [{ rotate: "-2deg" }] }}
            >
              {t("home.heroBanner.quote")}
            </Text>

            <Pressable
              onPress={() => router.push("/invite")}
              className="mt-section-gap flex-row items-center gap-2 self-start rounded-field bg-glass-strong border border-hairline px-3 py-2.5"
            >
              <View className="flex-row">
                {PERSONAS.slice(0, 3).map((p, i) => (
                  <View key={p.name} style={{ marginLeft: i > 0 ? -10 : 0 }}>
                    <Avatar name={p.name} size="sm" className="border-2 border-white" />
                  </View>
                ))}
              </View>
              <View className="ml-1">
                <Text className="font-heading font-bold text-text-primary text-xs">
                  {t("home.heroBanner.communityTitle")}
                </Text>
                <Text className="font-body text-text-muted text-[10px]">
                  <Text className="font-bold text-accent">+10K</Text>{" "}
                  {t("home.heroBanner.communitySubtitle")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </ImageBackground>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Update `fr.ts`'s `home` block**

Replace the `heroBanner: { ... }` object (currently `fr.ts:320-330`) with the same fields plus two new ones, and delete the three now-orphaned lines right after it (`heroTitle`/`heroBody`/`heroCta`, currently `fr.ts:331-334`):

```ts
    heroBanner: {
      tagline: "Le lien qui rapproche les Algériens du monde entier",
      valueProps: "Voyagez · Envoyez · Restez proches",
      quote: "Plus qu'un colis, c'est un bout de chez soi ♡",
      communityTitle: "Rejoignez une communauté solidaire",
      communitySubtitle: "voyageurs déjà actifs",
      statTravelersValue: "+10 000",
      statTravelersLabel: "voyageurs",
      statParcelsValue: "+25 000",
      statParcelsLabel: "colis livrés",
      statRatingValue: "4,8/5",
      statRatingLabel: "satisfaction",
      statSecureValue: "100%",
      statSecureLabel: "sécurisé",
    },
```

(`statSecureValue`/`statSecureLabel` are used starting in Task 6 — adding them now keeps this task's locale edit in one place rather than touching the same object twice.)

- [ ] **Step 4: Mirror in `en.ts`**

Replace `en.ts`'s equivalent `heroBanner: { ... }` block (currently `en.ts:314-324`) plus delete its `heroTitle`/`heroBody`/`heroCta` lines (`en.ts:325-327`):

```ts
    heroBanner: {
      tagline: "The link that brings Algerians closer, wherever they are",
      valueProps: "Travel · Send · Stay close",
      quote: "More than a parcel, it's a piece of home ♡",
      communityTitle: "Join a caring community",
      communitySubtitle: "travelers already active",
      statTravelersValue: "10,000+",
      statTravelersLabel: "travelers",
      statParcelsValue: "25,000+",
      statParcelsLabel: "parcels delivered",
      statRatingValue: "4.8/5",
      statRatingLabel: "satisfaction",
      statSecureValue: "100%",
      statSecureLabel: "secure",
    },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 7: Manual screenshot check**

Rebuild the debug APK (`cd apps/mobile/android && ./gradlew installDebug`), reload via the running Metro bundler, relaunch on the emulator, and screenshot. Confirm: bell shows no badge when logged out as a guest (no crash), logo/tagline/quote render on top of the photo with readable contrast, and the community pill floats correctly with 3 overlapping avatars. If tagline contrast against the photo's sky is poor, that's the one place this task allows a follow-up fix (a light top-to-transparent gradient) — note it in the commit message if applied.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/HomeHero.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: rewrite HomeHero — photo-overlaid copy, combined inbox badge, community card"
```

---

## Task 4: Extract `CITY_OPTIONS` into `corridors.ts`

**Files:**
- Modify: `apps/mobile/src/config/corridors.ts` (append export)
- Modify: `apps/mobile/app/(tabs)/search.tsx:31-36`

**Interfaces:**
- Produces: `CITY_OPTIONS: { value: string; label: string }[]` exported from `src/config/corridors.ts` — consumed by `search.tsx` (this task) and `HomeActionBar.tsx` (Task 5).

- [ ] **Step 1: Add the export to `corridors.ts`**

Append to the end of `apps/mobile/src/config/corridors.ts` (after the existing `POPULAR_CORRIDORS` export):

```ts

/**
 * Flattened "Paris (France)"-style origin options, country-grouped. Shared
 * by the Search screen's From field and the Home action bar's De field.
 */
export const CITY_OPTIONS = ORIGIN_COUNTRIES.flatMap((c) =>
  c.cities.map((city) => ({ value: city, label: `${city} (${c.name})` })),
);
```

- [ ] **Step 2: Update `search.tsx` to import instead of derive**

Change line 31 from:
```ts
import { ORIGIN_COUNTRIES, WILAYAS_1_58 } from "../../src/config/corridors";
```
to:
```ts
import { CITY_OPTIONS, WILAYAS_1_58 } from "../../src/config/corridors";
```

Delete lines 33-36 (the now-redundant local derivation):
```ts
/** Flattened "Paris (France)"-style origin options, country-grouped. */
const CITY_OPTIONS = ORIGIN_COUNTRIES.flatMap((c) =>
  c.cities.map((city) => ({ value: city, label: `${city} (${c.name})` })),
);
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors — `search.tsx`'s later usage of `CITY_OPTIONS` (in its `Select` for the "from" field) now resolves to the imported constant with an identical shape, so no further changes needed there.

- [ ] **Step 4: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/config/corridors.ts apps/mobile/app/\(tabs\)/search.tsx
git commit -m "Mobile: hoist CITY_OPTIONS into corridors.ts for reuse by the new Home action bar"
```

---

## Task 5: New `HomeActionBar` component

**Files:**
- Create: `apps/mobile/src/components/HomeActionBar.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx` (wire it in)
- Modify: `apps/mobile/src/locales/fr.ts`, `apps/mobile/src/locales/en.ts` (new `home.actionBar.*` keys)

**Interfaces:**
- Consumes: `CITY_OPTIONS`, `WILAYAS_1_58` from `../config/corridors` (Task 4), `Card` from `./Card`, `Select` from `./Select` (existing, `{ label, value, options, onSelect, placeholder }`).
- Produces: `HomeActionBar()` — no-props component, default export none (named export only, matching `HomeHero`'s pattern).

- [ ] **Step 1: Add i18n keys**

In `fr.ts`'s `home` block, add a new nested object right after `heroBanner` (before `popularCorridors` or anywhere inside `home`):

```ts
    actionBar: {
      segmentParcel: "Envoyer un colis",
      segmentTrip: "Je voyage",
      segmentSearch: "Rechercher un voyage",
      from: "De",
      fromPlaceholder: "Ville de départ",
      to: "Vers",
      toPlaceholder: "Wilaya d'arrivée",
      cta: "Rechercher",
    },
```

In `en.ts`, the matching block:

```ts
    actionBar: {
      segmentParcel: "Send a parcel",
      segmentTrip: "I'm traveling",
      segmentSearch: "Search a trip",
      from: "From",
      fromPlaceholder: "Departure city",
      to: "To",
      toPlaceholder: "Arrival wilaya",
      cta: "Search",
    },
```

- [ ] **Step 2: Create the component**

Create `apps/mobile/src/components/HomeActionBar.tsx`:

```tsx
/**
 * HomeActionBar — Home screen's dual-intent action card: a 3-way segmented
 * control (send a parcel / post a trip / search trips) over a De/Vers route
 * row, sitting directly below the hero photo (not overlapping it).
 */
import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Select } from "./Select";
import { useThemeColors } from "../hooks/useThemeColors";
import { CITY_OPTIONS, WILAYAS_1_58 } from "../config/corridors";

type Segment = "parcel" | "trip" | "search";

const SEGMENTS: { key: Segment; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "parcel", icon: "cube-outline", labelKey: "home.actionBar.segmentParcel" },
  { key: "trip", icon: "airplane-outline", labelKey: "home.actionBar.segmentTrip" },
  { key: "search", icon: "search-outline", labelKey: "home.actionBar.segmentSearch" },
];

export function HomeActionBar() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>("parcel");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function swap() {
    const f = from;
    setFrom(to);
    setTo(f);
  }

  function go() {
    if (segment === "parcel") {
      router.push("/post-parcel");
      return;
    }
    if (segment === "trip") {
      router.push("/post-trip");
      return;
    }
    if (from && to) {
      router.push({ pathname: "/(tabs)/search", params: { corridor: `${from} → ${to}` } });
    } else {
      router.push("/(tabs)/search");
    }
  }

  return (
    <Card raised className="mt-section-gap">
      <View className="flex-row bg-glass rounded-chip p-1">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              className={
                "flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-chip " +
                (active ? "bg-accent" : "bg-transparent")
              }
            >
              <Ionicons name={s.icon} size={13} color={active ? colors.accentOn : colors.textMuted} />
              <Text
                className={
                  "font-body font-semibold text-[11px] " +
                  (active ? "text-accent-on" : "text-text-muted")
                }
                numberOfLines={1}
              >
                {t(s.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-end gap-2 mt-stack-gap">
        <View className="flex-1">
          <Select
            label={t("home.actionBar.from")}
            value={from || null}
            options={CITY_OPTIONS}
            onSelect={setFrom}
            placeholder={t("home.actionBar.fromPlaceholder")}
          />
        </View>
        <Pressable
          onPress={swap}
          className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
        <View className="flex-1">
          <Select
            label={t("home.actionBar.to")}
            value={to || null}
            options={WILAYAS_1_58}
            onSelect={setTo}
            placeholder={t("home.actionBar.toPlaceholder")}
          />
        </View>
        <Pressable
          onPress={go}
          accessibilityLabel={t("home.actionBar.cta")}
          className="h-11 w-11 items-center justify-center rounded-full bg-accent active:opacity-80"
        >
          <Ionicons name="search" size={17} color={colors.accentOn} />
        </Pressable>
      </View>
    </Card>
  );
}
```

- [ ] **Step 3: Wire it into `index.tsx`**

Add the import (alongside the existing `HomeHero` import):

```tsx
import { HomeActionBar } from "../../src/components/HomeActionBar";
```

Insert `<HomeActionBar />` immediately after `<HomeHero />` in the JSX (currently `index.tsx:54`).

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 6: Manual screenshot + tap-through check**

Rebuild, reload, screenshot. Confirm the segmented control defaults to "Envoyer un colis" (green-filled, per Review Focus). Tap each segment then the search button: *Envoyer un colis* → lands on the post-parcel form; *Je voyage* → lands on the post-trip form; *Rechercher un voyage* with both fields empty → lands on Search showing all trips (no crash); with both fields filled → Search pre-filtered to that corridor.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/HomeActionBar.tsx apps/mobile/app/\(tabs\)/index.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: add HomeActionBar (send/travel/search segmented control + route bar)"
```

---

## Task 6: 4-stat bar in `index.tsx`

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `Card` from `../../src/components/Card` (new import for this file), the `home.heroBanner.stat*` i18n keys (already added in Task 3, including `statSecureValue`/`statSecureLabel`).
- Produces: nothing consumed elsewhere — this is presentational, inline in `index.tsx`.

- [ ] **Step 1: Add the `Card` import**

Add alongside `index.tsx`'s other component imports:

```tsx
import { Card } from "../../src/components/Card";
```

- [ ] **Step 2: Add the `STATS` data + `StatItem` helper**

Add near the top of `index.tsx`, right after the existing `const TRUST = [...] as const;` block:

```tsx
const STATS = [
  { icon: "earth-outline", valueKey: "home.heroBanner.statTravelersValue", labelKey: "home.heroBanner.statTravelersLabel" },
  { icon: "cube-outline", valueKey: "home.heroBanner.statParcelsValue", labelKey: "home.heroBanner.statParcelsLabel" },
  { icon: "star", valueKey: "home.heroBanner.statRatingValue", labelKey: "home.heroBanner.statRatingLabel" },
  { icon: "shield-checkmark", valueKey: "home.heroBanner.statSecureValue", labelKey: "home.heroBanner.statSecureLabel" },
] as const;
```

And a small helper function near the bottom, alongside the existing `SectionTitle` helper:

```tsx
function StatItem({
  icon,
  valueKey,
  labelKey,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  valueKey: string;
  labelKey: string;
  divider: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className={"flex-1 items-center gap-1" + (divider ? " border-l border-hairline" : "")}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text className="font-heading font-bold text-text-primary text-xs">{t(valueKey)}</Text>
      <Text className="font-body text-text-muted text-[9px] text-center">{t(labelKey)}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Render the stats card**

Insert directly after `<HomeActionBar />` in the JSX:

```tsx
        <Card raised className="mt-section-gap flex-row">
          {STATS.map((s, i) => (
            <StatItem key={s.icon} icon={s.icon} valueKey={s.valueKey} labelKey={s.labelKey} divider={i > 0} />
          ))}
        </Card>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 6: Manual screenshot check**

Rebuild, reload, screenshot. Confirm all 4 stats render with dividers between them and none wrap awkwardly at this width — if the 4th stat's label ("sécurisé"/"secure") crowds the row, that's an acceptable follow-up font-size tweak within this same task (already using `text-[9px]`, the smallest step already in use elsewhere in this file).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/\(tabs\)/index.tsx
git commit -m "Mobile: extend Home stats bar to 4 stats (adds \"100% sécurisé\")"
```

---

## Task 7: New `HowItWorks` component

**Files:**
- Create: `apps/mobile/src/components/HowItWorks.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx` (wire it in)
- Modify: `apps/mobile/src/locales/fr.ts`, `apps/mobile/src/locales/en.ts` (new `home.howItWorks.*` keys)

**Interfaces:**
- Consumes: nothing new.
- Produces: `HowItWorks()` — no-props component.

- [ ] **Step 1: Add i18n keys**

In `fr.ts`'s `home` block, add (anywhere inside `home`, e.g. right after `actionBar`):

```ts
    howItWorks: {
      title: "Comment ça marche ?",
      seeMore: "Voir plus",
      step1Title: "Trouvez un voyageur",
      step1Body: "Depuis ou vers l'Algérie",
      step2Title: "Demandez l'envoi",
      step2Body: "Échangez en toute sécurité",
      step3Title: "Suivez votre colis",
      step3Body: "Jusqu'à sa livraison",
      step4Title: "Faites plaisir",
      step4Body: "Un bout de chez soi partout dans le monde",
    },
```

In `en.ts`:

```ts
    howItWorks: {
      title: "How does it work?",
      seeMore: "See more",
      step1Title: "Find a traveler",
      step1Body: "To or from Algeria",
      step2Title: "Request the delivery",
      step2Body: "Chat safely and agree on terms",
      step3Title: "Track your parcel",
      step3Body: "Until it's delivered",
      step4Title: "Make someone's day",
      step4Body: "A piece of home, anywhere in the world",
    },
```

- [ ] **Step 2: Create the component**

Create `apps/mobile/src/components/HowItWorks.tsx`:

```tsx
/**
 * HowItWorks — Home screen's static "Comment ça marche ?" 4-step explainer.
 *
 * Rendered as 4 equal columns rather than a literal dotted connector line
 * (no extra SVG plumbing needed to convey the same left-to-right sequence).
 */
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../hooks/useThemeColors";

const STEPS = [
  { icon: "airplane-outline", titleKey: "home.howItWorks.step1Title", bodyKey: "home.howItWorks.step1Body" },
  { icon: "cube-outline", titleKey: "home.howItWorks.step2Title", bodyKey: "home.howItWorks.step2Body" },
  { icon: "locate-outline", titleKey: "home.howItWorks.step3Title", bodyKey: "home.howItWorks.step3Body" },
  { icon: "heart-outline", titleKey: "home.howItWorks.step4Title", bodyKey: "home.howItWorks.step4Body" },
] as const;

export function HowItWorks() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="mt-section-gap">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary font-heading font-bold text-base">
          {t("home.howItWorks.title")}
        </Text>
        <Pressable onPress={() => router.push("/onboarding")}>
          <Text className="text-accent font-heading text-xs font-bold">
            {t("home.howItWorks.seeMore")}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row justify-between mt-3">
        {STEPS.map((step) => (
          <View key={step.titleKey} className="items-center" style={{ width: "23%" }}>
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/12 border border-accent/20">
              <Ionicons name={step.icon} size={18} color={colors.accent} />
            </View>
            <Text className="font-heading font-bold text-text-primary text-[11px] text-center mt-1.5 leading-4">
              {t(step.titleKey)}
            </Text>
            <Text className="font-body text-text-muted text-[10px] text-center mt-0.5 leading-3.5">
              {t(step.bodyKey)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Wire it into `index.tsx`**

Add the import:

```tsx
import { HowItWorks } from "../../src/components/HowItWorks";
```

Insert `<HowItWorks />` right after the stats `<Card raised ...>` block added in Task 6.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 6: Manual screenshot + tap check**

Rebuild, reload, screenshot. Confirm the 4 steps render without wrapping, and "Voir plus" opens `/onboarding`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/HowItWorks.tsx apps/mobile/app/\(tabs\)/index.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: add HowItWorks section to Home"
```

---

## Task 8: New `PromoCards` component

**Files:**
- Create: `apps/mobile/src/components/PromoCards.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx` (wire it in)
- Modify: `apps/mobile/src/locales/fr.ts`, `apps/mobile/src/locales/en.ts` (new `home.promo.*` keys)

**Interfaces:**
- Consumes: `SenderArt` from `./Illustrations` (existing), `assets/plane-window.jpg` (existing asset, confirmed present on disk).
- Produces: `PromoCards()` — no-props component.

- [ ] **Step 1: Add i18n keys**

In `fr.ts`'s `home` block:

```ts
    promo: {
      familiesTitle: "Des milliers de familles réunies grâce à vous",
      familiesBody: "Chaque colis transporte bien plus que des objets.",
      travelTitle: "Vous voyagez bientôt ?",
      travelBody: "Partagez votre trajet et aidez la communauté.",
    },
```

In `en.ts`:

```ts
    promo: {
      familiesTitle: "Thousands of families reunited thanks to you",
      familiesBody: "Every parcel carries far more than objects.",
      travelTitle: "Traveling soon?",
      travelBody: "Share your trip and help the community.",
    },
```

- [ ] **Step 2: Create the component**

Create `apps/mobile/src/components/PromoCards.tsx`:

```tsx
/**
 * PromoCards — two side-by-side Home screen promo tiles: a community
 * illustration card and a photo card inviting the viewer to post a trip.
 */
import { router } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SenderArt } from "./Illustrations";
import { useThemeColors } from "../hooks/useThemeColors";
import planeWindow from "../../assets/plane-window.jpg";

export function PromoCards() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-3 mt-section-gap" style={{ height: 190 }}>
      <Pressable
        onPress={() => router.push("/invite")}
        className="flex-1 rounded-card bg-glass border border-hairline p-card-padding"
      >
        <View className="items-center">
          <SenderArt />
        </View>
        <Text className="font-heading font-bold text-text-primary text-xs mt-1.5 leading-4">
          {t("home.promo.familiesTitle")}
        </Text>
        <Text className="font-body text-text-muted text-[10px] mt-1 leading-3.5">
          {t("home.promo.familiesBody")}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.accent} style={{ marginTop: 4 }} />
      </Pressable>

      <Pressable onPress={() => router.push("/post-trip")} className="flex-1 rounded-card overflow-hidden">
        <ImageBackground source={planeWindow} resizeMode="cover" style={{ flex: 1 }}>
          <View className="flex-1 justify-end bg-black/35 p-card-padding">
            <Text className="font-heading font-bold text-white text-xs leading-4">
              {t("home.promo.travelTitle")}
            </Text>
            <Text className="font-body text-white/80 text-[10px] mt-1 leading-3.5">
              {t("home.promo.travelBody")}
            </Text>
            <Ionicons name="chevron-forward" size={15} color="#fff" style={{ marginTop: 4 }} />
          </View>
        </ImageBackground>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Wire it into `index.tsx`**

Add the import:

```tsx
import { PromoCards } from "../../src/components/PromoCards";
```

Insert `<PromoCards />` right after `<HowItWorks />`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: still passing.

- [ ] **Step 6: Manual screenshot + tap check**

Rebuild, reload, screenshot. Confirm both cards render at equal height, card 2's photo is visible under the dark scrim, and tapping each navigates correctly (`/invite`, `/post-trip`).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/PromoCards.tsx apps/mobile/app/\(tabs\)/index.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: add PromoCards section to Home"
```

---

## Task 9: Remove superseded sections, final cleanup, full verification

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/src/locales/fr.ts`, `apps/mobile/src/locales/en.ts`

**Interfaces:** none — cleanup only.

- [ ] **Step 1: Remove the now-superseded "Sender intent" card**

In `index.tsx`, delete the whole block from the `{/* Sender intent */}` comment through its closing `</View>` (originally lines 56-80 before this plan's earlier tasks shifted line numbers — locate by the `{t("home.senderTitle")}` text if line numbers have drifted). Its function (route to Search / post a parcel) is now covered by `HomeActionBar`.

- [ ] **Step 2: Remove the now-superseded bottom "Community" card**

In `index.tsx`, delete the whole block from the `{/* Community */}` comment through its closing `</View>` (contains `{t("home.communityTitle")}` / `{t("home.communityCta")}`). Its function (invite friends) is now covered by `HomeHero`'s floating community pill.

- [ ] **Step 3: Remove the now-unused `SenderArt` import from `index.tsx`**

Delete the line `import { SenderArt } from "../../src/components/Illustrations";` from `index.tsx` — `PromoCards.tsx` now owns the only remaining usage of `SenderArt` (its own import, added in Task 8, is unaffected).

- [ ] **Step 4: Confirm the orphaned i18n keys have no other callers, then remove them**

Run: `grep -rn "home.senderTitle\|home.senderBody\|home.senderCta\|home.communityTitle\|home.communityBody\|home.communityCta" apps/mobile/app apps/mobile/src`

Expected: no matches (both blocks were deleted in Steps 1-2). If anything still matches, stop and investigate before deleting the keys below.

Delete the `senderTitle`/`senderBody`/`senderCta` and `communityTitle`/`communityBody`/`communityCta` lines from `home` in both `fr.ts` and `en.ts` (six lines/blocks each file — `communityBody` spans two lines in `fr.ts`/`en.ts` due to its length, per the existing formatting).

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `cd apps/mobile && npx jest --silent`
Expected: 1 suite / 5 tests passing, same as session baseline.

- [ ] **Step 7: Full rebuild and side-by-side comparison**

Rebuild the debug APK, reload via Metro, relaunch, and screenshot the full Home screen (scroll to capture everything below the fold too — Popular corridors, Live travelers feed, Trust strip remain below `PromoCards`, unchanged, per the spec's decision to keep functional sections not depicted in the mockup). Compare section-by-section against `NewDesign/ChatGPT Image 28 sept. 2026, 13_47_01.png`: header (bell+avatar), hero photo with overlaid copy + community pill, action bar (default segment, De/Vers, search button), 4-stat bar, "Comment ça marche ?", promo cards. Then tap through the new tab bar: center button → post-parcel form opens; "Mes envois" tab → shows the same trips list as before (relabeled); bell → notifications screen showing the new "Messages" row at top.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/\(tabs\)/index.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: remove Home sections superseded by HomeActionBar/community card, final cleanup"
```
