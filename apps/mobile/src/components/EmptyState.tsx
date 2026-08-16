/**
 * EmptyState — icon + title + subtitle + optional CTA.
 *
 * Aurora-styled with a glass icon circle and updated spacing.
 */
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Button } from "./Button";
import { useThemeColors } from "../hooks/useThemeColors";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon = "cube-outline",
  title,
  subtitle,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="items-center justify-center py-xl px-lg">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-glass mb-md">
        <Ionicons name={icon} size={36} color={colors.accent} />
      </View>
      <Text className="text-text-primary font-heading text-lg font-bold text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-text-muted font-body text-sm text-center mt-1.5 max-w-[280px]">
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <View className="mt-lg w-full max-w-[260px]">
          <Button label={ctaLabel} onPress={onCta} />
        </View>
      ) : null}
    </View>
  );
}
