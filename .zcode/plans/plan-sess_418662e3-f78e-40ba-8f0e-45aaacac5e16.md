## Phase 9 — Mobile app: foundation + auth flow

Scaffold the Expo/React Native app (`apps/mobile`) and build only the foundation + the auth flow, proving the full mobile ↔ backend loop works against the live API. The remaining 15 screens are Phase 10. Algeria/EUR re-skin is baked in from the start; Tier-1 multi-EUR-country config means corridors are data, not hardcoded.

Per approved decisions: **Expo Router + NativeWind v4 + foundation-only scope.**

### Stack (blueprint-aligned)
- **Expo SDK 52+** (managed workflow, Expo Go for dev)
- **Expo Router v4** (file-based routing, deep-link-ready for push notifications)
- **NativeWind v4** (Tailwind for RN — matches the design board's tokens)
- **TypeScript** strict (matches the monorepo)
- **react-native-svg + SafeArea** (design needs gradients/curves)
- **@react-native-async-storage/async-storage** (JWT persistence)
- **zustand** (lightweight auth store; no Redux overhead for v1)
- Node ≥ 20 (workspace already enforces this)

### Tier-1 multi-country config (the "all Europe → Algeria" decision)
A single `config/corridors.ts` data file — the only place origin/destination/currency lives. No "France" or `EUR` literals anywhere in code.
```ts
export const ORIGIN_COUNTRIES = [
  { code: "FR", name: "France",  currency: "EUR", cities: ["Paris","Lyon","Marseille","Toulouse","Lille"] },
  { code: "DE", name: "Germany", currency: "EUR", cities: ["Berlin","Hamburg","München","Frankfurt"] },
  { code: "ES", name: "Spain",   currency: "EUR", cities: ["Madrid","Barcelona","Valencia","Alicante"] },
  { code: "IT", name: "Italy",   currency: "EUR", cities: ["Roma","Milano","Napoli","Torino"] },
  { code: "BE", name: "Belgium", currency: "EUR", cities: ["Bruxelles","Anvers","Liège"] },
  { code: "NL", name: "Netherlands", currency: "EUR", cities: ["Amsterdam","Rotterdam","La Haye"] },
  // ... +15 more EUR countries
] as const;
export const DESTINATION = { code: "DZ", name: "Algérie", wilayas: [/* 1-58 */] };
```
The backend is already country-agnostic (matching, KYC, address model, customs). The 3 hardcoded `currency: "eur"` literals in `escrow.ts` are a *backend* concern and already accept any EUR value — the mobile never hardcodes currency, it reads from this config. **Adding Germany/Spain/Italy later = adding lines to this file, zero code change.**

### Theme / design tokens (re-skinned from the board)
`tailwind.config.ts` + a `theme/tokens.ts` capturing the design board's palette, localized to the Algeria/EUR market:
```
colors: { navy: "#0B1220", accent-orange: "#FF6A2B", accent-purple: "#6D5AA6", ... }
fonts: { heading: "Space Grotesk", body: "Plus Jakarta Sans" }
```
Re-skinned content: corridors use Paris→Alger / Lyon→Oran / Marseille→Alger (per blueprint edge-cases); personas Karim/Ahmed/Nadia/Youcef; EUR primary. No "Lagos/London/GBP" anywhere.

### File structure (`apps/mobile/`)
```
apps/mobile/
  app.json / app.config.ts        Expo config (name "CrowdShipping", scheme for deep links)
  babel.config.js                  NativeWind + Expo Router presets
  metro.config.js                  NativeWind + monorepo (node_modules path mapping)
  tailwind.config.ts               design tokens → utilities
  global.css                       NativeWind entry
  tsconfig.json                    strict, extends ../../tsconfig.base.json
  package.json                     workspace dep (@crowdshipping/api types via fetch, not direct import)
  src/
    config/corridors.ts            Tier-1 country/currency data (the re-skin)
    theme/tokens.ts                colors, fonts, spacing
    lib/
      api.ts                       fetch wrapper: baseURL, JSON, throws on !ok
      auth.ts                      signup/login/verify/refresh — calls backend /auth/*
      storage.ts                   AsyncStorage get/set/remove (tokens)
    store/auth.ts                  zustand store: user, tokens, isAuthenticated, init()
    components/
      Button.tsx, Input.tsx, Card.tsx, Screen.tsx   design-system primitives
    app/                           Expo Router file routes
      _layout.tsx                  root: AuthGate (redirect based on auth state)
      index.tsx                    splash → redirect to /auth or /home
      auth/
        _layout.tsx                auth stack
        signup.tsx                 POST /auth/signup → navigate to verify
        verify-phone.tsx           POST /auth/verify-phone → store tokens → /home
        login.tsx                  POST /auth/login → store tokens → /home
      home.tsx                     authenticated: GET /me → show "Welcome, {firstName}"
```

### The 6-8 screens in this phase
1. **Splash (`index.tsx`)** — boot, load tokens from AsyncStorage, redirect.
2. **Signup (`auth/signup.tsx`)** — email/phone/password/firstName/lastName → POST `/auth/signup`. Shows dev OTP hint in dev mode.
3. **Verify phone (`auth/verify-phone.tsx`)** — phone + 6-digit code → POST `/auth/verify-phone`. On success stores access+refresh tokens, navigates to home.
4. **Login (`auth/login.tsx`)** — email + password → POST `/auth/login`. Handles the 403 "phone not verified" → redirect to verify.
5. **Home (`home.tsx`)** — the proof screen: GET `/me` with the stored JWT, render "Bienvenue {firstName}" + KYC badge + a logout button.
6. **Root `_layout.tsx`** — the AuthGate: `<Slot/>` wrapped in a redirect based on `useAuth().isAuthenticated`.
7. *(componentry)* Button/Input/Card/Screen primitives shared across all future screens.

### API client (`lib/api.ts`)
- Base URL from env (`EXPO_PUBLIC_API_URL` → `http://localhost:4000` in dev). One constant, no hardcoded host.
- `apiFetch(path, opts)`: sets `Content-Type`, attaches `Authorization: Bearer <token>` from the auth store, throws a typed `ApiError` on non-2xx with `{ status, error }`.
- Token refresh hook: on 401, attempt `/auth/refresh` once, retry the original request, else clear auth → redirect to login. Encapsulated so every screen benefits without per-call logic.

### Wiring the monorepo
- Add `apps/mobile` to pnpm workspace (already filtered in root `package.json` build script).
- `metro.config.js` with `watchFolders` pointing at repo root so changes to `@crowdshipping/*` packages (if mobile ever imports them — it won't in v1, but the path is open) are picked up.
- `.env` / `EXPO_PUBLIC_API_URL` documented in `.env.example`.

### Validation
- `pnpm --filter @crowdshipping/mobile typecheck` passes (tsc strict).
- `pnpm --filter @crowdshipping/mobile start` boots Expo; can open in Expo Go.
- **End-to-end smoke**: create an account from the app → receive dev OTP → verify → see the authenticated home screen with the real `/me` response from the live Neon-backed API. This is the de-risk milestone — it proves the whole stack (mobile → API → Postgres) talks to each other.

### Explicit v1 deferrals (Phase 10+)
- The other 15 screens (browse, post parcel, matching, escrow checkout, chat, tracking, delivery PIN, profile/wallet, notifications, settings).
- Push notification registration (the `POST /notifications/device-token` call — Phase 7 backend is ready, mobile wires it when the home screen exists and beyond).
- Offline / low-signal handling (blueprint domestic edge-case #3 — separate design).
- E2E tests (Detox / Maestro — after the screens stabilize).
- The `apps/admin` Next.js dashboard (separate phase).

### Commit
Single commit: `Phase 9: mobile app foundation (Expo Router + NativeWind) + auth flow`.