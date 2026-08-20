# Handoff: Crowshi — Aurora design system (dark + bright)

Rewire the existing CrowdShipping app to the **Aurora** visual system. The app's features, routes and data model do not change — this is a visual + light-flow refresh. Two themes ship: **dark** (default) and **bright**, driven from one token set.

## Files in this package
- `Crowshi Aurora.dc.html` — **the authority.** Three screens rendered in both modes: first-run, browse trips, confirm & pay. Every value in this doc is measured from it. Open in a browser to view.
- `Crowshi App.dc.html` — the earlier 20-screen inventory. Use it **for screen structure and copy only**, not for styling (it's the old glassmorphism pass being replaced).
- `tokens.json` — the token set below, machine-readable, both modes.
- `ios-frame.jsx` — the device frame used for mocking. Reference only; not app code.

## About the design files
These are HTML design references built in an in-house component runtime (`<x-import>`, `{{ }}` bindings). They will **not** run in the app. Recreate the design in the app's own stack — respect the existing app spec, navigation, state management and component conventions; do not restructure the codebase to match the mock's markup.

**Fidelity: high.** Colors, type, spacing, radii and blur values are final — match them numerically.

## Theming rules
1. One token set, two modes. Every surface, text and border color resolves through a token; no hardcoded hex in components.
2. Mode is a user setting with a system-default option; persist it. All 21 screens must render correctly in both.
3. The accent shifts between modes: **dark `#FF6A2B`** (near-black text on it) → **bright `#FF5A1F`** (white text on it). This is deliberate — orange on white needs the darker tone for contrast, and orange-on-navy needs the lighter one.

## Tokens

### Dark mode
| Token | Value |
|---|---|
| `bg.base` | `#0A0F1A` → `#070B14` vertical gradient |
| `bg.aurora.warm` | `rgba(255,106,43,0.16)` radial / `0.55` in a blurred band |
| `bg.aurora.cool` | `rgba(159,140,255,0.16)` radial / `0.40` in a band |
| `surface.glass` | `rgba(255,255,255,0.045)` |
| `surface.glass.raised` | `rgba(255,255,255,0.065)` |
| `surface.glass.strong` | `rgba(255,255,255,0.07)` |
| `border.hairline` | `rgba(255,255,255,0.10)` |
| `border.hairline.raised` | `rgba(255,255,255,0.14)` |
| `border.hairline.strong` | `rgba(255,255,255,0.16)` |
| `highlight.top` | inset `0 1px 0 rgba(255,255,255,0.12–0.16)` |
| `shadow.card` | `0 12px 28px rgba(0,0,0,0.32)` |
| `text.primary` | `#F7F9FC` |
| `text.secondary` | `#98A5BC` |
| `text.muted` | `#7C8AA5` |
| `text.oncard` | `#C6D0E2` |
| `accent` | `#FF6A2B` · on-accent `#0B1220` |
| `accent.text` | `#FF8A4F` (accent used as text/numerals) |
| `success` | `#4CE0AE` on `rgba(52,211,153,0.14)`, border `rgba(52,211,153,0.30)` |
| `info` (escrow/trust) | `#CDC4F0` on `rgba(159,140,255,0.10)`, border `rgba(159,140,255,0.24)` |
| `chrome.bar` | `rgba(10,15,26,0.72)` + blur 20 |

### Bright mode
| Token | Value |
|---|---|
| `bg.base` | `#FBFCFF` → `#EFF2F9` vertical gradient |
| `bg.aurora.warm` | `rgba(255,90,31,0.14)` radial / `0.40` in a band |
| `bg.aurora.cool` | `rgba(109,90,166,0.14)` radial / `0.28` in a band |
| `surface.glass` | `rgba(255,255,255,0.60)` |
| `surface.glass.raised` | `rgba(255,255,255,0.72)` |
| `border.hairline` | `rgba(255,255,255,0.90)` over base |
| `border.divider` | `#E4E9F2` |
| `highlight.top` | inset `0 1px 0 rgba(255,255,255,0.90)` |
| `shadow.card` | `0 8px 22px rgba(11,18,32,0.06)`; raised `0 12px 28px rgba(11,18,32,0.08)` |
| `text.primary` | `#0B1220` |
| `text.secondary` | `#5A6779` |
| `text.muted` | `#7A8698` |
| `text.oncard` | `#48566B` |
| `accent` | `#FF5A1F` · on-accent `#FFFFFF` |
| `accent.text` | `#FF5A1F` |
| `success` | `#0E9F6E` on `#E4F7EE`, border `#BFE9D6` |
| `info` (escrow/trust) | `#54468A` on `rgba(109,90,166,0.10)`, border `rgba(109,90,166,0.22)` |
| `chrome.bar` | `rgba(255,255,255,0.75–0.80)` + blur 20, top border `#E4E9F2` |
| `neutral.chip` | `rgba(11,18,32,0.05)`, border `#E4E9F2`, text `#48566B` |

### Shared (mode-independent)
- **Blur**: `18px` on content glass, `20px` on chrome (nav/tab/footer bars). Saturate `140%` where a card sits over an aurora band. **Never above 20px** — the previous design's 16–24px + 180% saturate is what made it look noisy.
- **Radii**: card `20`, field/chip container `16`, pill `999`, avatar `50%`, tab icon `7`.
- **Spacing**: screen edge `20` (`28` on first-run), card padding `16`, stack gap `12`, section gap `14`, header bottom `16`.
- **Safe area**: content starts **64–72px** below the top of the screen (status bar + dynamic island). Footer CTA blocks pad `30px` at the bottom for the home indicator.
- **Elevation is one step only.** A screen has at most one "raised" card (the primary/best-match one). Everything else is flat glass. No stacked shadows.

### Type
| Role | Font | Size / weight |
|---|---|---|
| Hero headline | Space Grotesk 700 | 42 / lh 1.02 / ls -0.035em |
| Screen title | Space Grotesk 700 | 20–26 / ls -0.025 to -0.03em |
| Large numeral (money) | Space Grotesk 700 | 28–30 / ls -0.02em |
| Route code (LOS/LHR) | Space Grotesk 700 | 20 / ls -0.02em |
| Card title / name | Plus Jakarta Sans 700 | 14–16 |
| Body | Plus Jakarta Sans 400–500 | 13–15 / lh 1.5–1.55 |
| Button label | Plus Jakarta Sans 800 | 16 |
| Meta / eyebrow | IBM Plex Mono 500–600 | 10.5–11 / ls 0.05–0.12em / uppercase |

IBM Plex Mono is new and load-bearing: all ratings, trip counts, timestamps, step counters and eyebrow labels are mono uppercase. That single choice does most of the "not generic" work — keep it.

## Component recipes

**Glass card** — `surface.glass` + `1px border.hairline` + blur 18 + radius 20 + padding 16 + `highlight.top`. Raised variant: `.raised` surface, `.raised` border, `shadow.card`.

**Primary button** — accent fill, on-accent text, PJS 800/16, padding 17, radius 16, glow shadow `0 10px 26–30px rgba(accent, 0.26–0.28)`.

**Secondary button** — `surface.glass` + `border.hairline` + blur 18, `text.primary`, weight 700, same metrics as primary.

**Chip row** — single-select. Active: accent fill + on-accent text, weight 800. Inactive: glass + hairline, `text.oncard`, weight 600. Radius 999, padding 8/14, size 13.

**Trip card** — three bands, top to bottom: (1) avatar 34px + name + mono `RATING · N TRIPS`, with a free-capacity badge right-aligned (success tint on the best card, neutral chip otherwise); (2) route line — origin code, 1–2px connector (accent→cool gradient on the featured card, `border` flat otherwise), destination code; (3) departure datetime left, `$N/kg` right with `/kg` in muted.

**Fee/summary card** — label/value rows at 14, values weight 600–700, `1px` divider, then a total row where the amount is the Space Grotesk 28–30 numeral in `accent.text` and the label carries a one-line explainer in muted 12.

**Trust banner** — `info` tint + border, radius 16, 20px icon square in the info color, 12.5px copy at lh 1.5. Used for escrow explanation and any safety messaging.

**Payment method row** — glass card with the accent as its border when selected (`1.5px` in bright, `rgba(accent,0.4)` in dark), 34×24 card thumb, name + balance, and a 20px radio filled with a 6px accent ring.

**Tab bar** — `chrome.bar` + blur 20, top hairline, 4 items, 22px rounded-square icon + 11px label. Active icon accent-filled, label weight 800 in `accent.text`; inactive icon `rgba(255,255,255,0.14)` / `#DCE2ED`, label muted weight 600. Labels are **Browse · Send · Trips · You**.

**Aurora background** — the mode's base gradient, plus 1–2 blurred bands (`filter: blur(64–74px)`, rotated -18° / +12°, positioned off-canvas edges) or two soft radials. On native: pre-render as a gradient layer/image behind content rather than live-blurring shapes at runtime.

## Flow changes to implement
The redesign shortens the sender path. Respect the app spec's data requirements, but recombine the UI:

1. **Match + pay merge.** The old "Matches found" → "Escrow checkout" pair becomes one two-step flow labelled `STEP 1 OF 2` / `STEP 2 OF 2`. Step 2 (`Confirm & pay`) shows carrier + verification badge, fee breakdown with escrow total, the trust banner, and the payment method — one screen, one CTA `Pay $33.10 into escrow` with the live amount in the label.
2. **Browse leads with intent.** The home screen opens with `SENDING FROM <origin>` / **Where to?** and a destination field, not a generic greeting + search. Trip results sit directly beneath.
3. **Tab bar renamed** to Browse / Send / Trips / You (was Browse / Post / Trips / Profile).
4. **Verified state is surfaced at the decision point** — the `ID VERIFIED` badge belongs next to the carrier's name wherever a sender is about to commit money, not only on the verification screen.
5. **Route codes everywhere.** Trips are identified by IATA-style code pairs (`LOS → LHR`) with the human city names as secondary. Derive codes from the existing route data; fall back to city names when no code exists.

## Screens to rewire
The three in `Crowshi Aurora.dc.html` are built and final: **first-run**, **browse trips**, **confirm & pay (step 2)**. Apply the same system to the rest, keeping each screen's existing purpose and content from `Crowshi App.dc.html`:

| Screen | Notes for the Aurora pass |
|---|---|
| Sign up / log in | Fields = glass card rows, radius 16; single primary CTA; mono eyebrow for step counters. |
| Post a shipment | Route rows, then two-up weight/category glass cards, photo upload as a dashed-border glass block, budget as an accent numeral in a raised card. Sticky footer CTA on `chrome.bar`. |
| Matches (step 1 of 2) | List of trip cards; exactly one raised/featured card carrying a `BEST MATCH` mono badge in the success tint. |
| Tracking | Map region full-bleed behind a glass status card; timeline dots in accent (done) and hairline (pending). |
| Chat | Incoming bubbles = glass; outgoing = accent fill with on-accent text; composer on `chrome.bar`. |
| Verification | Four checklist rows: done = success tint icon, active = accent border, locked = flat glass at reduced opacity with a mono step number. |
| Notifications | Glass rows with a 20px tinted icon square (accent / info / success by type); read state at 60% opacity. |
| Profile & wallet | Balance as a Space Grotesk numeral in a raised card; list rows on flat glass with hairline dividers. |
| Traveler: post trip | Mirrors post-a-shipment; capacity + rate two-up; category chips reuse the chip row. |
| Traveler: earnings | Big total numeral + three-up stat row in mono labels; payout rows with `+$` amounts in success. |
| Delivery confirmation | Proof-photo block, 5-star row in accent, CTA `Confirm & release payment`. |
| Settings | Grouped glass sections with hairline dividers; toggles accent-on / neutral-off; destructive row in a red that meets 4.5:1 in both modes. |
| Filters, empty state, report issue, notification permission | Existing structure, Aurora surfaces; empty state = 1 glass icon circle, headline, one primary + one text CTA. |

## Accessibility
- All body text must hit 4.5:1 against its **actual glass surface over the aurora band**, not against the flat base color — check the worst case (text over the brightest part of a band).
- Never put on-accent white text on `#FF6A2B` (fails); use `#FF5A1F` in bright mode as specified.
- Hit targets ≥ 44pt. Chips at 8/14 padding hit 34px — pad the touch area, not the visual.
- Don't rely on the aurora glow to communicate anything; it's decorative.

## Do not
- Do not raise blur past 20px or reintroduce `saturate(180%)` everywhere.
- Do not apply glass to every surface in bright mode — text-heavy content sits on `surface.glass.raised` so it stays legible.
- Do not add per-card colored left borders (the old design's category accents) — capacity badges and the route connector carry that signal now.
- Do not invent new colors. If something needs a new token, add it to `tokens.json` and flag it.
