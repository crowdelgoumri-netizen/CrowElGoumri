# DiasporaCart Redesign — Phase 1: Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Aurora dark/bright glassmorphism design system with the
single light "Mediterranean Premium / Diaspora" theme (DiasporaCart palette,
Plus Jakarta Sans + Inter typography) at the token/font/base-component level,
so every existing screen in `apps/mobile` inherits the new look with zero
per-screen visual rewrites. Screen content/layout rewrites (Home, Search,
Matching, etc.) are separate follow-up plans (Phase 2 onward).

**Architecture:** Pure token-value swap, not a component rewrite. Every
component already reads colors exclusively through Tailwind/NativeWind
classNames (`bg-accent`, `text-oncard`, …) or `useThemeColors()` — never a
hardcoded hex (confirmed by repo-wide grep; only one violation found, fixed
in Task 6). This means changing the *values* behind `THEME_COLORS`, the CSS
vars in `tailwind.config.ts`/`ThemeProvider.tsx`/`global.css`, and the loaded
font files is sufficient to re-skin the whole app. Field/class names are
kept stable wherever the underlying concept still applies (e.g. `accent`,
`success`, `glassBg`) so no downstream component needs an edit; only fields
tied to retired Aurora-only concepts (aurora gradient bands, the extra
"-strong" hairline variant, the dark/bright mode switch itself) are removed.
The bottom-tab navigation restructure (5 tabs, dropping the FAB) described in
the spec is deferred to the Phase 2 (Home) and Phase 6 (Mes voyages) plans,
since it depends on screens (`search.tsx`, `trips.tsx`) that don't exist yet
— today's 3-tab shell and FAB already re-skin for free from this plan's
token change, so nothing breaks in the interim.

**Tech Stack:** Expo Router, NativeWind (Tailwind for React Native), Zustand,
`@expo-google-fonts/*`, Jest (`jest-expo` preset).

**Spec:** `docs/superpowers/specs/2026-09-21-diasporacart-redesign-design.md`

## Global Constraints

- Palette (exact, from the spec): `bg.base #F8F6F1`, `surface.card #FFFFFF`,
  `green.deep #0F5D3B` (primary), `green.olive #688B5B`, `sand #EADCC8`,
  `accent.red #D64545` (destructive only), derived `green.tint #E3ECE1`,
  `text.primary #16241C`, `text.secondary #5B6B62`, `text.muted #8B968F`,
  `border.hairline #E7E2D6`.
- Single light theme only — no dark mode in this pass. Keep the
  CSS-custom-property + `ThemeProvider`/`vars()` switching mechanism intact
  (values collapse to one key, `"light"`) so a dark variant can be added
  later as a values-only addition — never inline a literal hex in a
  component; everything resolves through `THEME_COLORS` / Tailwind classes.
- Typography: `Plus Jakarta Sans` for headings/buttons/numerals, `Inter` for
  body/UI text. No more `Space Grotesk` or `IBM Plex Mono`.
- No backend/API changes, no business-rule invention (brief §46/57).
- Follow existing repo conventions: `pnpm --filter @crowdshipping/mobile
  <script>` to run scripts scoped to this workspace; tests live under
  `__tests__/` per existing convention; TDD (failing test → minimal
  implementation → passing test → commit) for every task with real
  behavior to assert.

---

### Task 1: Rewrite design tokens (`src/theme/tokens.ts`)

**Files:**
- Modify: `apps/mobile/src/theme/tokens.ts` (full rewrite)
- Test: `apps/mobile/src/theme/__tests__/tokens.test.ts` (new)

**Interfaces:**
- Produces: `ColorScheme = "light"`, `ThemeColors` interface (fields below),
  `THEME_COLORS: Record<ColorScheme, ThemeColors>`. `bgBase` changes type
  from `readonly [string, string]` (gradient tuple) to `string` (flat
  color) — Task 4 updates the two call sites that index it.
- Removed from the interface (Aurora-only, unused elsewhere per repo grep):
  `auroraWarm`, `auroraWarmBand`, `auroraCool`, `auroraCoolBand`,
  `glassBorderStrong`. Also removes the unused `tokens` (blur/spacing/
  safeArea — duplicated dead JS, real values live in `tailwind.config.ts`)
  and `PERSONAS` exports (grepped repo-wide: zero consumers of either).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/theme/__tests__/tokens.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { THEME_COLORS } from "../tokens";

describe("THEME_COLORS.light", () => {
  it("uses the DiasporaCart palette for primary brand colors", () => {
    expect(THEME_COLORS.light.accent).toBe("#0F5D3B");
    expect(THEME_COLORS.light.bgBase).toBe("#F8F6F1");
    expect(THEME_COLORS.light.danger).toBe("#D64545");
  });

  it("bgBase is a flat color, not a gradient tuple", () => {
    expect(typeof THEME_COLORS.light.bgBase).toBe("string");
  });

  it("has no leftover Aurora-only fields", () => {
    expect(THEME_COLORS.light).not.toHaveProperty("auroraWarm");
    expect(THEME_COLORS.light).not.toHaveProperty("auroraCool");
    expect(THEME_COLORS.light).not.toHaveProperty("glassBorderStrong");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/mobile test -- tokens.test.ts`
Expected: FAIL — `THEME_COLORS.light` is `undefined` (only `dark`/`bright`
keys exist today), so every assertion throws.

- [ ] **Step 3: Write the minimal implementation**

Replace the full contents of `apps/mobile/src/theme/tokens.ts` with:

```ts
/**
 * DiasporaCart design tokens — single source of truth for JS-accessible
 * color values (single light theme). See
 * docs/superpowers/specs/2026-09-21-diasporacart-redesign-design.md for the
 * palette rationale and the future-dark-mode note.
 *
 * Tailwind/NativeWind covers colors, fonts, radii, and spacing via
 * tailwind.config.ts (className on components) — those color values are
 * CSS custom properties that get swapped by ThemeProvider using
 * NativeWind's `vars()`. This file is for values Tailwind can't express
 * (shadow strings) AND for raw color access in places that take a literal
 * color prop instead of className (icon `color=`, `tintColor`,
 * `shadowColor`, RefreshControl, Switch track/thumb, etc.) — use
 * `useThemeColors()` for those, never a hardcoded hex.
 */
export type ColorScheme = "light";

export interface ThemeColors {
  bgBase: string;
  glassBg: string;
  glassRaised: string;
  glassStrong: string;
  glassBorder: string;
  glassBorderRaised: string;
  divider: string;
  shadowCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnCard: string;
  accent: string;
  accentOn: string;
  accentText: string;
  accentGlow: string;
  successText: string;
  successBg: string;
  successBorder: string;
  infoText: string;
  infoIcon: string;
  infoBg: string;
  infoBorder: string;
  chipBg: string;
  chipBorder: string;
  chromeBar: string;
  chromeBorder: string;
  tabInactive: string;
  danger: string;
  /** Placeholder / disabled input text. */
  placeholder: string;
}

const light: ThemeColors = {
  bgBase: "#F8F6F1",
  glassBg: "#FFFFFF",
  glassRaised: "#FFFFFF",
  glassStrong: "#FFFFFF",
  glassBorder: "#E7E2D6",
  glassBorderRaised: "rgba(15,93,59,0.30)",
  divider: "#E7E2D6",
  shadowCard: "0 4px 12px rgba(15,93,59,0.06)",
  textPrimary: "#16241C",
  textSecondary: "#5B6B62",
  textMuted: "#8B968F",
  textOnCard: "#2A3B31",
  accent: "#0F5D3B",
  accentOn: "#FFFFFF",
  accentText: "#0F5D3B",
  accentGlow: "0 10px 24px rgba(15,93,59,0.22)",
  successText: "#0F5D3B",
  successBg: "#E3ECE1",
  successBorder: "rgba(15,93,59,0.24)",
  infoText: "#5B6B62",
  infoIcon: "#688B5B",
  infoBg: "#EFEAE0",
  infoBorder: "#E7E2D6",
  chipBg: "#F3EFE7",
  chipBorder: "#E7E2D6",
  chromeBar: "#FFFFFF",
  chromeBorder: "#E7E2D6",
  tabInactive: "#B9C2B7",
  danger: "#D64545",
  placeholder: "#8B968F",
};

export const THEME_COLORS: Record<ColorScheme, ThemeColors> = { light };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/mobile test -- tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/theme/tokens.ts apps/mobile/src/theme/__tests__/tokens.test.ts
git commit -m "Mobile: replace Aurora tokens with DiasporaCart light palette"
```

---

### Task 2: Tailwind config, global CSS fallback, font packages

**Files:**
- Modify: `apps/mobile/tailwind.config.ts`
- Modify: `apps/mobile/global.css`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: nothing new (pure config/value changes).
- Produces: the same Tailwind color/font/radius/spacing keys as before
  (`accent`, `success`, `hairline`, `font-heading`, `font-body`, `font-mono`,
  `rounded-card`, `p-card-padding`, …) so **no component className string
  needs to change** — only `hairline-strong`, `aurora-warm`,
  `aurora-warm-band`, `aurora-cool`, `aurora-cool-band` color keys are
  removed (grepped repo-wide: unused).
- `danger` moves from a hardcoded literal (`"#EF4444"`) to a CSS var
  (`var(--color-danger)`), matching every other color's "resolve through a
  token" rule.

- [ ] **Step 1: Update `apps/mobile/tailwind.config.ts`**

Replace the `colors` and `fontFamily` blocks (the `borderRadius`/`spacing`/
`fontSize` blocks are unchanged — they're not Aurora-specific):

```ts
      colors: {
        base: "var(--color-bg-base)",
        glass: "var(--color-glass)",
        "glass-raised": "var(--color-glass-raised)",
        "glass-strong": "var(--color-glass-strong)",
        hairline: "var(--color-glass-border)",
        "hairline-raised": "var(--color-glass-border-raised)",
        divider: "var(--color-divider)",
        chrome: "var(--color-chrome-bar)",
        "chrome-border": "var(--color-chrome-border)",
        "tab-inactive": "var(--color-tab-inactive)",
        // Text
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        "text-oncard": "var(--color-text-oncard)",
        // Short-form aliases. Components use the intuitive short classes
        // (text-oncard, bg-success/20, text-info…) rather than the doubled
        // forms the *-text/*-bg keys above would generate — map them to the
        // text-grade vars; the /opacity modifier handles tint backgrounds.
        oncard: "var(--color-text-oncard)",
        success: "var(--color-success-text)",
        info: "var(--color-info-text)",
        // Accent
        accent: "var(--color-accent)",
        "accent-on": "var(--color-accent-on)",
        "accent-text": "var(--color-accent-text)",
        // Semantic
        "success-text": "var(--color-success-text)",
        "success-bg": "var(--color-success-bg)",
        "success-border": "var(--color-success-border)",
        "info-text": "var(--color-info-text)",
        "info-icon": "var(--color-info-icon)",
        "info-bg": "var(--color-info-bg)",
        "info-border": "var(--color-info-border)",
        // Neutral chips
        "chip-bg": "var(--color-chip-bg)",
        "chip-border": "var(--color-chip-border)",
        // Functional
        danger: "var(--color-danger)",
      },
      fontFamily: {
        heading: ["PlusJakartaSans", "system-ui"],
        body: ["Inter", "system-ui"],
        // "mono" is a legacy key name for the meta/eyebrow text style
        // (ratings, timestamps, step counters); it's no longer monospace
        // in this design, just Inter — kept so the ~10 existing
        // `font-mono` classNames across components don't need renaming.
        mono: ["Inter", "system-ui"],
      },
```

Also update the file's top comment (currently describes the Aurora
dark/bright mechanism) to:

```ts
/**
 * Tailwind / NativeWind config — DiasporaCart design system (single light
 * theme).
 *
 * Every color resolves through a CSS custom property (`var(--color-*)`)
 * instead of a literal value — src/theme/ThemeProvider.tsx sets the actual
 * values via NativeWind's `vars()`, so className usage across screens
 * stays stable if a second (e.g. dark) mode is added later. The var names
 * here and the keys ThemeProvider sets must match exactly; both are
 * generated from src/theme/tokens.ts's THEME_COLORS, the single source of
 * truth.
 */
```

- [ ] **Step 2: Update `apps/mobile/global.css`**

Replace the `@layer base { :root { ... } }` block with:

```css
/**
 * NativeWind entry — @tailwind directives + DiasporaCart base layer.
 *
 * Static :root fallback for the CSS custom properties tailwind.config.ts's
 * colors resolve through. src/theme/ThemeProvider.tsx overrides these at
 * runtime via NativeWind's vars() once the theme store hydrates; this
 * :root block exists so styling is correct from first paint, before that
 * runtime override lands.
 */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-bg-base: #F8F6F1;
    --color-glass: #FFFFFF;
    --color-glass-raised: #FFFFFF;
    --color-glass-strong: #FFFFFF;
    --color-glass-border: #E7E2D6;
    --color-glass-border-raised: rgba(15,93,59,0.30);
    --color-divider: #E7E2D6;
    --color-chrome-bar: #FFFFFF;
    --color-chrome-border: #E7E2D6;
    --color-tab-inactive: #B9C2B7;
    --color-text-primary: #16241C;
    --color-text-secondary: #5B6B62;
    --color-text-muted: #8B968F;
    --color-text-oncard: #2A3B31;
    --color-accent: #0F5D3B;
    --color-accent-on: #FFFFFF;
    --color-accent-text: #0F5D3B;
    --color-success-text: #0F5D3B;
    --color-success-bg: #E3ECE1;
    --color-success-border: rgba(15,93,59,0.24);
    --color-info-text: #5B6B62;
    --color-info-icon: #688B5B;
    --color-info-bg: #EFEAE0;
    --color-info-border: #E7E2D6;
    --color-chip-bg: #F3EFE7;
    --color-chip-border: #E7E2D6;
    --color-danger: #D64545;
  }
}
```

(The old `.bg-aurora` gradient utility class is removed — it had zero
consumers per repo grep, and there's no gradient in this design.)

- [ ] **Step 3: Update font dependencies in `apps/mobile/package.json`**

In the `dependencies` block, replace:

```json
    "@expo-google-fonts/ibm-plex-mono": "^0.4.1",
    "@expo-google-fonts/plus-jakarta-sans": "^0.4.2",
    "@expo-google-fonts/space-grotesk": "^0.4.1",
```

with:

```json
    "@expo-google-fonts/inter": "^0.4.1",
    "@expo-google-fonts/plus-jakarta-sans": "^0.4.2",
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install` (repo root)
Expected: lockfile updates, no errors; `@expo-google-fonts/inter` resolves,
`ibm-plex-mono`/`space-grotesk` are removed from `node_modules` and the
lockfile.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/tailwind.config.ts apps/mobile/global.css apps/mobile/package.json pnpm-lock.yaml
git commit -m "Mobile: repoint Tailwind theme + font deps to DiasporaCart palette"
```

---

### Task 3: Swap loaded fonts (`src/lib/fonts.ts`)

**Files:**
- Modify: `apps/mobile/src/lib/fonts.ts` (full rewrite)

**Interfaces:**
- Consumes: `@expo-google-fonts/inter`, `@expo-google-fonts/plus-jakarta-sans`
  (Task 2 added the former, the latter already existed).
- Produces: `loadFonts(): Promise<void>` — same exported signature as
  before, so `app/_layout.tsx`'s `loadFonts().finally(...)` call needs no
  change.

- [ ] **Step 1: Replace the full contents of `apps/mobile/src/lib/fonts.ts`**

```ts
/**
 * Font loading — Plus Jakarta Sans (headings/buttons/numerals) + Inter
 * (body/UI text).
 *
 * tailwind.config.ts names these as `font-heading` / `font-body` /
 * `font-mono`; without actually loading the files the utilities silently
 * fall back to the system font. This module loads them via
 * expo-google-fonts and expo-font, returning a `ready` flag the root
 * layout gates its splash on so text never flashes in the system face.
 */
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Font from "expo-font";

let loaded = false;

/**
 * Load the brand fonts. Idempotent — safe to call from the root layout on
 * every mount; expo-font no-ops a repeat load of the same family.
 */
export async function loadFonts(): Promise<void> {
  if (loaded) return;
  await Font.loadAsync({
    PlusJakartaSans: PlusJakartaSans_400Regular,
    // Named to match the tailwind fontFamily keys exactly.
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter: Inter_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  loaded = true;
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: no errors (no other file imports from `fonts.ts` except the
`loadFonts` function used in `app/_layout.tsx`, which is unaffected).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/fonts.ts
git commit -m "Mobile: load Plus Jakarta Sans + Inter, drop Space Grotesk/IBM Plex Mono"
```

---

### Task 4: ThemeProvider vars + root layout fixes

**Files:**
- Modify: `apps/mobile/src/theme/ThemeProvider.tsx`
- Modify: `apps/mobile/app/_layout.tsx:67,73`

**Interfaces:**
- Consumes: `THEME_COLORS` (Task 1), `ColorScheme = "light"`.
- Produces: same `ThemeProvider` component signature/behavior — wraps
  children, sets the same CSS var names (minus the removed aurora-band /
  `-strong` ones) via `vars()`.

- [ ] **Step 1: Update `apps/mobile/src/theme/ThemeProvider.tsx`**

Replace the `cssVars` object (and its surrounding doc comment) with:

```ts
/**
 * ThemeProvider — applies the active theme's colors as CSS custom
 * properties so every `var(--color-*)` reference in tailwind.config.ts
 * resolves live, with zero className changes needed across screens.
 *
 * Wrap the whole app (inside the root layout, below the splash gate) so the
 * vars are set before any themed screen renders.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import { vars } from "nativewind";
import { useTheme } from "../store/theme";
import { THEME_COLORS } from "./tokens";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const resolvedScheme = useTheme((s) => s.resolvedScheme);
  const c = THEME_COLORS[resolvedScheme];

  // Keys here MUST match the var(--color-*) names in tailwind.config.ts.
  const cssVars = vars({
    "--color-bg-base": c.bgBase,
    "--color-glass": c.glassBg,
    "--color-glass-raised": c.glassRaised,
    "--color-glass-strong": c.glassStrong,
    "--color-glass-border": c.glassBorder,
    "--color-glass-border-raised": c.glassBorderRaised,
    "--color-divider": c.divider,
    "--color-chrome-bar": c.chromeBar,
    "--color-chrome-border": c.chromeBorder,
    "--color-tab-inactive": c.tabInactive,
    "--color-text-primary": c.textPrimary,
    "--color-text-secondary": c.textSecondary,
    "--color-text-muted": c.textMuted,
    "--color-text-oncard": c.textOnCard,
    "--color-accent": c.accent,
    "--color-accent-on": c.accentOn,
    "--color-accent-text": c.accentText,
    "--color-success-text": c.successText,
    "--color-success-bg": c.successBg,
    "--color-success-border": c.successBorder,
    "--color-info-text": c.infoText,
    "--color-info-icon": c.infoIcon,
    "--color-info-bg": c.infoBg,
    "--color-info-border": c.infoBorder,
    "--color-chip-bg": c.chipBg,
    "--color-chip-border": c.chipBorder,
    "--color-danger": c.danger,
  });

  // `className` (even a no-op one) is required here: NativeWind's babel
  // transform only wraps an element for CSS interop — the thing that makes
  // vars() actually register these as consumable CSS custom properties for
  // descendants — when it sees a `className` prop. A bare `style={vars(...)}`
  // with no className is passed through as an opaque object and silently
  // does nothing, which is exactly the blank-screen bug this comment is
  // here to stop someone from reintroducing.
  return (
    <View className="flex-1" style={cssVars}>
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Fix `apps/mobile/app/_layout.tsx`**

Line 67, change:
```ts
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
```
to:
```ts
      <StatusBar style="dark" />
```
(Single light theme — dark status-bar icons/text are always correct now.
`resolvedScheme` becomes unused in `AppShell`; remove the
`const resolvedScheme = useTheme((s) => s.resolvedScheme);` line at line 62
too.)

Line 73, change:
```ts
          contentStyle: { backgroundColor: colors.bgBase[0] },
```
to:
```ts
          contentStyle: { backgroundColor: colors.bgBase },
```
(`bgBase` is now a flat string, not a gradient tuple — see Task 1.)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: no errors. Then run: `pnpm --filter @crowdshipping/mobile test`
Expected: all existing tests (`format.test.ts`, `tokens.test.ts`) pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/theme/ThemeProvider.tsx apps/mobile/app/_layout.tsx
git commit -m "Mobile: wire ThemeProvider + root layout to the single-mode token set"
```

---

### Task 5: Simplify the theme store (`src/store/theme.ts`)

**Files:**
- Modify: `apps/mobile/src/store/theme.ts` (full rewrite)

**Interfaces:**
- Produces: `useTheme` hook exposing `{ resolvedScheme: "light", hydrated:
  boolean, init: () => Promise<void> }`. Drops `mode`, `setMode`,
  `ThemeMode` — Task 7 removes their only consumer (`app/settings.tsx`'s
  Appearance picker) in the same pass so nothing is left dangling.
- Consumes: `ColorScheme` from `../theme/tokens` (Task 1).

- [ ] **Step 1: Replace the full contents of `apps/mobile/src/store/theme.ts`**

```ts
/**
 * Theme store (zustand) — single light theme today; kept as a store (not a
 * constant) so re-introducing mode switching later (see the redesign spec's
 * dark-mode note) only means adding branches back here, not touching every
 * screen that reads `resolvedScheme` via useThemeColors()/ThemeProvider.
 */
import { create } from "zustand";
import type { ColorScheme } from "../theme/tokens";

interface ThemeState {
  resolvedScheme: ColorScheme;
  hydrated: boolean;
  init: () => Promise<void>;
}

export const useTheme = create<ThemeState>((set) => ({
  resolvedScheme: "light",
  hydrated: false,
  async init() {
    set({ hydrated: true });
  },
}));
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: FAILS at this point — `app/settings.tsx` still imports `ThemeMode`
and calls `useTheme((s) => s.mode)` / `s.setMode`. That's expected; Task 7
fixes it. (Right-sizing note: Tasks 5 and 7 are two ends of the same
removal — do not consider the build "done" between them, only after both
land.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/store/theme.ts
git commit -m "Mobile: simplify theme store to the single light mode"
```

---

### Task 6: Fix Card.tsx's hardcoded shadow literal

**Files:**
- Modify: `apps/mobile/src/components/Card.tsx`
- Test: `apps/mobile/src/components/__tests__/Card.test.tsx` (new)

**Interfaces:**
- Consumes: `useThemeColors()` (new import for this file — every other
  component already imports it; `Card.tsx` was the one holdout, per the
  repo-wide hardcoded-hex grep in this plan's prep).
- Produces: same `Card` component props (`raised?: boolean`) and behavior.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/components/__tests__/Card.test.tsx`:

```tsx
import { describe, it, expect } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "../Card";

describe("Card", () => {
  it("raised variant reads its shadow from the theme token, not a hardcoded literal", () => {
    const { getByTestId } = render(
      <Card raised testID="card">
        <Text>content</Text>
      </Card>,
    );
    const style = getByTestId("card").props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    // The old Aurora literal was rgba(0,0,0,0.32); the new token's shadow
    // color is tinted with the brand green, so it must NOT match the old
    // black shadow.
    expect(JSON.stringify(flat)).not.toContain("rgba(0,0,0,0.32)");
    expect(JSON.stringify(flat)).toContain("15,93,59");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/mobile test -- Card.test.tsx`
Expected: FAIL — current `Card.tsx` hardcodes
`"0 12px 28px rgba(0,0,0,0.32)"`, so the "must not contain" assertion fails
(or the "must contain 15,93,59" assertion fails).

- [ ] **Step 3: Write the minimal implementation**

Replace the full contents of `apps/mobile/src/components/Card.tsx`:

```tsx
/**
 * Card — flat white surface with a hairline border. Pass `raised` for the
 * one-elevation-step variant (used for elevated summaries, the best-match
 * card, wallet cards) — same surface, stronger border + a soft card shadow.
 */
import { type ViewProps, View } from "react-native";
import { clsx } from "../lib/clsx";
import { useThemeColors } from "../hooks/useThemeColors";

interface CardProps extends ViewProps {
  raised?: boolean;
}

export function Card({ raised = false, className, children, ...rest }: CardProps) {
  const colors = useThemeColors();
  return (
    <View
      className={clsx(
        "rounded-card border p-card-padding",
        raised
          ? "bg-glass-raised border-hairline-raised"
          : "bg-glass border-hairline",
        className,
      )}
      style={raised ? [{ boxShadow: colors.shadowCard }] : undefined}
      {...rest}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/mobile test -- Card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/Card.tsx apps/mobile/src/components/__tests__/Card.test.tsx
git commit -m "Mobile: Card reads its raised shadow from the theme token"
```

---

### Task 7: Remove the Appearance picker from Settings + prune dead locale keys

**Files:**
- Modify: `apps/mobile/app/settings.tsx`
- Modify: `apps/mobile/src/locales/fr.ts:567-570`
- Modify: `apps/mobile/src/locales/en.ts:557-560`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SettingsScreen` renders the same sections minus "Appearance"
  (Account, Preferences, Language, and whatever else already exists below
  are untouched — this is not the Phase 6 settings redesign, just removing
  now-meaningless UI).

- [ ] **Step 1: Edit `apps/mobile/app/settings.tsx`**

Remove the `ThemeMode` import and the `themeMode`/`setThemeMode`/
`modeOptions` declarations (lines 18, 28-29, 33-37):

```ts
import { useTheme, type ThemeMode } from "../src/store/theme";
```
→ delete this line entirely (no other symbol from `store/theme` is used in
this file).

```ts
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
```
→ delete both lines.

```ts
  const modeOptions: { value: ThemeMode; label: string }[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "dark", label: t("settings.themeDark") },
    { value: "bright", label: t("settings.themeBright") },
  ];
```
→ delete this block.

Then remove the "Appearance" section from the JSX (the heading + segmented
control right before the "Language" section):

```tsx
      <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">{t("settings.appearance")}</Text>
      <View className="flex-row bg-glass rounded-chip p-1 gap-1">
        {modeOptions.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setThemeMode(opt.value)}
            className={
              "flex-1 items-center py-2.5 rounded-chip " +
              (themeMode === opt.value ? "bg-accent" : "bg-transparent")
            }
          >
            <Text
              className={
                "font-body font-semibold text-sm " +
                (themeMode === opt.value ? "text-accent-on" : "text-text-muted")
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
```
→ delete this whole block (the `Text` heading for "Language" that follows
it is untouched).

- [ ] **Step 2: Remove the dead locale keys**

In `apps/mobile/src/locales/fr.ts`, delete lines 567-570:
```ts
    appearance: "Apparence",
    themeSystem: "Système",
    themeDark: "Sombre",
    themeBright: "Clair",
```

In `apps/mobile/src/locales/en.ts`, delete lines 557-560:
```ts
    appearance: "Appearance",
    themeSystem: "System",
    themeDark: "Dark",
    themeBright: "Light",
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS — this closes out Task 5's temporarily-broken build (no
more consumer of `mode`/`setMode`/`ThemeMode`).

Run: `pnpm --filter @crowdshipping/mobile test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/settings.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: remove the dark/bright appearance picker from Settings"
```

---

### Task 8: Full verification pass against the quality bar

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + test suite**

Run: `pnpm --filter @crowdshipping/mobile typecheck && pnpm --filter @crowdshipping/mobile test`
Expected: both green.

- [ ] **Step 2: Start Metro and manually verify on a device/simulator**

Run: `pnpm --filter @crowdshipping/mobile start`
Open the app and check, per the spec's quality bar (brief §53-54):
- Home, Messages, Profile tabs, and at least one pushed detail screen
  (e.g. a trip detail) render in the beige/white/deep-green palette with
  no orange, no dark background, no blur/glass translucency anywhere.
- The FAB and its chooser modal still work (unchanged in this phase) and
  now render in the new palette.
- Status pills (parcel/trip status badges), the primary CTA button, and a
  raised card (e.g. a best-match card if reachable) all read clearly with
  the new colors — no low-contrast text.
- No console warnings about a missing font family.

- [ ] **Step 3: Fix anything that fails the manual check**

If a screen still shows an Aurora-only visual (this would mean a hardcoded
value slipped past the repo-wide grep this plan was built from), grep for
the specific hex/rgba value across `apps/mobile/src` and `apps/mobile/app`
and route it through `THEME_COLORS`/a Tailwind token instead. Re-run Step 1
and re-check the affected screen.

- [ ] **Step 4: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "Mobile: fix remaining Aurora residue found in manual QA"
```

(Skip this commit if Step 3 found nothing to fix.)

---

## Self-Review Notes

- **Spec coverage:** design tokens (Task 1), Tailwind/global.css/fonts
  (Tasks 2-3), ThemeProvider + root layout (Task 4), dark-mode-ready
  architecture preserved (Task 5's store still keys off `ColorScheme`).
  Navigation restructure and new screens (`search.tsx`, `trips.tsx`) are
  explicitly deferred to Phase 2/6 plans per this plan's Architecture note
  — flagged, not silently dropped.
- **Type consistency:** `ThemeColors.bgBase` type change (tuple → string)
  is threaded through both of its two call sites (`ThemeProvider.tsx`,
  `app/_layout.tsx`) in Task 4; `ColorScheme` stays a single exported type
  used identically in `tokens.ts` and `store/theme.ts`.
- **No placeholders:** every task step above contains the literal code to
  write, not a description of it.
