/**
 * ParcelCard — a parcel as a list item ("Mes demandes" look, board 07).
 *
 * Route headline (bold, origin → wilaya) with the status pill at the top
 * right, then the meta strip (weight · category · deadline chip) and the
 * offered price anchored right in heading weight.
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
  formatDate,
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
        {/* Route + status */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-row items-center gap-2 flex-1">
            <Ionicons name="navigate" size={15} color={colors.accent} />
            <Text
              className="text-text-primary font-heading font-bold text-base flex-1"
              numberOfLines={1}
            >
              {cityOf(parcel.pickupAddress)} → {cityOf(parcel.deliveryAddress)}
            </Text>
          </View>
          <StatusPill label={t(st.key)} tone={st.tone} />
        </View>

        {/* Meta strip */}
        <View className="flex-row items-center gap-2 flex-wrap">
          <View className="flex-row items-center gap-1 rounded-chip bg-chip-bg border border-chip-border px-2 py-0.5">
            <Ionicons name="scale-outline" size={11} color={colors.textSecondary} />
            <Text className="text-text-secondary font-body text-xs">{parcel.weightKg} kg</Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-chip bg-chip-bg border border-chip-border px-2 py-0.5">
            <Ionicons name="cube-outline" size={11} color={colors.textSecondary} />
            <Text className="text-text-secondary font-body text-xs">{cat}</Text>
          </View>
          {parcel.urgencyDeadline ? (
            <View className="flex-row items-center gap-1 rounded-chip bg-info/15 border border-info/25 px-2 py-0.5">
              <Ionicons name="time-outline" size={11} color={colors.infoText} />
              <Text className="text-info font-body text-xs">
                {t("parcelCard.before", { date: formatDate(parcel.urgencyDeadline) })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Description + price */}
        <View className="flex-row items-end justify-between gap-2">
          <Text className="text-text-secondary font-body text-sm flex-1" numberOfLines={1}>
            {parcel.description}
          </Text>
          {parcel.offeredPrice != null ? (
            <Text className="text-accent font-heading font-extrabold text-lg">
              {eur(parcel.offeredPrice)}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
