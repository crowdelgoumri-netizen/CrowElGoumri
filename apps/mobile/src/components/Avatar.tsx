/**
 * Avatar — initials circle. Used for travelers, senders, and the
 * counterparty header in chat. Falls back to "?" when no name is available.
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
  sm: "h-[34px] w-[34px]",
  md: "h-11 w-11",
  lg: "h-16 w-16",
} as const;

const TEXT = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
} as const;

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <View
      className={clsx(
        "items-center justify-center rounded-full bg-accent/20 border border-accent/30",
        SIZE[size],
        className,
      )}
    >
      <Text className={clsx("font-heading font-bold text-accent-text", TEXT[size])}>
        {initials(name)}
      </Text>
    </View>
  );
}
