/**
 * Mes demandes (board 07, DiasporaCart) — the sender's parcels.
 *
 * Three segments: "Nouvelles" (not yet taken by a traveler), "En cours"
 * (matched through to in-transit), and "Historique" (delivered/closed).
 * Tapping a card opens the parcel detail (tracking, chat, escrow). Linked
 * from the Profile dashboard.
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

type Seg = "new" | "active" | "history";

// "Nouvelles" merges the design system's "Reçues" idea (not yet taken by a
// traveler) into the existing active/history split, rather than running two
// parallel segmentations side by side.
const NEW = ["DRAFT", "PENDING_MATCH"];
const CLOSED = ["DELIVERED", "CANCELLED", "SEIZED", "DISPUTED"];

export default function ParcelsScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const [seg, setSeg] = useState<Seg>("new");
  const { data, loading, error, refresh } = useAsync(
    () => (tokens ? listMine() : Promise.resolve(null)),
    [!!tokens],
  );

  if (!tokens) {
    return <AuthWall headerTitle={t("parcels.title")} />;
  }

  const all = data?.parcels ?? [];
  const parcels = all.filter((p) => {
    if (seg === "new") return NEW.includes(p.status);
    if (seg === "history") return CLOSED.includes(p.status);
    return !NEW.includes(p.status) && !CLOSED.includes(p.status);
  });

  return (
    <Screen>
      <ScreenHeader title={t("parcels.title")} />

      {/* Segmented toggle */}
      <View className="flex-row bg-glass rounded-chip p-1 mb-stack-gap">
        <SegBtn
          label={t("parcels.segmentNew")}
          active={seg === "new"}
          onPress={() => setSeg("new")}
        />
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
              title={
                seg === "new"
                  ? t("parcels.emptyNewTitle")
                  : seg === "active"
                    ? t("parcels.emptyActiveTitle")
                    : t("parcels.emptyHistoryTitle")
              }
              subtitle={t("parcels.emptySubtitle")}
              ctaLabel={seg !== "history" ? t("parcels.sendCta") : undefined}
              onCta={seg !== "history" ? () => router.push("/post-parcel") : undefined}
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
