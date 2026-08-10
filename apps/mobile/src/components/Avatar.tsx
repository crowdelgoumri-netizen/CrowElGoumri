/**
 * Avatar — initials circle in the brand deep-violet. Used for travelers,
 * senders, and the counterparty header in chat. Falls back to "?" when no
 * name is available. (A true gradient needs expo-linear-gradient; this solid
 * token keeps the look without an extra dependency.)
 */
import { Text, View } from "react-native";
import { clsx } from "../lib/clsx";
import { initials } from "../lib/format";

interface AvatarProps {
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
} as const;

const TEXT = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
} as const;

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <View
      className={clsx(
        "items-center justify-center rounded-full bg-violetDeep border border-violet/40",
        SIZE[size],
        className,
      )}
    >
      <Text className={clsx("font-heading font-bold text-white", TEXT[size])}>
        {initials(name)}
      </Text>
    </View>
  );
}
