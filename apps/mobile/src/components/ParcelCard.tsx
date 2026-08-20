/**
 * ParcelCard — a parcel as a list item (sender's "my parcels" list + detail
 * links). Aurora glass styling.
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { StatusPill } from "./StatusPill";
import {
  CATEGORY_KEY,
  cityOf,
  eur,
  PARCEL_STATUS,
} from "../lib/format";
import { useThemeColors } from "../hooks/useThemeColors";
import type { Parcel } from "../lib/parcels";
import type { ParcelCategory } from "../lib/types";

interface ParcelCardProps {
  parcel: Parcel;
  onPress?: (parcel: Parcel) => void;
}

export function ParcelCard({ parcel, onPress }: ParcelCardProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const st = PARCEL_STATUS[parcel.status] ?? { key: parcel.status, tone: "muted" as const };
  const cat = t(CATEGORY_KEY[parcel.category as ParcelCategory] ?? parcel.category);

  return (
    <Pressable onPress={() => onPress?.(parcel)} className="active:opacity-80">
      <Card className="gap-stack-gap">
        <View className="flex-row items-center justify-between">
          <StatusPill label={t(st.key)} tone={st.tone} />
          <Text className="text-text-muted text-xs font-mono font-medium">{cat}</Text>
        </View>

        <Text className="text-oncard font-body text-sm" numberOfLines={2}>
          {parcel.description}
        </Text>

        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={14} color={colors.accent} />
          <Text className="text-text-secondary font-body text-xs ml-1 flex-1" numberOfLines={1}>
            {cityOf(parcel.pickupAddress)} → {cityOf(parcel.deliveryAddress)}
          </Text>
          <Ionicons name="scale-outline" size={14} color={colors.textMuted} />
          <Text className="text-text-muted font-mono text-meta ml-1">{parcel.weightKg} kg</Text>
        </View>

        {parcel.offeredPrice != null ? (
          <Text className="text-accent font-heading font-bold">
            {eur(parcel.offeredPrice)}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
