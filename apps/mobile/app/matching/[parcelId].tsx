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
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { MatchCard } from "../../src/components/MatchCard";
import { EmptyState } from "../../src/components/EmptyState";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getMatchesForParcel } from "../../src/lib/matching";

export default function MatchingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh } = useAsync(
    () => getMatchesForParcel(parcelId),
    [parcelId],
  );
  const matches = data?.matches ?? [];

  // Matching is tied to the sender's parcel — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("matching.title")} />;
  }

  return (
    <Screen>
      <ScreenHeader title={t("matching.title")} subtitle={t("matching.candidatesSubtitle", { n: data?.totalCandidates ?? 0 })} />

      {matches.length === 0 && !loading && !error ? (
        <EmptyState
          icon="search-outline"
          title={t("matching.emptyTitle")}
          subtitle={t("matching.emptySubtitle")}
          ctaLabel={t("matching.backToParcel")}
          onCta={() => router.back()}
        />
      ) : null}

      {error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.errorTitle")}
          subtitle={error}
          ctaLabel={t("common.retry")}
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
            ctaLabel={t("matching.viewTrip")}
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
            {t("matching.hint")}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
