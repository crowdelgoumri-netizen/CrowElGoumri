/**
 * Mes demandes (board 07, DiasporaCart) — the sender's parcels.
 *
 * Segmented between "En cours" (everything not yet delivered/cancelled) and
 * "Historique" (delivered + cancelled). Tapping a card opens the parcel
 * detail (tracking, chat, escrow). Linked from the Profile dashboard.
 */
import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { ParcelCard } from "../src/components/ParcelCard";
import { EmptyState } from "../src/components/EmptyState";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { listMine } from "../src/lib/parcels";

type Seg = "active" | "history";

const CLOSED = ["DELIVERED", "CANCELLED", "SEIZED", "DISPUTED"];

export default function ParcelsScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const [seg, setSeg] = useState<Seg>("active");
  const { data, loading, error, refresh } = useAsync(
    () => (tokens ? listMine() : Promise.resolve(null)),
    [!!tokens],
  );

  if (!tokens) {
    return <AuthWall headerTitle={t("parcels.title")} />;
  }

  const all = data?.parcels ?? [];
  const parcels = all.filter((p) =>
    seg === "active" ? !CLOSED.includes(p.status) : CLOSED.includes(p.status),
  );

  return (
    <Screen>
      <ScreenHeader title={t("parcels.title")} />

      {/* Segmented toggle */}
      <View className="flex-row bg-glass rounded-chip p-1 mb-stack-gap">
        <SegBtn
          label={t("parcels.segmentActive")}
          active={seg === "active"}
          onPress={() => setSeg("active")}
        />
        <SegBtn
          label={t("parcels.segmentHistory")}
          active={seg === "history"}
          onPress={() => setSeg("history")}
        />
      </View>

      {loading && all.length === 0 ? (
        <View className="py-xl items-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("common.errorTitle")}
          subtitle={error}
          ctaLabel={t("common.retry")}
          onCta={refresh}
        />
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ParcelCard
              parcel={item}
              onPress={(p) => router.push(`/parcel/${p.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={seg === "active" ? t("parcels.emptyActiveTitle") : t("parcels.emptyHistoryTitle")}
              subtitle={t("parcels.emptySubtitle")}
              ctaLabel={seg === "active" ? t("parcels.sendCta") : undefined}
              onCta={seg === "active" ? () => router.push("/post-parcel") : undefined}
            />
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
          }
        />
      )}
    </Screen>
  );
}

function SegBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        "flex-1 items-center py-2.5 rounded-chip " +
        (active ? "bg-accent" : "bg-transparent")
      }
    >
      <Text
        className={
          "font-body font-semibold text-sm " +
          (active ? "text-accent-on" : "text-text-muted")
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
