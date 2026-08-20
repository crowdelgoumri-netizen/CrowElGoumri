/**
 * My trips — the traveler's own trips (linked from Profile).
 *
 * Lists every trip the caller owns across all statuses (PUBLISHED, MATCHING,
 * IN_PROGRESS, COMPLETED…) so the traveler can manage each. Tapping opens the
 * trip detail where they accept parcels and post checkpoints.
 */
import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TripCard } from "../src/components/TripCard";
import { EmptyState } from "../src/components/EmptyState";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { listMine } from "../src/lib/trips";

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
      <ScreenHeader title={t("myTrips.title")} />
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={(t) => router.push(`/trip/${t.id}`)} />
        )}
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      />
    </Screen>
  );
}
