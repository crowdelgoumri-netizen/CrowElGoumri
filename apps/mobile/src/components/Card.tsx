/**
 * Card — the board's signature frosted-glass surface.
 *
 * On dark screens it's a translucent navy panel; on light screens it's the
 * white-frosted look. All the content cards in the design board use this.
 */
import { type ViewProps, View } from "react-native";
import { clsx } from "../lib/clsx";

interface CardProps extends ViewProps {
  variant?: "dark" | "light";
}

export function Card({ variant = "dark", className, children, ...rest }: CardProps) {
  const styles =
    variant === "dark"
      ? "bg-navySoft/60 border-line"
      : "bg-white/55 border-white/70";
  return (
    <View
      className={clsx(
        "rounded-card border p-md",
        styles,
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  );
}
