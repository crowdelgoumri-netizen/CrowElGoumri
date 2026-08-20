/**
 * Home / Browse (board 02) — the marketplace hub.
 *
 * Segmented between "Voyageurs" (browse PUBLISHED trips) and "Mes colis"
 * (the sender's own parcels), with popular-corridor quick picks and a filter
 * for transport mode (board 17). The "+" FAB in the tab shell is the entry to
 * posting.
 */
import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { TripCard } from "../../src/components/TripCard";
import { ParcelCard } from "../../src/components/ParcelCard";
import { EmptyState } from "../../src/components/EmptyState";
import { Select } from "../../src/components/Select";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import * as tripsApi from "../../src/lib/trips";
import * as parcelsApi from "../../src/lib/parcels";
import { MODE_KEY } from "../../src/lib/format";
import { POPULAR_CORRIDORS } from "../../src/config/corridors";
import type { TransportMode } from "../../src/lib/types";

type Tab = "trips" | "parcels";

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const tokens = useAuth((s) => s.tokens);
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("trips");
  const [mode, setMode] = useState<string>("");

  const modeOptions = [
    { value: "", label: t("home.allModes") },
    ...Object.entries(MODE_KEY).map(([value, key]) => ({ value, label: t(key) })),
  ];

  const trips = useAsync(
    () => tripsApi.listPublished(mode ? { mode: mode as TransportMode } : {}),
    [mode],
  );
  // Guests have no parcels — the "Mes colis" segment shows a login CTA.
  const parcels = useAsync(
    () =>
      tokens
        ? parcelsApi.listMine()
        : Promise.resolve(null as parcelsApi.ListParcelsResponse | null),
    [!!tokens],
  );

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center justify-between mt-md">
        <View className="flex-1">
          <Text className="text-text-muted font-body text-sm">
            {t("home.greeting", { name: user?.firstName ?? "👋" })}
          </Text>
          <Text className="text-text-primary font-heading text-2xl font-bold">
            {t("home.corridor")}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications")}
          className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Popular corridors */}
      <View className="mt-section-gap">
        <Text className="font-mono text-meta uppercase tracking-wide text-text-secondary mb-2">
          {t("home.popularCorridors")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {POPULAR_CORRIDORS.map((c) => (
            <View
              key={c}
              className="rounded-chip bg-chip-bg border border-chip-border px-3 py-1.5"
            >
              <Text className="text-text-secondary font-body text-xs">{c}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Segmented toggle */}
      <View className="flex-row bg-glass rounded-chip p-1 mt-section-gap">
        <SegBtn label={t("home.segmentTrips")} active={tab === "trips"} onPress={() => setTab("trips")} />
        <SegBtn label={t("home.segmentParcels")} active={tab === "parcels"} onPress={() => setTab("parcels")} />
      </View>

      {/* Filter (trips only) */}
      {tab === "trips" ? (
        <View className="mt-stack-gap">
          <Select
            label={t("home.filterMode")}
            value={mode}
            options={modeOptions}
            onSelect={setMode}
            placeholder={t("home.allModes")}
          />
        </View>
      ) : null}

      {/* List */}
      <View className="mt-stack-gap">
        {tab === "trips" ? (
          <TripsList
            loading={trips.loading}
            error={trips.error}
            trips={trips.data?.trips ?? null}
            onRefresh={trips.refresh}
          />
        ) : !tokens ? (
          <EmptyState
            icon="cube-outline"
            title={t("home.guestParcelsTitle")}
            subtitle={t("home.guestParcelsSubtitle")}
            ctaLabel={t("common.login")}
            onCta={() => router.push("/auth/login")}
          />
        ) : (
          <ParcelsList
            loading={parcels.loading}
            error={parcels.error}
            parcels={parcels.data?.parcels ?? null}
            onRefresh={parcels.refresh}
          />
        )}
      </View>
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

function TripsList({
  loading,
  error,
  trips,
  onRefresh,
}: {
  loading: boolean;
  error: string | null;
  trips: tripsApi.Trip[] | null;
  onRefresh: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  if (loading && !trips) {
    return <Loader />;
  }
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title={t("common.errorTitle")}
        subtitle={error}
        ctaLabel={t("common.retry")}
        onCta={onRefresh}
      />
    );
  }
  if (trips && trips.length === 0) {
    return (
      <EmptyState
        icon="airplane-outline"
        title={t("home.noTripsTitle")}
        subtitle={t("home.noTripsSubtitle")}
      />
    );
  }
  return (
    <FlatList
      data={trips ?? []}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TripCard trip={item} onPress={(t) => router.push(`/trip/${t.id}`)} />
      )}
      ItemSeparatorComponent={() => <View className="h-3" />}
      scrollEnabled={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />}
    />
  );
}

function ParcelsList({
  loading,
  error,
  parcels,
  onRefresh,
}: {
  loading: boolean;
  error: string | null;
  parcels: parcelsApi.Parcel[] | null;
  onRefresh: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  if (loading && !parcels) {
    return <Loader />;
  }
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title={t("common.errorTitle")}
        subtitle={error}
        ctaLabel={t("common.retry")}
        onCta={onRefresh}
      />
    );
  }
  if (parcels && parcels.length === 0) {
    return (
      <EmptyState
        icon="cube-outline"
        title={t("home.noParcelsTitle")}
        subtitle={t("home.noParcelsSubtitle")}
      />
    );
  }
  return (
    <FlatList
      data={parcels ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <ParcelCard parcel={item} onPress={(p) => router.push(`/parcel/${p.id}`)} />
      )}
      ItemSeparatorComponent={() => <View className="h-3" />}
      scrollEnabled={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />}
    />
  );
}

function Loader() {
  const colors = useThemeColors();
  return (
    <View className="py-xl items-center">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
