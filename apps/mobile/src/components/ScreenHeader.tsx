/**
 * ScreenHeader — back button + title bar for pushed detail screens.
 *
 * The root tab screens have their own headers; this is for the stack routes
 * (parcel/[id], tracking, escrow, chat thread, etc.) that need a back affordance.
 * Renders above the Screen's scroll content.
 */
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clsx } from "../lib/clsx";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Override the back behavior (default: router.back()). */
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  className,
}: ScreenHeaderProps) {
  return (
    <View className={clsx("flex-row items-center gap-md mb-md", className)}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        className="h-10 w-10 items-center justify-center rounded-full bg-navySoft/60"
      >
        <Ionicons name="chevron-back" size={22} color="#F5F7FA" />
      </Pressable>
      <View className="flex-1">
        <Text className="text-white font-heading text-xl font-bold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted font-body text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
