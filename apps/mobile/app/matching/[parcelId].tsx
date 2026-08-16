/**
 * Matches found (board 07 + empty state 12) — the sender's view of ranked
 * traveler trips for their parcel.
 *
 * The match engine (GET /matching/parcels/:id) returns top trips by score.
 * In v1, acceptance is traveler-driven: a traveler finds the parcel (via
 * /matching/trips/:id) and accepts it. So this screen surfaces the best
 * candidates and tells the sender they'll be notified when one accepts —
 * tapping a card opens the trip detail to vet the traveler.
 */
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { MatchCard } from "../../src/components/MatchCard";
import { EmptyState } from "../../src/components/EmptyState";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getMatchesForParcel } from "../../src/lib/matching";

export default function MatchingScreen() {
  const colors = useThemeColors();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const { data, loading, error, refresh } = useAsync(
    () => getMatchesForParcel(parcelId),
    [parcelId],
  );
  const matches = data?.matches ?? [];

  return (
    <Screen>
      <ScreenHeader title="Voyageurs disponibles" subtitle={`${data?.totalCandidates ?? 0} trajets candidats`} />

      {matches.length === 0 && !loading && !error ? (
        <EmptyState
          icon="search-outline"
          title="Aucun voyageur pour l'instant"
          subtitle="Aucun trajet ne correspond à votre colis actuellement. Dès qu'un voyageur accepte, vous serez notifié."
          ctaLabel="Retour au colis"
          onCta={() => router.back()}
        />
      ) : null}

      {error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          subtitle={error}
          ctaLabel="Réessayer"
          onCta={refresh}
        />
      ) : null}

      <FlatList
        data={matches}
        keyExtractor={(m) => m.tripId}
        renderItem={({ item, index }) => (
          <MatchCard
            match={item}
            index={index}
            ctaLabel="Voir le trajet"
            onPress={(m) => router.push(`/trip/${m.tripId}`)}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        scrollEnabled={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      />

      {matches.length > 0 ? (
        <Card className="mt-section-gap bg-info/10 border-info/30">
          <Text className="text-text-secondary font-body text-xs">
            💡 Dès qu'un voyageur accepte votre colis, recevez une notification et
            sécurisez le paiement en escrow. Le voyageur confirme la livraison
            avec un code à 6 chiffres.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
