/**
 * Aurora design tokens — single source of truth for JS-accessible values,
 * both color modes. Mirrors design_handoff_crowshi_aurora/tokens.json
 * exactly (dark + bright); do not hand-tune a value here without updating
 * the source doc too.
 *
 * Tailwind/NativeWind covers colors, fonts, radii, and spacing via
 * tailwind.config.ts (className on components) — those color values are
 * CSS custom properties that get swapped per-mode by ThemeProvider using
 * NativeWind's `vars()`. This file is for values Tailwind can't express
 * (gradient arrays, shadow strings) AND for raw color access in places
 * that take a literal color prop instead of className (icon `color=`,
 * `tintColor`, `shadowColor`, RefreshControl, etc.) — use `useThemeColors()`
 * for those, never a hardcoded hex.
 */
export type ColorScheme = "dark" | "bright";

export interface ThemeColors {
  bgBase: readonly [string, string]; // gradient stops, top → bottom
  auroraWarm: string;
  auroraWarmBand: string;
  auroraCool: string;
  auroraCoolBand: string;
  glassBg: string;
  glassRaised: string;
  glassStrong: string;
  glassBorder: string;
  glassBorderRaised: string;
  glassBorderStrong: string;
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
  /** Placeholder / disabled input text — not in tokens.json's named set but
   * needed everywhere a TextInput needs a placeholder color; derived from
   * textMuted per-mode rather than a bare literal. */
  placeholder: string;
}

const dark: ThemeColors = {
  bgBase: ["#0A0F1A", "#070B14"],
  auroraWarm: "rgba(255,106,43,0.16)",
  auroraWarmBand: "rgba(255,106,43,0.55)",
  auroraCool: "rgba(159,140,255,0.16)",
  auroraCoolBand: "rgba(159,140,255,0.40)",
  glassBg: "rgba(255,255,255,0.045)",
  glassRaised: "rgba(255,255,255,0.065)",
  glassStrong: "rgba(255,255,255,0.07)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderRaised: "rgba(255,255,255,0.14)",
  glassBorderStrong: "rgba(255,255,255,0.16)",
  divider: "rgba(255,255,255,0.10)",
  shadowCard: "0 12px 28px rgba(0,0,0,0.32)",
  textPrimary: "#F7F9FC",
  textSecondary: "#98A5BC",
  textMuted: "#7C8AA5",
  textOnCard: "#C6D0E2",
  accent: "#FF6A2B",
  accentOn: "#0B1220",
  accentText: "#FF8A4F",
  accentGlow: "0 10px 30px rgba(255,106,43,0.28)",
  successText: "#4CE0AE",
  successBg: "rgba(52,211,153,0.14)",
  successBorder: "rgba(52,211,153,0.30)",
  infoText: "#CDC4F0",
  infoIcon: "#9F8CFF",
  infoBg: "rgba(159,140,255,0.10)",
  infoBorder: "rgba(159,140,255,0.24)",
  chipBg: "rgba(255,255,255,0.07)",
  chipBorder: "rgba(255,255,255,0.14)",
  chromeBar: "rgba(10,15,26,0.72)",
  chromeBorder: "rgba(255,255,255,0.08)",
  tabInactive: "rgba(255,255,255,0.14)",
  placeholder: "#7C8AA5",
};

const bright: ThemeColors = {
  bgBase: ["#FBFCFF", "#EFF2F9"],
  auroraWarm: "rgba(255,90,31,0.14)",
  auroraWarmBand: "rgba(255,90,31,0.40)",
  auroraCool: "rgba(109,90,166,0.14)",
  auroraCoolBand: "rgba(109,90,166,0.28)",
  glassBg: "rgba(255,255,255,0.60)",
  glassRaised: "rgba(255,255,255,0.72)",
  glassStrong: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(255,255,255,0.90)",
  glassBorderRaised: "rgba(255,255,255,0.95)",
  glassBorderStrong: "rgba(255,255,255,0.95)",
  divider: "#E4E9F2",
  shadowCard: "0 8px 22px rgba(11,18,32,0.06)",
  textPrimary: "#0B1220",
  textSecondary: "#5A6779",
  textMuted: "#7A8698",
  textOnCard: "#48566B",
  accent: "#FF5A1F",
  accentOn: "#FFFFFF",
  accentText: "#FF5A1F",
  accentGlow: "0 10px 26px rgba(255,90,31,0.26)",
  successText: "#0E9F6E",
  successBg: "#E4F7EE",
  successBorder: "#BFE9D6",
  infoText: "#54468A",
  infoIcon: "#6D5AA6",
  infoBg: "rgba(109,90,166,0.10)",
  infoBorder: "rgba(109,90,166,0.22)",
  chipBg: "rgba(11,18,32,0.05)",
  chipBorder: "#E4E9F2",
  chromeBar: "rgba(255,255,255,0.78)",
  chromeBorder: "#E4E9F2",
  tabInactive: "#DCE2ED",
  placeholder: "#7A8698",
};

export const THEME_COLORS: Record<ColorScheme, ThemeColors> = { dark, bright };

/**
 * Shared (mode-independent) values — blur, spacing, safe area. Same in
 * both modes per the handoff's "Shared" token section.
 */
export const tokens = {
  blur: {
    content: 18,
    chrome: 20,
  },
  spacing: {
    screenEdge: 20,
    screenEdgeHero: 28,
    cardPadding: 16,
    stackGap: 12,
    sectionGap: 14,
  } as const,
  safeArea: {
    top: 64,
    topHero: 72,
    bottom: 30,
  } as const,
} as const;

/**
 * Sample personas for placeholder UI — Algeria diaspora cast.
 */
export const PERSONAS = [
  { name: "Karim B.", role: "Sender · Paris", initials: "KB" },
  { name: "Ahmed M.", role: "Traveler · ORY→ALG", initials: "AM" },
  { name: "Nadia K.", role: "Traveler · Marseille ferry", initials: "NK" },
  { name: "Youcef D.", role: "Traveler · Orly→Alger", initials: "YD" },
] as const;
