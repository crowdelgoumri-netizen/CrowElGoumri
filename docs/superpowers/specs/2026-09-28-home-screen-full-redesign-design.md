# Home screen full redesign — hero, action bar, how-it-works, promo cards, nav restructure

## Context

Following the DiasporaCart rebrand (`2026-09-21-diasporacart-redesign-design.md`),
the user supplied two new references today:

1. `NewDesign/Home.jpg` — a simple branded splash (logo, tagline, quote, clean
   hero photo, 3-stat bar). An earlier pass in this session already built a
   close match of this as a restyled hero inside the existing dual-intent
   Home screen (`HomeHero.tsx`).
2. `NewDesign/ChatGPT Image 28 sept. 2026, 13_47_01.png` — a full Home screen
   mockup, materially different and larger in scope: hero text overlaid
   directly on the photo, a floating "community" card, a 3-way segmented
   action control with a route search bar, a 4-stat bar, a "Comment ça
   marche ?" stepper, two promo cards, and a **different bottom tab bar**
   (drops Messages, adds a center "Créer un envoi" action, renames "Mes
   voyages" → "Mes envois").
3. `NewDesign/DiasporaCart_Complete_Design_System.pdf` — a written design
   system. Notably, §7 ("Navigation & Icons") states the 5-tab bar should
   stay **Accueil, Rechercher, Mes voyages, Messages, Profil** — i.e. it
   still describes the *current* tab bar, not the mockup's. This directly
   conflicts with reference #2.

Decisions locked in with the user before this spec (see brainstorming
session):

- Build the **full mockup** (#2), not just the simpler splash (#1) — this
  supersedes the smaller hero-only pass already merged into `HomeHero.tsx`
  earlier in the session.
- **Tab bar**: follow the mockup, not the PDF. This explicitly **reverses**
  the "FAB/chooser modal removed" decision locked in by the 2026-09-21 spec
  — a center FAB-style tab returns, this time as a fixed "Créer un envoi"
  action (not a chooser modal).
- **Messages**: tab removed. Chat threads become reachable via the
  notification bell (combined unread badge = notifications + message
  threads), which still opens `/notifications`; that screen gains a
  "Messages" entry row at the top linking to the (relocated) chat inbox.
- **"Mes envois" tab**: renamed label only, pointing at the existing
  `trips.tsx` content unchanged. No merge with `parcels.tsx` — that screen
  stays reachable from Profile like today.
- **"Créer un envoi" center tab**: routes straight to `/post-parcel`.
  Trip-posting stays reachable via the "Mes envois" (trips) tab's own CTA
  and via the new segmented control's "Je voyage" option.

## Non-goals

- No backend/API changes.
- No merge of `trips.tsx` + `parcels.tsx` into one screen (explicitly
  declined — see above).
- No route-param prefill into `post-parcel.tsx` / `post-trip.tsx` from the
  new De/Vers action bar — those screens don't accept route params today;
  wiring that up is a separate, later enhancement if wanted.
- No new photography for promo card 1 ("Des milliers de familles réunies…")
  — reuse the existing `SenderArt` illustration rather than block on a
  missing asset. Card 2 reuses the `plane-window.jpg` asset already in
  `assets/`.
- No changes to `onboarding.tsx`'s existing 3-step content — the new
  "Comment ça marche ?" section on Home is separate, new copy (4 steps).
- Design tokens (colors/spacing/radii) are unchanged — the
  `DiasporaCart_Complete_Design_System.pdf` token values already match
  `theme/tokens.ts` (verified: primary `#0F5D3B`, sand `#EADCC8`, etc. — no
  drift to reconcile).

## 1. Navigation restructure

**`apps/mobile/app/(tabs)/_layout.tsx`** — 5 tabs, reordered:

| Position | Route | Label | Icon | Notes |
|---|---|---|---|---|
| 1 | `index` | Accueil | home | unchanged |
| 2 | `search` | Rechercher | search | unchanged |
| 3 | *(new)* | — | `add` in a raised circular button | no label; custom `tabBarButton` rendering a 56px circular `bg-accent` button with a white `+` icon, translated up (`marginTop: -18` or similar) so it "pops" above the bar per the mockup. `tabBarIcon`/default button suppressed for this tab. |
| 4 | `trips` | **Mes envois** (renamed from "Mes voyages") | airplane | same `trips.tsx` content, label + i18n key value change only |
| 5 | `profile` | Profil | person | unchanged |

The center tab has no real route content of its own — pressing it
navigates straight to `/post-parcel` (a modal-style push, same as any other
`router.push`), rather than mounting a tab screen. Implementation:
`Tabs.Screen` with `listeners: { tabPress: (e) => { e.preventDefault(); router.push("/post-parcel"); } }` and `options.tabBarButton` for the custom
look, keeping it registered in the `Tabs` navigator (simplest way to get a
guaranteed slot in the bar) without ever actually rendering a screen.

**`apps/mobile/app/(tabs)/messages.tsx` → `apps/mobile/app/messages.tsx`**:
file moves out of the tabs group (same pattern as `parcels.tsx`,
`notifications.tsx`, `my-trips.tsx` today — a stack-only screen). No
content changes. The `Tabs.Screen name="messages"` entry is deleted from
`_layout.tsx`, and the unread-count query (`listNotifications`/thread
unread count) moves out of `_layout.tsx` into wherever the bell now lives
(see §2) since the tab bar itself no longer needs it.

## 2. Home header (top of `HomeHero.tsx`)

Two icons only, matching the mockup exactly (no third icon added):

- **Bell** → `/notifications`. Badge = `notifications.unreadCount +
  messageThreads.unreadCount` (two existing queries — `listNotifications`
  already used today, plus a lightweight unread-count read from
  `listThreads()`, summed client-side).
- **Avatar** (existing `Avatar` component, `size="sm"`, initials from
  `useAuth().user?.firstName`, generic person icon fallback for guests) →
  `/(tabs)/profile`.

`apps/mobile/app/notifications.tsx` gains a "Messages" row at the top of
its list (icon + label + chevron) linking to `/messages` — the only
remaining discoverable entry point to chat threads besides deep links from
a trip/parcel detail page's existing chat button.

## 3. Hero photo (`HomeHero.tsx` rewrite)

- Logo lockup row unchanged (badge + wordmark), now sharing the row with
  the bell + avatar (§2).
- Tagline / value props / quote move to overlay **directly on the photo's
  upper half** (no separate cream section above it) — matches the mockup.
  Text stays dark (near-black, same tokens as today); the sky portion of
  `hero-algiers.jpg` is bright enough for this to read without a scrim,
  confirmed against the existing screenshot. If a later screenshot shows
  poor contrast, add a light top gradient then — not speculatively now.
- The existing "Vous voyagez vers l'Algérie ?" headline + body + CTA button
  is **removed** from the photo entirely. Its job (posting a trip) is now
  covered by the new action bar's "Je voyage" option (§4). The now-orphaned
  `home.heroTitle`/`home.heroBody`/`home.heroCta` keys are removed from
  `fr.ts`/`en.ts` (confirmed unused elsewhere via grep, same cleanup rule
  applied earlier this session).
- New floating "community" card, mid-photo: "Rejoignez une communauté
  solidaire" + a 3-avatar stack (reusing the existing sample `PERSONAS`
  array from `theme/tokens.ts`) + "+10K" pill + "voyageurs déjà actifs" +
  chevron. Tap → `/invite`.
- Stats bar (§5) no longer overlaps the photo's bottom edge — the photo
  transitions straight into the new white action card (§4) below it.

## 4. New `HomeActionBar` component

New file: `apps/mobile/src/components/HomeActionBar.tsx`. A white
rounded-card section directly below the hero photo:

- 3-way segmented control (`SegmentedControl`-style, matching the design
  system's spec: "Light neutral container, 4px inner padding, 40px height,
  pill radius, active segment primary green"): **Envoyer un colis** (default
  active) / **Je voyage** / **Rechercher un voyage**. Local `useState` for
  the active segment; purely presentational otherwise.
- De/Vers row: two compact pressable fields opening the existing `Select`
  component. `ORIGIN_COUNTRIES`/`WILAYAS_1_58` already live in
  `src/config/corridors.ts`; the derived `CITY_OPTIONS` flat-map is
  currently local to `search.tsx` and moves to `corridors.ts` too, so both
  `search.tsx` and `HomeActionBar.tsx` import the same list instead of
  duplicating the `flatMap`. Plus a swap icon button (swaps the two field
  values) and a circular green search button.
- Search button press behavior depends on the active segment:
  - *Envoyer un colis* → `router.push("/post-parcel")`
  - *Je voyage* → `router.push("/post-trip")`
  - *Rechercher un voyage* → `router.push({ pathname: "/(tabs)/search",
    params: from && to ? { corridor: `${from} → ${to}` } : {} })` — same
    corridor-param convention the popular-corridor chips already use.

## 5. Stats bar

Own card below `HomeActionBar` (not overlapping the photo). Extends the
existing 3-stat bar to 4, adding "100% sécurisé" (shield-check icon, new
i18n keys `home.heroBanner.statSecureValue`/`statSecureLabel`). Same
`Card raised` + `StatItem`-style layout already built.

## 6. New `HowItWorks` component

New file: `apps/mobile/src/components/HowItWorks.tsx`. Static section,
"Comment ça marche ?" title + "Voir plus" link (→ `/onboarding`) + 4 steps
in a horizontal row with a dotted connector: Trouvez un voyageur → Demandez
l'envoi → Suivez votre colis → Faites plaisir à vos proches. New i18n keys
under `home.howItWorks.*`; not reusing `onboarding.tsx`'s existing 3-step
copy (different wording/count, deliberately).

## 7. New `PromoCards` component

New file: `apps/mobile/src/components/PromoCards.tsx`. Two side-by-side
cards:

- Card 1: "Des milliers de familles réunies grâce à vous" / "Chaque colis
  transporte bien plus que des objets." — image slot uses the existing
  `SenderArt` illustration (no photo asset available). Tap → `/invite`.
- Card 2: "Vous voyagez bientôt ?" / "Partagez votre trajet et aidez la
  communauté." — background image `assets/plane-window.jpg` (already
  present). Tap → `/post-trip`.

## Testing

- `npx tsc --noEmit` and the existing Jest suite must stay green (no
  screen-level tests exist for Home today — this doesn't reduce coverage,
  just doesn't add any).
- Manual verification: rebuild the debug APK, reload via Metro, screenshot
  the emulator, compare against
  `NewDesign/ChatGPT Image 28 sept. 2026, 13_47_01.png` section by section
  (header, hero, action bar, stats, how-it-works, promo cards), and tap
  through the new tab bar (center button → post-parcel, renamed tab →
  trips content, bell → notifications with the new Messages row).
