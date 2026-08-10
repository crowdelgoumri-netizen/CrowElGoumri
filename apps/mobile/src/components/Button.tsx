/**
 * Button — primary/secondary/ghost variants, loading + disabled states.
 *
 * Primary = accent gradient pill (the board's signature CTA). Secondary =
 * outlined on dark. Ghost = text-only. Loading replaces the label with a
 * spinner and locks interaction so double-submits can't happen.
 */
import { ActivityIndicator, Pressable, type PressableProps, Text } from "react-native";
import { clsx } from "../lib/clsx";

interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const base =
    "items-center justify-center rounded-pill h-14 px-lg active:opacity-80";
  const variants = {
    primary: "bg-accent",
    secondary: "border border-line bg-transparent",
    ghost: "bg-transparent",
  } as const;
  const labelClass = {
    primary: "text-white font-body font-semibold text-base",
    secondary: "text-mist font-body font-semibold text-base",
    ghost: "text-accent font-body font-semibold text-base",
  } as const;

  return (
    <Pressable
      className={clsx(base, variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#FF6A2B"} />
      ) : (
        <Text className={labelClass[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
