# DiasporaCart redesign — design system + screen overhaul

## Context

The mobile app (`apps/mobile`) currently implements the **Aurora** visual
system (dark/bright glassmorphism, orange accent `#FF6A2B`/`#FF5A1F`,
English copy, tab bar "Browse/Send/Trips/You") — see
`design/design_handoff_crowshi_aurora/README.md` and
`src/theme/tokens.ts`. This is a prior design pass, fully wired into
`tailwind.config.ts` and every component.

The product owner supplied two new references superseding Aurora:

1. A 57-section written brief (`MISSION` doc) defining a **"Mediterranean
   Premium / Diaspora"** direction: a crowdshipping marketplace connecting
   travelers (spare luggage space) with senders (parcels) to/from Algeria,
   aimed at the Algerian diaspora. Warm, premium, trustworthy tone; green/sand
   palette; French copy; specific screen-by-screen content and component
   list.
2. A visual mockup board (`design/ChatGPT Image 16 sept. 2026, 11_02_16.png`)
   branded **"DiasporaCart"**, showing: brand cover, Home (hero + dual
   intent), popular corridors + world map, add-trip wizard, traveler profile,
   chat, my requests, tracking, dashboard, brand/app-store panels, and a
   "Direction artistique" swatch card (exact colors, type, icon style).

Decisions locked in with the user before this spec (see brainstorming
session):

- **Rebrand**: app becomes "DiasporaCart" everywhere (app.json, copy, store
  listing later).
- **Aurora is retired entirely** — no dual-theme, no fallback. Single light
  theme.
- **i18n**: both `fr.ts` (primary/reference copy) and `en.ts` (kept in sync)
  are updated.
- **Execution rhythm**: phase by phase (mirroring the brief's own phase
  breakdown), showing progress after each phase rather than after each
  screen. Pause only on business-rule decisions the code can't answer
  (real prices, customs rules, guarantees, payment methods) — flag with
  `TODO — information métier nécessaire` per brief §46/57, never invent.
- **Navigation restructure approved**: 5 bottom tabs (Accueil · Rechercher ·
  Mes voyages · Messages · Profil), FAB/chooser modal removed, publish
  actions reached via Home hero CTAs / Mes voyages instead.

## Non-goals

- No backend/API changes. This is a visual + navigation-structure pass over
  the existing data model and endpoints (per brief §1: preserve business
  logic).
- No dark mode in this pass — deferred, not precluded. See note under
  "Design tokens" on keeping the token architecture mode-ready.
- No invented business rules (pricing, insurance, customs, verification
  claims) — see brief §46/57. Anything not backed by real app data/logic
  gets a `TODO` marker or clearly-mocked demo data, and is flagged to the
  user rather than guessed.
- Store listing / marketing site rebrand is out of scope — in-app only.

## Design tokens (Phase 1 foundation)

Single light theme, replacing `THEME_COLORS` dark/bright pair in
`src/theme/tokens.ts` and the corresponding CSS vars wired through
`tailwind.config.ts` / `ThemeProvider.tsx`.

**Future dark mode**: the CSS-custom-property mechanism Aurora used
(`ThemeProvider` swapping values via NativeWind's `vars()`) is kept intact —
only the *values* collapse to one mode for now, not the switching
mechanism. Components must keep referencing token classNames
(`bg-base`, `text-primary`, …), never hardcoded hex. This means a dark
variant can be added later as a second value set + re-enabling the mode
switch, without touching component code.

| Token | Value | Source |
|---|---|---|
| `bg.base` | `#F8F6F1` | mockup swatch (Beige) |
| `surface.card` | `#FFFFFF` | mockup |
| `green.deep` (primary/CTA) | `#0F5D3B` | mockup swatch |
| `green.olive` (secondary accent) | `#688B5B` | mockup swatch |
| `sand` | `#EADCC8` | mockup swatch |
| `accent.red` (destructive only) | `#D64545` | mockup swatch |
| `green.tint` (success/badge bg) | `#E3ECE1` | derived tint of `green.olive` |
| `text.primary` | `#16241C` | derived (warm near-black) |
| `text.secondary` | `#5B6B62` | derived |
| `text.muted` | `#8B968F` | derived |
| `border.hairline` | `#E7E2D6` | derived (light sand) |

Radius: card `20px`, field `14px`, pill `999px`, avatar `50%`.
Shadows: single light elevation, e.g. `0 4px 12px rgba(15,93,59,0.06)` — no
stacked shadows, no blur/glass effects (Aurora's blur mechanism is removed).
Spacing: screen edge `20px`, card padding `16px`, stack gap `12px`, section
gap `20px`.

**Typography**: `Plus Jakarta Sans` (already loaded via
`@expo-google-fonts/plus-jakarta-sans`) for headings/buttons/numerals;
`Inter` (new dependency, `@expo-google-fonts/inter`) for body/UI text.
`Space Grotesk` and `IBM Plex Mono` loading is removed from
`src/lib/fonts.ts` (Aurora-only, no longer referenced).

Type scale: Hero 32/38 (Home headline), Screen title 22–24, H2 18, Body 16,
Small 13–14, Numeral (money/stats, Plus Jakarta Sans 700) 24–28.

**Icons**: keep `Ionicons` (`@expo/vector-icons`, already used throughout),
`-outline` variants for the simple/soft-rounded look brief §30 asks for. No
new icon library.

## Component changes (Phase 1)

Rebuilt in place (same files, same or minimally-adjusted props) so all
screens inherit the new look without duplicating component trees:
`Button`, `Card`, `Input`, `Select`, `Avatar`, `StatusPill`, `Stepper`,
`Screen`, `ScreenHeader`, plus the domain cards (`TripCard`, `MatchCard`,
`ParcelCard`, `CampaignCard`) restyled to the new token set and the "Trip
card" / rating / verified-badge visual recipe from the brief (§17–18).

`EmptyState` gets the humane-copy treatment from brief §33 (no more literal
"No data found"), `AuthWall`/`OfflineBanner` restyled to match.

## Navigation restructure (Phase 1/2 boundary)

Current: `app/(tabs)/_layout.tsx` — 3 tabs (Accueil/Messages/Profil) + center
FAB opening a modal chooser (send parcel / post trip / post campaign).

New: 5 tabs — Accueil · Rechercher · Mes voyages · Messages · Profil.
- FAB and chooser modal removed.
- New route `app/(tabs)/search.tsx`: the conversational search form (départ /
  destination / quand / poids approximatif) → results, per brief §16–17.
  Does not exist today — Home currently does inline trip browsing instead of
  a dedicated search flow.
- New route `app/(tabs)/trips.tsx` wraps/relocates the existing
  `app/my-trips.tsx` content into the tab shell.
- Publish actions (`post-trip`, `post-parcel`, `post-campaign`) reached from
  Home hero CTAs ("Ajouter mon voyage" / "Je cherche un voyageur") and from
  the Mes voyages screen, not from a FAB.

## Screen-by-phase plan

Mirrors brief §48, mapped to actual files in `apps/mobile`:

| Phase | Scope | Key files |
|---|---|---|
| 0 | Audit (done — this doc) | — |
| 1 | Tokens, fonts, base + domain components, nav shell | `src/theme/tokens.ts`, `tailwind.config.ts`, `src/theme/ThemeProvider.tsx`, `src/lib/fonts.ts`, `src/components/*`, `app/(tabs)/_layout.tsx` |
| 2 | Home: hero, dual intent (Je voyage / J'envoie), popular corridors, world-map section, trust section, community section | `app/(tabs)/index.tsx` |
| 3 | Recherche, résultats, matching | `app/(tabs)/search.tsx` (new), `app/matching/[parcelId].tsx`, `TripCard`/`MatchCard` reuse |
| 4 | Transaction: offres, messagerie, paiement | `app/chat/[parcelId].tsx`, `app/escrow/[parcelId].tsx`, `app/post-trip.tsx`, `app/post-parcel.tsx` (wizard steps per brief §19–20) |
| 5 | Tracking, notifications, delivery | `app/tracking/[parcelId].tsx`, `app/notifications.tsx`, `app/delivery/[parcelId].tsx` |
| 6 | Compte: profil, dashboard, mes voyages, paramètres | `app/(tabs)/profile.tsx`, `app/(tabs)/trips.tsx` (new), `app/settings.tsx` |
| 7 | Polish: responsive pass, animations, loading/empty/error states, accessibility, perf | global pass across all screens |

i18n: `src/locales/fr.ts` updated as the reference copy per the brief's
tone (§42), `src/locales/en.ts` updated in parallel with equivalent English
copy.

## Quality bar (applied after each phase)

Per brief §53–54, before calling a phase done, self-review each touched
screen against: comprehension (3-second test), hierarchy, trust, clarity of
next action, consistency with other screens, premium feel, mobile
correctness — and explicitly ask what still looks generic/Bootstrap-like,
too busy, too empty, or missing Algerian identity, then fix before moving
on.

## Testing

Existing component/screen tests (`jest.config.js` present) get updated
where they assert on removed Aurora-specific classNames/tokens or the
removed FAB; no new test infra introduced. Visual correctness is verified
by comparison against the mockup board and brief content per screen, since
there's no visual regression tooling in this repo today.
