/**
 * TripCard — a traveler's trip as a browseable list item (board 02 feed).
 *
 * Aurora three-band layout:
 *  (1) avatar 34px + name + mono "RATING · N TRIPS" + capacity badge
 *  (2) route line with origin → destination in heading weight
 *  (3) departure datetime left, $N/kg right
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { cityOf, eur, formatDateTime, MODE_ICON, MODE_KEY } from "../lib/format";
import { useThemeColors } from "../hooks/useThemeColors";
import type { Trip } from "../lib/trips";
import type { TransportMode } from "../lib/types";

interface TripCardProps {
  trip: Trip;
  onPress?: (trip: Trip) => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const remaining = Math.max(0, trip.maxWeightKg - (trip.currentWeightKg ?? 0));
  const icon = MODE_ICON[trip.mode as TransportMode] ?? "navigate";

  return (
    <Pressable onPress={() => onPress?.(trip)} className="active:opacity-80">
      <Card className="gap-stack-gap">
        {/* Band 1 — traveler info */}
        <View className="flex-row items-center gap-card-padding">
          <Avatar name={trip.traveler?.firstName} size="sm" />
          <View className="flex-1">
            <Text className="text-oncard font-body text-[15px] font-semibold" numberOfLines={1}>
              {trip.traveler?.firstName ?? t("tripCard.traveler")}
            </Text>
            <Text className="text-text-secondary font-mono text-meta font-medium uppercase">
              {trip.traveler?.averageRating ?? "—"} · {t("tripCard.trips", { n: trip.traveler?.completedTrips ?? 0 })}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-chip bg-accent/15 px-2 py-0.5">
            <Ionicons name="scale-outline" size={12} color={colors.accent} />
            <Text className="text-accent font-mono text-meta font-semibold">
              {remaining.toFixed(1)} kg
            </Text>
          </View>
        </View>

        {/* Band 2 — route */}
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.accent} />
          <Text className="text-oncard font-heading font-bold text-[15px] flex-1" numberOfLines={1}>
            {cityOf(trip.origin)} → {cityOf(trip.destination)}
          </Text>
          <Text className="text-text-muted text-xs font-body">
            {t(MODE_KEY[trip.mode as TransportMode] ?? trip.mode)}
          </Text>
        </View>

        {/* Band 3 — departure + price */}
        <View className="flex-row items-center justify-between">
          <Text className="text-text-secondary font-mono text-meta font-medium">
            {formatDateTime(trip.departureTime)}
          </Text>
          {trip.pricePerKg != null ? (
            <Text className="font-heading font-bold text-numeral">
              <Text className="text-accent">{eur(trip.pricePerKg)}</Text>
              <Text className="text-text-muted text-xs font-body">{t("tripCard.perKg")}</Text>
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
