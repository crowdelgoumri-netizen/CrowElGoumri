/**
 * Card — DiasporaCart surface with hairline border and soft shadow.
 *
 * Default = flat surface. Pass `raised` for the stronger surface + the
 * theme's card shadow (used for elevated summaries, wallet cards).
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
