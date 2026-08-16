/**
 * ScreenHeader — back button + title bar for pushed detail screens.
 *
 * Aurora-styled with glass back button and updated typography.
 */
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clsx } from "../lib/clsx";
import { useThemeColors } from "../hooks/useThemeColors";

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
  const colors = useThemeColors();
  return (
    <View className={clsx("flex-row items-center gap-md mb-md", className)}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        className="h-10 w-10 items-center justify-center rounded-full bg-glass border border-hairline"
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-text-primary font-heading text-screen-title font-bold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-text-muted font-mono text-meta" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
