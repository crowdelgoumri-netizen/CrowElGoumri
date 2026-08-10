/**
 * Trip detail — the traveler's command center, plus the sender/browsing view.
 *
 *  - Traveler (owns the trip): accepts parcels from ranked matches, posts
 *    checkpoints (DEPARTURE advances → IN_PROGRESS, ARRIVAL may complete),
 *    and watches accepted parcels progress.
 *  - Anyone else: a read-only vetting view of a PUBLISHED trip + its traveler.
 *
 * Acceptance is traveler-driven (POST /matching/accept), so the matches
 * section only renders for the trip's owner while the trip is bookable.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { Avatar } from "../../src/components/Avatar";
import { EmptyState } from "../../src/components/EmptyState";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import {
  addCheckpoint,
  getTrip,
  type Trip,
  type CheckpointType,
} from "../../src/lib/trips";
import { acceptParcel, getMatchesForTrip, type Match } from "../../src/lib/matching";
import { ApiError } from "../../src/lib/api";
import {
  cityOf,
  eur,
  formatDate,
  MODE_ICON,
  MODE_LABEL,
  PARCEL_STATUS,
  TRIP_STATUS,
} from "../../src/lib/format";
import type { TransportMode } from "../../src/lib/types";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);
  const { data, loading, error, refresh } = useAsync(() => getTrip(id), [id]);
  const trip = data?.trip;
  const isTraveler = !!user && trip?.travelerId === user.id;
  const bookable = trip ? ["PUBLISHED", "MATCHING"].includes(trip.status) : false;

  if (loading && !trip) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Trajet" />
        <Text className="text-muted">Chargement…</Text>
      </Screen>
    );
  }
  if (error || !trip) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Trajet" />
        <Text className="text-danger">{error ?? "Trajet introuvable."}</Text>
        <View className="mt-md">
          <Button label="Réessayer" variant="secondary" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const st = TRIP_STATUS[trip.status];
  const remaining = Math.max(0, trip.maxWeightKg - (trip.currentWeightKg ?? 0));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader title="Trajet" subtitle={`${cityOf(trip.origin)} → ${cityOf(trip.destination)}`} />
        <StatusPill label={st.label} tone={st.tone} />

        {/* Trip info */}
        <Card className="mt-md gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name={MODE_ICON[trip.mode as TransportMode] as keyof typeof Ionicons.glyphMap} size={18} color="#FF6A2B" />
            <Text className="text-white font-heading font-bold text-lg flex-1">
              {cityOf(trip.origin)} → {cityOf(trip.destination)}
            </Text>
          </View>
          <Row k="Départ" v={formatDate(trip.departureTime)} />
          <Row k="Mode" v={MODE_LABEL[trip.mode as TransportMode] ?? trip.mode} />
          <Row k="Capacité restante" v={`${remaining.toFixed(1)} / ${trip.maxWeightKg} kg`} />
          {trip.pricePerKg != null ? <Row k="Prix" v={`${eur(trip.pricePerKg)}/kg`} /> : null}
          {trip.notes ? <Row k="Notes" v={trip.notes} /> : null}
        </Card>

        {/* Traveler */}
        <Card className="mt-md">
          <View className="flex-row items-center gap-md">
            <Avatar name={trip.traveler?.firstName} />
            <View className="flex-1">
              <Text className="text-white font-body font-semibold">
                {trip.traveler?.firstName} {trip.traveler?.lastName ?? ""}
              </Text>
              <Text className="text-muted text-xs font-body">
                {trip.traveler?.completedTrips ?? 0} trajets · {trip.traveler?.trustBadge ?? "—"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Accepted parcels */}
        {trip.parcels && trip.parcels.length > 0 ? (
          <View className="mt-md">
            <Text className="text-mist/60 text-xs font-body uppercase mb-2">
              Colis transportés ({trip.parcels.length})
            </Text>
            {trip.parcels.map((p) => {
              const ps = PARCEL_STATUS[p.status];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/parcel/${p.id}`)}
                  className="flex-row items-center justify-between rounded-card bg-navySoft/60 border border-line p-md mb-2 active:opacity-70"
                >
                  <View className="flex-1">
                    <Text className="text-white font-body text-sm" numberOfLines={1}>
                      {p.description}
                    </Text>
                    <Text className="text-muted text-xs font-body">{p.weightKg} kg</Text>
                  </View>
                  {ps ? <StatusPill label={ps.label} tone={ps.tone} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Traveler-only: matches + checkpoints */}
        {isTraveler ? (
          <View className="mt-lg gap-md">
            {bookable ? (
              <TravelerMatches tripId={trip.id} onAccepted={refresh} />
            ) : null}

            <Checkpoints trip={trip} onPosted={refresh} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function TravelerMatches({ tripId, onAccepted }: { tripId: string; onAccepted: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, loading, error, refresh } = useAsync(() => getMatchesForTrip(tripId), [tripId]);
  const matches = data?.matches ?? [];

  async function accept(parcelId: string) {
    setBusyId(parcelId);
    try {
      await acceptParcel(tripId, parcelId);
      Alert.alert("Colis accepté 🎉", "Le colis est désormais sur votre trajet. L'expéditeur a été notifié.");
      onAccepted();
      refresh();
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View>
      <Text className="text-mist/60 text-xs font-body uppercase mb-2">Colis recommandés</Text>
      {loading && matches.length === 0 ? (
        <Text className="text-muted">Recherche de colis…</Text>
      ) : null}
      {error ? (
        <Text className="text-danger text-sm">{error}</Text>
      ) : null}
      {matches.length === 0 && !loading && !error ? (
        <EmptyState
          icon="cube-outline"
          title="Aucun colis pour l'instant"
          subtitle="Les colis compatibles apparaîtront ici. Vous serez notifié quand un expéditeur publie sur votre corridor."
        />
      ) : null}
      {matches.map((m: Match, i) => (
        <ParcelMatchCard
          key={m.parcelId ?? i}
          match={m}
          top={i === 0}
          accepting={busyId === m.parcelId}
          onAccept={() => m.parcelId && accept(m.parcelId)}
        />
      ))}
    </View>
  );
}

/** A ranked parcel match for the traveler (score + reasons + accept). */
function ParcelMatchCard({
  match,
  top,
  accepting,
  onAccept,
}: {
  match: Match;
  top: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  const score = Math.round(match.score ?? 0);
  return (
    <Card variant={top ? "light" : "dark"} className={top ? "border-accent gap-2 mb-3" : "gap-2 mb-3"}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="cube" size={18} color="#FF6A2B" />
          <Text className="text-white font-body font-semibold">
            Colis #{match.parcelId?.slice(-5) ?? "—"}
          </Text>
        </View>
        {top ? (
          <View className="rounded-pill bg-success px-2 py-0.5">
            <Text className="text-white text-xs font-bold">Top</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {(match.reasons ?? []).slice(0, 3).map((r, i) => (
          <View key={i} className="rounded-pill bg-navySoft/60 px-2 py-1">
            <Text className="text-mist text-xs font-body">{r}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between mt-1">
        <View className="flex-row items-center gap-1.5 flex-1">
          <Ionicons name="sparkles" size={14} color="#FF6A2B" />
          <View className="h-1.5 flex-1 max-w-[80px] rounded-full bg-mist/10 overflow-hidden">
            <View
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(8, score))}%` }}
            />
          </View>
          <Text className="text-mist text-xs font-body">{score}%</Text>
        </View>
        {match.estimatedPrice != null ? (
          <Text className="text-accent font-heading font-bold">{eur(match.estimatedPrice)}</Text>
        ) : null}
        <Pressable
          onPress={onAccept}
          disabled={accepting}
          className="rounded-pill bg-accent px-3 py-1.5 ml-2"
        >
          <Text className="text-white text-xs font-bold">
            {accepting ? "…" : "Accepter"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const CHECKPOINTS: { type: CheckpointType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "DEPARTURE", label: "Départ", icon: "airplane-outline" },
  { type: "TRANSIT", label: "Transit", icon: "navigate-outline" },
  { type: "CUSTOMS", label: "Douane", icon: "shield-outline" },
  { type: "ARRIVAL", label: "Arrivée", icon: "flag-outline" },
];

function Checkpoints({ trip, onPosted }: { trip: Trip; onPosted: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function post(type: CheckpointType, label: string) {
    setBusy(type);
    try {
      const res = await addCheckpoint(trip.id, { type, location: { address: label } });
      Alert.alert(
        "Point enregistré",
        `Statut du trajet : ${TRIP_STATUS[res.tripStatus]?.label ?? res.tripStatus}.`,
      );
      onPosted();
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View>
      <Text className="text-mist/60 text-xs font-body uppercase mb-2">Avancement du trajet</Text>
      <View className="flex-row flex-wrap gap-2">
        {CHECKPOINTS.map((c) => (
          <Pressable
            key={c.type}
            onPress={() => post(c.type, c.label)}
            disabled={busy !== null}
            className="flex-row items-center gap-1.5 rounded-pill bg-navySoft/60 border border-line px-3 py-2 active:opacity-70"
          >
            <Ionicons name={c.icon} size={14} color="#FF6A2B" />
            <Text className="text-white font-body text-sm">{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {busy ? <Text className="text-muted text-xs mt-2">Enregistrement…</Text> : null}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between gap-md">
      <Text className="text-muted font-body text-sm">{k}</Text>
      <Text className="text-white font-body text-sm font-semibold text-right flex-shrink" numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}
