/**
 * Card — Aurora glass surface with hairline border and top highlight.
 *
 * Default = glass surface. Pass `raised` for stronger glass + card shadow
 * (used for elevated summaries, wallet cards).
 */
import { type ViewProps, View } from "react-native";
import { clsx } from "../lib/clsx";

interface CardProps extends ViewProps {
  raised?: boolean;
}

export function Card({ raised = false, className, children, ...rest }: CardProps) {
  return (
    <View
      className={clsx(
        "rounded-card border p-card-padding",
        raised
          ? "bg-glass-raised border-hairline-raised"
          : "bg-glass border-hairline",
        className,
      )}
      style={
        raised
          ? [{ boxShadow: "0 12px 28px rgba(0,0,0,0.32)" }]
          : undefined
      }
      {...rest}
    >
      {children}
    </View>
  );
}
