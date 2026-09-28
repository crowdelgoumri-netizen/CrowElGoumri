/**
 * Home (board 02, DiasporaCart) — the dual-intent landing hub.
 *
 * Hero: "Vous voyagez vers l'Algérie ?" (deep-green card, travel art, CTA to
 * publish a trip). Second intent: "J'envoie un colis" (white card → Rechercher
 * tab). Below: popular corridors (tap → pre-filtered search), the live feed
 * of published trips (real data), a trust strip, and the community invite.
 * Guests browse everything; publishing CTAs lead to the auth wall.
 */
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { TripCard } from "../../src/components/TripCard";
import { EmptyState } from "../../src/components/EmptyState";
import { SenderArt } from "../../src/components/Illustrations";
import { Card } from "../../src/components/Card";
import { HomeHero } from "../../src/components/HomeHero";
import { HomeActionBar } from "../../src/components/HomeActionBar";
import { HowItWorks } from "../../src/components/HowItWorks";
import { PromoCards } from "../../src/components/PromoCards";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import * as tripsApi from "../../src/lib/trips";
import { POPULAR_CORRIDORS } from "../../src/config/corridors";

const TRUST = [
  { icon: "lock-closed-outline", key: "home.trustEscrow" },
  { icon: "shield-checkmark-outline", key: "home.trustVerified" },
  { icon: "locate-outline", key: "home.trustTracking" },
] as const;

const STATS = [
  { icon: "earth-outline", valueKey: "home.heroBanner.statTravelersValue", labelKey: "home.heroBanner.statTravelersLabel" },
  { icon: "cube-outline", valueKey: "home.heroBanner.statParcelsValue", labelKey: "home.heroBanner.statParcelsLabel" },
  { icon: "star", valueKey: "home.heroBanner.statRatingValue", labelKey: "home.heroBanner.statRatingLabel" },
  { icon: "shield-checkmark", valueKey: "home.heroBanner.statSecureValue", labelKey: "home.heroBanner.statSecureLabel" },
] as const;

export default function HomeScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();

  const trips = useAsync(() => tripsApi.listPublished({}), []);
  const feed = (trips.data?.trips ?? []).slice(0, 5);

  return (
    <Screen scroll={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-edge pb-xl"
        refreshControl={
          <RefreshControl refreshing={trips.loading} onRefresh={trips.refresh} tintColor={colors.accent} />
        }
      >
        <HomeHero />
        <HomeActionBar />

        <Card raised className="mt-section-gap flex-row">
          {STATS.map((s, i) => (
            <StatItem key={s.icon} icon={s.icon} valueKey={s.valueKey} labelKey={s.labelKey} divider={i > 0} />
          ))}
        </Card>

        <HowItWorks />
        <PromoCards />

        {/* Sender intent */}
        <View className="mt-stack-gap rounded-card bg-glass border border-hairline">
          <View className="flex-row items-center">
            <View className="flex-1 py-lg pl-lg pr-sm" style={{ maxWidth: "68%" }}>
              <Text className="text-text-primary font-heading text-lg font-bold leading-6">
                {t("home.senderTitle")}
              </Text>
              <Text className="text-text-secondary font-body text-sm mt-1 leading-5">
                {t("home.senderBody")}
              </Text>
            </View>
            <View className="pr-md">
              <SenderArt />
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/search")}
            className="mx-lg mb-lg mt-1 flex-row items-center justify-center gap-2 rounded-field border border-accent bg-transparent py-3.5 active:opacity-80"
          >
            <Ionicons name="search" size={17} color={colors.accent} />
            <Text className="text-accent font-heading font-bold text-base">
              {t("home.senderCta")}
            </Text>
          </Pressable>
        </View>

        {/* Popular corridors */}
        <View className="mt-section-gap">
          <SectionTitle title={t("home.popularCorridors")} />
          <View className="flex-row flex-wrap gap-2 mt-2.5">
            {POPULAR_CORRIDORS.map((c) => (
              <Pressable
                key={c}
                onPress={() =>
                  router.push({ pathname: "/(tabs)/search", params: { corridor: c } })
                }
                className="rounded-chip bg-chip-bg border border-chip-border px-3.5 py-2 active:opacity-70"
              >
                <Text className="text-text-secondary font-body text-xs font-medium">
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Live travelers feed */}
        <View className="mt-section-gap">
          <View className="flex-row items-center justify-between">
            <SectionTitle title={t("home.travelersFeed")} />
            <Pressable onPress={() => router.push("/(tabs)/search")}>
              <Text className="text-accent font-heading text-xs font-bold">
                {t("home.seeAll")}
              </Text>
            </Pressable>
          </View>
          <View className="mt-2.5 gap-3">
            {trips.loading && feed.length === 0 ? (
              <View className="py-xl items-center">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : trips.error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title={t("common.errorTitle")}
                subtitle={trips.error}
                ctaLabel={t("common.retry")}
                onCta={trips.refresh}
              />
            ) : feed.length === 0 ? (
              <EmptyState
                icon="airplane-outline"
                title={t("home.noTripsTitle")}
                subtitle={t("home.noTripsSubtitle")}
              />
            ) : (
              feed.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={(tr) => router.push(`/trip/${tr.id}`)}
                />
              ))
            )}
          </View>
        </View>

        {/* Trust strip */}
        <View className="mt-section-gap">
          <SectionTitle title={t("home.trustTitle")} />
          <View className="flex-row gap-3 mt-2.5">
            {TRUST.map((item) => (
              <View
                key={item.key}
                className="flex-1 items-center rounded-card bg-glass border border-hairline py-card-padding gap-2"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-info/15">
                  <Ionicons name={item.icon} size={19} color={colors.infoIcon} />
                </View>
                <Text className="text-text-secondary font-body text-xs font-medium text-center leading-4">
                  {t(item.key)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Community */}
        <View className="mt-section-gap rounded-card bg-chip-bg border border-chip-border p-card-padding">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
              <Ionicons name="people-outline" size={22} color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-text-primary font-heading font-bold text-base">
                {t("home.communityTitle")}
              </Text>
              <Text className="text-text-secondary font-body text-xs mt-0.5 leading-4">
                {t("home.communityBody")}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/invite")}
            className="mt-card-padding flex-row items-center justify-center gap-2 rounded-field bg-accent py-3.5 active:opacity-80"
          >
            <Ionicons name="gift-outline" size={17} color={colors.accentOn} />
            <Text className="text-accent-on font-heading font-bold text-sm">
              {t("home.communityCta")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-text-primary font-heading font-bold text-base">
      {title}
    </Text>
  );
}

function StatItem({
  icon,
  valueKey,
  labelKey,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  valueKey: string;
  labelKey: string;
  divider: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className={"flex-1 items-center gap-1" + (divider ? " border-l border-hairline" : "")}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text className="font-heading font-bold text-text-primary text-xs">{t(valueKey)}</Text>
      <Text className="font-body text-text-muted text-[9px] text-center">{t(labelKey)}</Text>
    </View>
  );
}
