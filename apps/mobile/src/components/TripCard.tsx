/**
 * TripCard — a traveler's trip as a browseable list item (board 02 feed).
 *
 * Shows the corridor (origin → destination), departure, transport mode,
 * remaining capacity, price/kg, and the traveler's name + trust badge.
 * Tapping navigates to the trip detail.
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { cityOf, eur, formatDate, MODE_ICON, MODE_LABEL } from "../lib/format";
import type { Trip } from "../lib/trips";
import type { TransportMode } from "../lib/types";

interface TripCardProps {
  trip: Trip;
  onPress?: (trip: Trip) => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const remaining = Math.max(0, trip.maxWeightKg - (trip.currentWeightKg ?? 0));
  const icon = MODE_ICON[trip.mode as TransportMode] ?? "navigate";

  return (
    <Pressable onPress={() => onPress?.(trip)} className="active:opacity-80">
      <Card className="gap-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color="#FF6A2B" />
          <Text className="text-mist/70 text-xs font-body">
            {MODE_LABEL[trip.mode as TransportMode] ?? trip.mode}
          </Text>
          <Text className="text-muted text-xs font-body">·</Text>
          <Text className="text-muted text-xs font-body">{formatDate(trip.departureTime)}</Text>
        </View>

        <View className="flex-row items-center">
          <Text className="text-white font-heading text-lg font-bold flex-1" numberOfLines={1}>
            {cityOf(trip.origin)} → {cityOf(trip.destination)}
          </Text>
          {trip.pricePerKg != null ? (
            <Text className="text-accent font-heading font-bold">
              {eur(trip.pricePerKg)}
              <Text className="text-muted text-xs font-body">/kg</Text>
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Avatar name={trip.traveler?.firstName} size="sm" />
            <View>
              <Text className="text-white font-body text-sm font-semibold">
                {trip.traveler?.firstName ?? "Voyageur"}
              </Text>
              <Text className="text-muted text-xs font-body">
                {trip.traveler?.completedTrips ?? 0} trajets
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="scale-outline" size={14} color="#8A94A6" />
            <Text className="text-mist font-body text-xs">{remaining.toFixed(1)} kg dispo</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
