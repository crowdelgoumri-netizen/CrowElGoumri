/**
 * DiasporaCart design tokens — single source of truth for JS-accessible
 * values, both color modes (bright = product default: cream/sand surfaces,
 * deep green accent; dark = companion mode for users who opt into it).
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
  /** Brand sand (mockup swatch #EADCC8) — same in both modes; used on
   * accent-filled surfaces (hero CTA) where contrast must hold. */
  sand: string;
  chromeBar: string;
  chromeBorder: string;
  tabInactive: string;
  /** Placeholder / disabled input text — not in tokens.json's named set but
   * needed everywhere a TextInput needs a placeholder color; derived from
   * textMuted per-mode rather than a bare literal. */
  placeholder: string;
}

const dark: ThemeColors = {
  bgBase: ["#0E1712", "#0A100D"],
  auroraWarm: "rgba(62,154,107,0.16)",
  auroraWarmBand: "rgba(62,154,107,0.50)",
  auroraCool: "rgba(169,192,138,0.14)",
  auroraCoolBand: "rgba(169,192,138,0.35)",
  glassBg: "rgba(255,255,255,0.05)",
  glassRaised: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderRaised: "rgba(255,255,255,0.14)",
  glassBorderStrong: "rgba(255,255,255,0.16)",
  divider: "rgba(255,255,255,0.10)",
  shadowCard: "0 12px 28px rgba(0,0,0,0.35)",
  textPrimary: "#F3F6F2",
  textSecondary: "#9FB0A3",
  textMuted: "#7C9082",
  textOnCard: "#C9D6CB",
  accent: "#3E9A6B",
  accentOn: "#08130D",
  accentText: "#5CC490",
  accentGlow: "0 10px 28px rgba(62,154,107,0.35)",
  successText: "#4CE0AE",
  successBg: "rgba(76,224,174,0.14)",
  successBorder: "rgba(76,224,174,0.30)",
  infoText: "#C9D3A8",
  infoIcon: "#A9C08A",
  infoBg: "rgba(169,192,138,0.12)",
  infoBorder: "rgba(169,192,138,0.26)",
  chipBg: "rgba(255,255,255,0.07)",
  sand: "#EADCC8",
  chipBorder: "rgba(255,255,255,0.14)",
  chromeBar: "rgba(14,23,18,0.80)",
  chromeBorder: "rgba(255,255,255,0.08)",
  tabInactive: "rgba(255,255,255,0.16)",
  placeholder: "#7C9082",
};

const bright: ThemeColors = {
  bgBase: ["#FBFAF6", "#F6F1E7"],
  auroraWarm: "rgba(15,93,59,0.10)",
  auroraWarmBand: "rgba(15,93,59,0.35)",
  auroraCool: "rgba(104,139,91,0.10)",
  auroraCoolBand: "rgba(104,139,91,0.30)",
  glassBg: "#FFFFFF",
  glassRaised: "#FFFFFF",
  glassStrong: "#FFFFFF",
  glassBorder: "#EEE7D8",
  glassBorderRaised: "#E7DEC9",
  glassBorderStrong: "#DED2B8",
  divider: "#EEE7D8",
  shadowCard: "0 10px 24px rgba(15,93,59,0.10)",
  textPrimary: "#16241C",
  textSecondary: "#5B6B5F",
  textMuted: "#8B9690",
  textOnCard: "#3E4B41",
  accent: "#0F5D4A",
  accentOn: "#FFFFFF",
  accentText: "#0F5D4A",
  accentGlow: "0 10px 24px rgba(15,93,59,0.30)",
  successText: "#1E8A5A",
  successBg: "#E3F1E8",
  successBorder: "#BFE0CC",
  infoText: "#5C6E3F",
  infoIcon: "#688B5B",
  infoBg: "rgba(104,139,91,0.12)",
  infoBorder: "rgba(104,139,91,0.28)",
  chipBg: "#F3EEE4",
  sand: "#EADCC8",
  chipBorder: "#E7DFCB",
  chromeBar: "rgba(255,255,255,0.94)",
  chromeBorder: "#EEE7D8",
  tabInactive: "#C3CBC1",
  placeholder: "#9AA79C",
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
