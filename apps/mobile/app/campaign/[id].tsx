import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Avatar } from "../../src/components/Avatar";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getCampaign, updateCampaign } from "../../src/lib/campaigns";
import { formatDate, MODE_ICON } from "../../src/lib/format";
import type { TransportMode } from "../../src/lib/types";

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const user = useAuth((s) => s.user);

  const { data, loading, error } = useAsync(() => getCampaign(id!), [id]);
  const campaign = data?.campaign;

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View className="py-xl items-center">
          <Text className="text-text-muted font-body">{t("common.loading")}</Text>
        </View>
      </Screen>
    );
  }

  if (error || !campaign) {
    return (
      <Screen>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View className="py-xl items-center">
          <Text className="text-text-muted font-body">{error ?? "Not found"}</Text>
        </View>
      </Screen>
    );
  }

  const isOwner = user?.id === campaign.travelerId;
  const icon = MODE_ICON[campaign.mode as TransportMode] ?? "navigate";
  const name = campaign.traveler.displayName ?? campaign.traveler.firstName;

  async function archive() {
    Alert.alert("Archiver l'annonce ?", "Elle ne sera plus visible.", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Archiver",
        style: "destructive",
        onPress: async () => {
          await updateCampaign(campaign!.id, { status: "ARCHIVED" });
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title={campaign.title} onBack={() => router.back()} />

      {/* Featured banner */}
      {campaign.featured ? (
        <View className="mt-md rounded-field bg-amber-500/20 border border-amber-500/40 px-card-padding py-2 flex-row items-center gap-2">
          <Ionicons name="star" size={14} color="#f59e0b" />
          <Text className="text-amber-600 font-body text-sm font-semibold">
            {t("campaign.featuredBadge")}
          </Text>
        </View>
      ) : null}

      {/* Traveler card */}
      <Card className="mt-md flex-row items-center gap-3">
        <Avatar name={name} size="md" />
        <View className="flex-1">
          <Text className="text-oncard font-heading font-bold text-base">{name}</Text>
          <Text className="text-text-secondary font-mono text-meta">
            ★ {campaign.traveler.averageRating?.toFixed(1) ?? "—"} · {campaign.traveler.completedDeliveries ?? 0} livraisons
          </Text>
          {campaign.traveler.trustBadge ? (
            <Text className="text-accent font-body text-xs mt-0.5">
              {campaign.traveler.trustBadge}
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Corridor */}
      <Card className="mt-stack-gap gap-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.accent} />
          <View className="flex-1">
            <Text className="text-oncard font-heading font-bold text-base">
              {campaign.originCity} ({campaign.originCountry}) → Algérie
            </Text>
            <Text className="text-text-secondary font-body text-sm">
              {campaign.destWilayas.join(", ")}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-glass rounded-md px-3 py-2">
            <Text className="text-text-muted font-body text-[11px] uppercase mb-0.5">Départ</Text>
            <Text className="text-oncard font-mono text-sm font-semibold">
              {formatDate(campaign.departureDate)}
            </Text>
          </View>
          <View className="flex-1 bg-glass rounded-md px-3 py-2">
            <Text className="text-text-muted font-body text-[11px] uppercase mb-0.5">Retour</Text>
            <Text className="text-oncard font-mono text-sm font-semibold">
              {campaign.returnDate ? formatDate(campaign.returnDate) : t("campaign.noReturn")}
            </Text>
          </View>
        </View>
      </Card>

      {/* Capacity + price */}
      <Card className="mt-stack-gap flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="scale-outline" size={18} color={colors.accent} />
          <View>
            <Text className="text-text-muted font-body text-xs">Capacité</Text>
            <Text className="text-oncard font-mono text-sm font-semibold">
              {campaign.capacityKg} kg dispo
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-text-muted font-body text-xs">Prix</Text>
          <Text className="text-accent font-heading font-bold text-xl">
            {campaign.pricePerKg.toFixed(2)} €<Text className="text-text-muted text-sm font-body">/kg</Text>
          </Text>
        </View>
      </Card>

      {/* Description */}
      {campaign.description ? (
        <Card className="mt-stack-gap gap-2">
          <Text className="text-text-secondary font-mono text-meta uppercase tracking-wide">
            {t("campaign.description")}
          </Text>
          <Text className="text-oncard font-body text-sm leading-relaxed">
            {campaign.description}
          </Text>
        </Card>
      ) : null}

      {/* CTA */}
      <View className="mt-xl gap-stack-gap pb-xl">
        <Button
          label={t("campaign.sendParcel")}
          onPress={() => router.push("/post-parcel")}
        />
        {isOwner ? (
          <Button label="Archiver l'annonce" variant="ghost" onPress={archive} />
        ) : null}
      </View>
    </Screen>
  );
}
