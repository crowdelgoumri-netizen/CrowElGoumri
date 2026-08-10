/**
 * EmptyState — icon + title + subtitle + optional CTA.
 *
 * Used for the "no matches" screen (board 12), empty inbox, empty parcel list,
 * and notification-less states. Keeps the "nothing here yet" moment friendly
 * instead of a blank screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Button } from "./Button";

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
  return (
    <View className="items-center justify-center py-xl px-lg">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-navySoft/60 mb-md">
        <Ionicons name={icon} size={36} color="#6D5AA6" />
      </View>
      <Text className="text-white font-heading text-lg font-bold text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-muted font-body text-sm text-center mt-1.5 max-w-[280px]">
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
