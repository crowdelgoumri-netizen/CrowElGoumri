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
import { MODE_LABEL } from "../../src/lib/format";
import { POPULAR_CORRIDORS } from "../../src/config/corridors";
import type { TransportMode } from "../../src/lib/types";

const MODE_OPTIONS = [
  { value: "", label: "Tous les modes" },
  ...Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label })),
];

type Tab = "trips" | "parcels";

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const colors = useThemeColors();
  const [tab, setTab] = useState<Tab>("trips");
  const [mode, setMode] = useState<string>("");

  const trips = useAsync(
    () => tripsApi.listPublished(mode ? { mode: mode as TransportMode } : {}),
    [mode],
  );
  const parcels = useAsync(() => parcelsApi.listMine(), []);

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center justify-between mt-md">
        <View className="flex-1">
          <Text className="text-text-muted font-body text-sm">
            Bonjour, {user?.firstName ?? "👋"}
          </Text>
          <Text className="text-text-primary font-heading text-2xl font-bold">
            Europe → Algérie
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
          Corridors populaires
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
        <SegBtn label="Voyageurs" active={tab === "trips"} onPress={() => setTab("trips")} />
        <SegBtn label="Mes colis" active={tab === "parcels"} onPress={() => setTab("parcels")} />
      </View>

      {/* Filter (trips only) */}
      {tab === "trips" ? (
        <View className="mt-stack-gap">
          <Select
            label="Filtrer par mode de transport"
            value={mode}
            options={MODE_OPTIONS}
            onSelect={setMode}
            placeholder="Tous les modes"
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
  if (loading && !trips) {
    return <Loader />;
  }
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Connexion impossible"
        subtitle={error}
        ctaLabel="Réessayer"
        onCta={onRefresh}
      />
    );
  }
  if (trips && trips.length === 0) {
    return (
      <EmptyState
        icon="airplane-outline"
        title="Aucun trajet publié"
        subtitle="Les voyageurs apparaîtront ici. Revenez bientôt !"
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
  if (loading && !parcels) {
    return <Loader />;
  }
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Connexion impossible"
        subtitle={error}
        ctaLabel="Réessayer"
        onCta={onRefresh}
      />
    );
  }
  if (parcels && parcels.length === 0) {
    return (
      <EmptyState
        icon="cube-outline"
        title="Aucun colis"
        subtitle="Touchez le bouton + pour envoyer votre premier colis."
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
