/**
 * Button — primary/secondary/ghost variants, loading + disabled states.
 *
 * Primary = accent fill with glow shadow (Aurora CTA). Secondary = glass
 * surface + hairline border. Ghost = text-only.
 */
import { ActivityIndicator, Pressable, type PressableProps, Text } from "react-native";
import { clsx } from "../lib/clsx";
import { useThemeColors } from "../hooks/useThemeColors";

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
  const colors = useThemeColors();
  const base =
    "items-center justify-center rounded-field h-14 px-[17px] active:opacity-80";
  const variants = {
    primary: "bg-accent",
    secondary: "bg-glass border border-hairline",
    ghost: "bg-transparent",
  } as const;
  const labelClass = {
    primary: "text-accent-on font-body font-extrabold text-base",
    secondary: "text-oncard font-body font-semibold text-base",
    ghost: "text-accent font-body font-semibold text-base",
  } as const;

  return (
    <Pressable
      className={clsx(base, variants[variant], className)}
      disabled={disabled || loading}
      style={
        variant === "primary"
          ? [{ boxShadow: colors.accentGlow }]
          : undefined
      }
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.accentOn : colors.accent} />
      ) : (
        <Text className={labelClass[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
