/**
 * Mes voyages tab — the traveler's own trips.
 *
 * Lists every trip the caller owns across all statuses (PUBLISHED, MATCHING,
 * IN_PROGRESS, COMPLETED…) so the traveler can manage each, with the primary
 * "Ajouter mon voyage" CTA up top (the FAB's replacement). Tapping a trip
 * opens the detail where they accept parcels and post checkpoints.
 */
import { router } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { TripCard } from "../../src/components/TripCard";
import { EmptyState } from "../../src/components/EmptyState";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { listMine } from "../../src/lib/trips";

export default function MyTripsScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh } = useAsync(() => listMine(), []);
  const trips = data?.trips ?? [];

  // Own-trips is per-account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("myTrips.title")} />;
  }

  return (
    <Screen>
      <FlatList
        data={trips}
        keyExtractor={(tr) => tr.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={(tr) => router.push(`/trip/${tr.id}`)} />
        )}
        ListHeaderComponent={
          <View className="mt-md mb-stack-gap">
            <Text className="text-text-primary font-heading text-screen-title font-bold">
              {t("myTrips.title")}
            </Text>
            <Text className="text-text-secondary font-body text-sm mt-1">
              {t("myTrips.subtitle")}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          loading ? null : error ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("common.errorTitle")}
              subtitle={error}
              ctaLabel={t("common.retry")}
              onCta={refresh}
            />
          ) : (
            <EmptyState
              icon="airplane-outline"
              title={t("myTrips.emptyTitle")}
              subtitle={t("myTrips.emptySubtitle")}
              ctaLabel={t("myTrips.postTripCta")}
              onCta={() => router.push("/post-trip")}
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      />
    </Screen>
  );
}
