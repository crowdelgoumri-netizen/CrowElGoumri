/**
 * Trip detail ("Détail du voyageur", board 05) — the traveler's command
 * center, plus the sender/browsing vetting view.
 *
 *  - Anyone: a vetting view of a PUBLISHED trip + its traveler — hero card
 *    (avatar on the green banner, verified ticks, rating, trip count), the
 *    route with a capacity bar, price, and the "Faire une demande" CTA into
 *    the parcel flow.
 *  - Traveler (owns the trip): accepts parcels from ranked matches, posts
 *    checkpoints (DEPARTURE advances → IN_PROGRESS, ARRIVAL may complete),
 *    and watches accepted parcels progress.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { Avatar } from "../../src/components/Avatar";
import { EmptyState } from "../../src/components/EmptyState";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
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
  MODE_KEY,
  PARCEL_STATUS,
  TRIP_STATUS,
} from "../../src/lib/format";
import type { TransportMode } from "../../src/lib/types";

export default function TripDetailScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);
  const { data, loading, error, refresh } = useAsync(() => getTrip(id), [id]);
  const trip = data?.trip;
  const isTraveler = !!user && trip?.travelerId === user.id;
  const bookable = trip ? ["PUBLISHED", "MATCHING"].includes(trip.status) : false;

  if (loading && !trip) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("tripDetail.title")} />
        <Text className="text-text-muted">{t("common.loading")}</Text>
      </Screen>
    );
  }
  if (error || !trip) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("tripDetail.title")} />
        <Text className="text-danger">{error ?? t("tripDetail.notFound")}</Text>
        <View className="mt-section-gap">
          <Button label={t("common.retry")} variant="secondary" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const st = TRIP_STATUS[trip.status];
  const remaining = Math.max(0, trip.maxWeightKg - (trip.currentWeightKg ?? 0));
  const usedPct = Math.min(
    100,
    Math.round(((trip.currentWeightKg ?? 0) / trip.maxWeightKg) * 100),
  );
  const rating = trip.traveler?.averageRating;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader title={t("tripDetail.title")} />

        {/* Traveler hero */}
        <Card className="overflow-hidden p-0">
          <View className="h-24 bg-accent" style={{ position: "relative", overflow: "hidden" }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <Svg width="100%" height="100%" viewBox="0 0 320 96" preserveAspectRatio="none">
                <Path d="M0 70 Q160 40 320 66 V96 H0 Z" fill="#000000" opacity={0.12} />
                <Path d="M0 82 Q160 58 320 80 V96 H0 Z" fill="#000000" opacity={0.1} />
              </Svg>
            </View>
          </View>
          <View className="px-card-padding pb-card-padding">
            <View className="flex-row items-end gap-3 -mt-7">
              <View className="rounded-full border-[3px] border-glass">
                <Avatar name={trip.traveler?.firstName} size="lg" />
              </View>
              <View className="flex-1 pb-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-text-primary font-heading font-bold text-lg" numberOfLines={1}>
                    {trip.traveler?.firstName} {trip.traveler?.lastName ?? ""}
                  </Text>
                  {trip.traveler?.trustBadge ? (
                    <Ionicons name="checkmark-circle" size={17} color={colors.successText} />
                  ) : null}
                </View>
                <View className="flex-row items-center gap-2 mt-0.5">
                  {rating != null ? (
                    <View className="flex-row items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(rating) ? "star" : "star-outline"}
                          size={11}
                          color={"#C9A227"}
                        />
                      ))}
                      <Text className="text-text-secondary font-body text-xs ml-1">
                        {rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                  <Text className="text-text-muted font-body text-xs">
                    · {t("tripCard.trips", { n: trip.traveler?.completedTrips ?? 0 })}
                  </Text>
                </View>
              </View>
              <StatusPill label={t(st.key)} tone={st.tone} />
            </View>

            {/* Verified ticks */}
            <View className="flex-row flex-wrap gap-x-4 gap-y-1.5 mt-card-padding">
              {trip.traveler?.trustBadge ? (
                <Tick icon="finger-print-outline" label={t("tripDetail.verifiedIdentity")} />
              ) : null}
              <Tick icon="call-outline" label={t("tripDetail.verifiedPhone")} />
              <Tick icon="ribbon-outline" label={trip.traveler?.trustBadge ?? "—"} />
            </View>
          </View>
        </Card>

        {/* Route */}
        <Card className="mt-stack-gap gap-stack-gap">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-mono text-meta uppercase text-text-muted">
                {t("tripDetail.departure")}
              </Text>
              <Text className="text-text-primary font-heading font-bold text-lg" numberOfLines={1}>
                {cityOf(trip.origin)}
              </Text>
              <Text className="text-text-secondary font-body text-xs mt-0.5">
                {formatDate(trip.departureTime)}
              </Text>
            </View>
            <View className="items-center px-1">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-accent/12">
                <Ionicons
                  name={MODE_ICON[trip.mode as TransportMode] as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={colors.accent}
                />
              </View>
            </View>
            <View className="flex-1 items-end">
              <Text className="font-mono text-meta uppercase text-text-muted">
                {t("tripDetail.arrival")}
              </Text>
              <Text className="text-text-primary font-heading font-bold text-lg" numberOfLines={1}>
                {cityOf(trip.destination)}
              </Text>
              <Text className="text-text-secondary font-body text-xs mt-0.5">
                {trip.estimatedArrival ? formatDate(trip.estimatedArrival) : t(MODE_KEY[trip.mode as TransportMode] ?? trip.mode)}
              </Text>
            </View>
          </View>

          {/* Capacity */}
          <View>
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-text-secondary font-body text-sm">
                {t("tripDetail.capacityLeft")}
              </Text>
              <Text className="text-text-primary font-body text-sm font-semibold">
                {remaining.toFixed(1)} / {trip.maxWeightKg} kg
              </Text>
            </View>
            <View className="h-2 rounded-full bg-text-muted/10 overflow-hidden">
              <View className="h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
            </View>
          </View>

          {/* Price */}
          {trip.pricePerKg != null ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary font-body text-sm">
                {t("tripDetail.price")}
              </Text>
              <Text className="font-heading font-extrabold text-numeral text-accent">
                {eur(trip.pricePerKg)}
                <Text className="text-text-muted text-xs font-body font-normal">
                  {t("tripCard.perKg")}
                </Text>
              </Text>
            </View>
          ) : null}

          {trip.notes ? (
            <View className="rounded-field bg-chip-bg px-card-padding py-3">
              <Text className="text-text-secondary font-body text-sm leading-5">
                “{trip.notes}”
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Sender CTA */}
        {!isTraveler && bookable ? (
          <View className="mt-section-gap">
            <Button
              label={t("tripDetail.requestCta")}
              onPress={() => router.push("/post-parcel")}
            />
            <Text className="text-text-muted font-body text-xs text-center mt-2.5">
              {t("tripDetail.requestHint")}
            </Text>
          </View>
        ) : null}

        {/* Accepted parcels */}
        {trip.parcels && trip.parcels.length > 0 ? (
          <View className="mt-section-gap">
            <Text className="text-text-primary font-heading font-bold text-base mb-2">
              {t("tripDetail.carriedParcels", { n: trip.parcels.length })}
            </Text>
            {trip.parcels.map((p) => {
              const ps = PARCEL_STATUS[p.status];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/parcel/${p.id}`)}
                  className="flex-row items-center justify-between rounded-card bg-glass border border-hairline p-card-padding mb-2 active:opacity-70"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-text-primary font-body text-sm" numberOfLines={1}>
                      {p.description}
                    </Text>
                    <Text className="text-text-muted text-xs font-body">{p.weightKg} kg</Text>
                  </View>
                  {ps ? <StatusPill label={t(ps.key)} tone={ps.tone} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Traveler-only: matches + checkpoints */}
        {isTraveler ? (
          <View className="mt-section-gap gap-stack-gap">
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

function Tick({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={13} color={colors.successText} />
      <Text className="text-text-secondary font-body text-xs">{label}</Text>
    </View>
  );
}

function TravelerMatches({ tripId, onAccepted }: { tripId: string; onAccepted: () => void }) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, loading, error, refresh } = useAsync(() => getMatchesForTrip(tripId), [tripId]);
  const matches = data?.matches ?? [];

  async function accept(parcelId: string) {
    setBusyId(parcelId);
    try {
      await acceptParcel(tripId, parcelId);
      Alert.alert(t("tripDetail.acceptedTitle"), t("tripDetail.acceptedBody"));
      onAccepted();
      refresh();
    } catch (e) {
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View>
      <Text className="text-text-primary font-heading font-bold text-base mb-2">
        {t("tripDetail.recommended")}
      </Text>
      {loading && matches.length === 0 ? (
        <Text className="text-text-muted">{t("tripDetail.searching")}</Text>
      ) : null}
      {error ? (
        <Text className="text-danger text-sm">{error}</Text>
      ) : null}
      {matches.length === 0 && !loading && !error ? (
        <EmptyState
          icon="cube-outline"
          title={t("tripDetail.noMatchesTitle")}
          subtitle={t("tripDetail.noMatchesSubtitle")}
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
  const colors = useThemeColors();
  const { t } = useTranslation();
  const score = Math.round(match.score ?? 0);
  return (
    <Card raised={top} className={top ? "border-accent gap-2 mb-3" : "gap-2 mb-3"}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="cube" size={18} color={colors.accent} />
          <Text className="text-text-primary font-body font-semibold">
            {t("tripDetail.parcelRef", { id: match.parcelId?.slice(-5) ?? "—" })}
          </Text>
        </View>
        {top ? (
          <View className="rounded-chip bg-success px-2 py-0.5">
            <Text className="text-white text-xs font-bold">{t("tripDetail.top")}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {(match.reasons ?? []).slice(0, 3).map((r, i) => (
          <View key={i} className="rounded-chip bg-chip-bg px-2 py-1">
            <Text className="text-text-secondary text-xs font-body">{r}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between mt-1">
        <View className="flex-row items-center gap-1.5 flex-1">
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <View className="h-1.5 flex-1 max-w-[80px] rounded-full bg-text-muted/10 overflow-hidden">
            <View
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(8, score))}%` }}
            />
          </View>
          <Text className="text-text-secondary text-xs font-body">{score}%</Text>
        </View>
        {match.estimatedPrice != null ? (
          <Text className="text-accent font-heading font-bold">{eur(match.estimatedPrice)}</Text>
        ) : null}
        <Pressable
          onPress={onAccept}
          disabled={accepting}
          className="rounded-field bg-accent px-3 py-1.5 ml-2"
        >
          <Text className="text-white text-xs font-bold">
            {accepting ? "…" : t("tripDetail.accept")}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const CHECKPOINTS: { type: CheckpointType; key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "DEPARTURE", key: "tripDetail.checkpointDeparture", icon: "airplane-outline" },
  { type: "TRANSIT", key: "tripDetail.checkpointTransit", icon: "navigate-outline" },
  { type: "CUSTOMS", key: "tripDetail.checkpointCustoms", icon: "shield-outline" },
  { type: "ARRIVAL", key: "tripDetail.checkpointArrival", icon: "flag-outline" },
];

function Checkpoints({ trip, onPosted }: { trip: Trip; onPosted: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);

  async function post(type: CheckpointType, label: string) {
    setBusy(type);
    try {
      const res = await addCheckpoint(trip.id, { type, location: { address: label } });
      Alert.alert(
        t("tripDetail.checkpointSaved"),
        t("tripDetail.tripStatusNow", {
          status: TRIP_STATUS[res.tripStatus] ? t(TRIP_STATUS[res.tripStatus]!.key) : res.tripStatus,
        }),
      );
      onPosted();
    } catch (e) {
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View>
      <Text className="text-text-primary font-heading font-bold text-base mb-2">
        {t("tripDetail.progress")}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {CHECKPOINTS.map((c) => (
          <Pressable
            key={c.type}
            onPress={() => post(c.type, t(c.key))}
            disabled={busy !== null}
            className="flex-row items-center gap-1.5 rounded-field bg-glass border border-hairline px-3 py-2 active:opacity-70"
          >
            <Ionicons name={c.icon} size={14} color={colors.accent} />
            <Text className="text-text-primary font-body text-sm">{t(c.key)}</Text>
          </Pressable>
        ))}
      </View>
      {busy ? <Text className="text-text-muted text-xs mt-2">{t("tripDetail.saving")}</Text> : null}
    </View>
  );
}
