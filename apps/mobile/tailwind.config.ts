/**
 * Tailwind / NativeWind config — Aurora design system (dark + bright).
 *
 * Every color resolves through a CSS custom property (`var(--color-*)`)
 * instead of a literal value — src/theme/ThemeProvider.tsx swaps the actual
 * values per the active mode via NativeWind's `vars()`, so className usage
 * across screens never needs to change when the mode does. The var names
 * here and the keys ThemeProvider sets must match exactly; both are
 * generated from src/theme/tokens.ts's THEME_COLORS, the single source of
 * truth (itself lifted from design_handoff_crowshi_aurora/tokens.json).
 */
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        base: "var(--color-bg-base)",
        "aurora-warm": "var(--color-aurora-warm)",
        "aurora-warm-band": "var(--color-aurora-warm-band)",
        "aurora-cool": "var(--color-aurora-cool)",
        "aurora-cool-band": "var(--color-aurora-cool-band)",
        glass: "var(--color-glass)",
        "glass-raised": "var(--color-glass-raised)",
        "glass-strong": "var(--color-glass-strong)",
        hairline: "var(--color-glass-border)",
        "hairline-raised": "var(--color-glass-border-raised)",
        "hairline-strong": "var(--color-glass-border-strong)",
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
        danger: "#EF4444",
      },
      fontFamily: {
        heading: ["SpaceGrotesk", "system-ui"],
        body: ["PlusJakartaSans", "system-ui"],
        mono: ["IBMPlexMono", "monospace"],
      },
      borderRadius: {
        card: "20px",
        field: "16px",
        chip: "999px",
        "tab-icon": "7px",
      },
      spacing: {
        "screen-edge": "20px",
        "screen-edge-hero": "28px",
        "card-padding": "16px",
        "stack-gap": "12px",
        "section-gap": "14px",
        // Classic step scale — components already write p-lg/px-md/etc.
        // (~30 usages); without these keys those utilities silently match
        // nothing and the padding never renders.
        sm: "8px",
        md: "12px",
        lg: "18px",
        xl: "28px",
      },
      fontSize: {
        hero: ["42px", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "screen-title": ["22px", { lineHeight: "1.2", letterSpacing: "-0.028em" }],
        numeral: ["29px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "route-code": ["20px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        meta: ["11px", { lineHeight: "1.4", letterSpacing: "0.08em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
