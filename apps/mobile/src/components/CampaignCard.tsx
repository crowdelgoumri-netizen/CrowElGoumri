/**
 * CampaignCard — horizontal-scroll card for regular carrier announcements.
 *
 * Layout (fixed 248px width for horizontal list):
 *  - optional featured banner at top
 *  - traveler avatar + name + rating
 *  - corridor: originCity (country) → wilayas
 *  - dates: departure / return (or one-way)
 *  - footer: capacity badge + price
 */
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { formatDate, MODE_ICON } from "../lib/format";
import { useThemeColors } from "../hooks/useThemeColors";
import type { Campaign } from "../lib/campaigns";
import type { TransportMode } from "../lib/types";

interface CampaignCardProps {
  campaign: Campaign;
  onPress?: (campaign: Campaign) => void;
}

export function CampaignCard({ campaign, onPress }: CampaignCardProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const icon = MODE_ICON[campaign.mode as TransportMode] ?? "navigate";
  const name = campaign.traveler.displayName ?? campaign.traveler.firstName;

  return (
    <Pressable onPress={() => onPress?.(campaign)} className="active:opacity-80" style={{ width: 248 }}>
      <Card className="gap-3 overflow-hidden p-0">
        {/* Featured banner */}
        {campaign.featured ? (
          <View className="bg-amber-500 px-card-padding py-1">
            <Text className="text-white font-body text-xs font-semibold">
              {t("campaign.featuredBadge")}
            </Text>
          </View>
        ) : null}

        <View className="px-card-padding pb-card-padding pt-3 gap-3">
          {/* Traveler row */}
          <View className="flex-row items-center gap-2">
            <Avatar name={name} size="sm" />
            <View className="flex-1">
              <Text className="text-oncard font-body text-[14px] font-semibold" numberOfLines={1}>
                {name}
              </Text>
              <Text className="text-text-secondary font-mono text-meta">
                ★ {campaign.traveler.averageRating?.toFixed(1) ?? "—"} · {campaign.traveler.completedDeliveries ?? 0} livr.
              </Text>
            </View>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.accent} />
          </View>

          {/* Corridor */}
          <View className="gap-0.5">
            <Text className="text-oncard font-heading font-bold text-[13px]" numberOfLines={1}>
              {campaign.originCity} → Algérie
            </Text>
            <Text className="text-text-muted font-body text-xs" numberOfLines={1}>
              {campaign.destWilayas.slice(0, 3).join(", ")}
              {campaign.destWilayas.length > 3 ? ` +${campaign.destWilayas.length - 3}` : ""}
            </Text>
          </View>

          {/* Dates */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-glass rounded-md px-2 py-1.5">
              <Text className="text-text-muted font-body text-[10px] uppercase">Départ</Text>
              <Text className="text-oncard font-mono text-xs font-medium">
                {formatDate(campaign.departureDate)}
              </Text>
            </View>
            <View className="flex-1 bg-glass rounded-md px-2 py-1.5">
              <Text className="text-text-muted font-body text-[10px] uppercase">Retour</Text>
              <Text className="text-oncard font-mono text-xs font-medium">
                {campaign.returnDate ? formatDate(campaign.returnDate) : t("campaign.noReturn")}
              </Text>
            </View>
          </View>

          {/* Footer: capacity + price */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1 rounded-chip bg-accent/15 px-2 py-0.5">
              <Ionicons name="scale-outline" size={11} color={colors.accent} />
              <Text className="text-accent font-mono text-meta font-semibold">
                {campaign.capacityKg} kg
              </Text>
            </View>
            <Text className="font-heading font-bold text-numeral">
              <Text className="text-accent">{campaign.pricePerKg.toFixed(2)} €</Text>
              <Text className="text-text-muted text-xs font-body">/kg</Text>
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
