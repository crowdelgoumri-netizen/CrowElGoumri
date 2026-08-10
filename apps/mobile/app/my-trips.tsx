/**
 * My trips — the traveler's own trips (linked from Profile).
 *
 * Lists every trip the caller owns across all statuses (PUBLISHED, MATCHING,
 * IN_PROGRESS, COMPLETED…) so the traveler can manage each. Tapping opens the
 * trip detail where they accept parcels and post checkpoints.
 */
import { router } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TripCard } from "../src/components/TripCard";
import { EmptyState } from "../src/components/EmptyState";
import { useAsync } from "../src/hooks/useAsync";
import { listMine } from "../src/lib/trips";

export default function MyTripsScreen() {
  const { data, loading, error, refresh } = useAsync(() => listMine(), []);
  const trips = data?.trips ?? [];

  return (
    <Screen>
      <ScreenHeader title="Mes trajets" />
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
              title="Connexion impossible"
              subtitle={error}
              ctaLabel="Réessayer"
              onCta={refresh}
            />
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="Aucun trajet"
              subtitle="Touchez le bouton + pour proposer votre premier trajet."
              ctaLabel="Proposer un trajet"
              onCta={() => router.push("/post-trip")}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#FF6A2B" />}
      />
    </Screen>
  );
}
