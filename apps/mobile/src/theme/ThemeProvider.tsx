/**
 * ThemeProvider — applies the active mode's colors as CSS custom properties
 * so every `var(--color-*)` reference in tailwind.config.ts resolves live,
 * with zero className changes needed across screens when the mode flips.
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
    "--color-bg-base": c.bgBase[0],
    "--color-aurora-warm": c.auroraWarm,
    "--color-aurora-warm-band": c.auroraWarmBand,
    "--color-aurora-cool": c.auroraCool,
    "--color-aurora-cool-band": c.auroraCoolBand,
    "--color-glass": c.glassBg,
    "--color-glass-raised": c.glassRaised,
    "--color-glass-strong": c.glassStrong,
    "--color-glass-border": c.glassBorder,
    "--color-glass-border-raised": c.glassBorderRaised,
    "--color-glass-border-strong": c.glassBorderStrong,
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
    "--color-sand": c.sand,
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
