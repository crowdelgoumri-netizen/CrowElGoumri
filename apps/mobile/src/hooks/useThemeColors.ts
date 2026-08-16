/**
 * useThemeColors — raw color values for the active mode.
 *
 * Tailwind className covers styled elements; this is for props that take a
 * literal color instead of a className (icon `color=`, `tintColor`,
 * `shadowColor`, RefreshControl, Switch track/thumb, etc.). Always read
 * colors through this hook in those spots — never hardcode a hex, or the
 * element silently stops following the theme.
 */
import { useTheme } from "../store/theme";
import { THEME_COLORS } from "../theme/tokens";

export function useThemeColors() {
  const resolvedScheme = useTheme((s) => s.resolvedScheme);
  return THEME_COLORS[resolvedScheme];
}
