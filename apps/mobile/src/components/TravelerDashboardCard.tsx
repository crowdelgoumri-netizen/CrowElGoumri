/**
 * TravelerDashboardCard — board 09 (DashboardScreen) surfaced on Home.
 *
 * Shown only when the signed-in user actually has traveler activity: an
 * active/upcoming trip, with its compatible-request count, an in-progress
 * delivery's checkpoint progress, and this month's released earnings.
 * Silent no-op (renders null) for guests, senders-only, and anyone with
 * nothing to show — Home stays the same dual-intent hub otherwise.
 */
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { useAuth } from "../store/auth";
import { useThemeColors } from "../hooks/useThemeColors";
import * as tripsApi from "../lib/trips";
import { getMatchesForTrip } from "../lib/matching";
import { getEscrow } from "../lib/escrow";
import { cityOf, eur } from "../lib/format";
import type { Trip } from "../lib/trips";

const CHECKPOINT_STEPS: tripsApi.CheckpointType[] = [
  "DEPARTURE",
  "TRANSIT",
  "CUSTOMS",
  "ARRIVAL",
];

interface DashboardData {
  trip: Trip;
  matchCount: number;
  progress: number | null; // 0..1, only for IN_PROGRESS trips
  monthlyEarnings: number;
}

export function TravelerDashboardCard() {
  const user = useAuth((s) => s.user);
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    loadDashboard()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (!user || loading || !data) return null;

  const { trip, matchCount, progress, monthlyEarnings } = data;

  return (
    <Card raised className="mt-section-gap gap-stack-gap">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary font-heading font-bold text-sm">
          {t("home.dashboard.title")}
        </Text>
        <Pressable onPress={() => router.push(`/trip/${trip.id}`)}>
          <Text className="text-accent font-heading text-xs font-bold">
            {t("home.seeAll")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push(`/trip/${trip.id}`)}
        className="flex-row items-center justify-between rounded-field bg-chip-bg border border-chip-border px-3.5 py-2.5 active:opacity-80"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Ionicons name="airplane-outline" size={16} color={colors.accent} />
          <Text className="text-text-primary font-heading font-semibold text-sm flex-1" numberOfLines={1}>
            {cityOf(trip.origin)} → {cityOf(trip.destination)}
          </Text>
        </View>
        <Text className="text-accent-text font-heading font-bold text-xs">
          {t("home.dashboard.requestCount", { count: matchCount })}
        </Text>
      </Pressable>

      {progress != null ? (
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary font-body text-xs">
              {t("home.dashboard.inProgress")}
            </Text>
            <Text className="text-text-muted font-body text-xs">
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View className="h-1.5 rounded-chip bg-chip-bg overflow-hidden">
            <View
              className="h-1.5 rounded-chip bg-accent"
              style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
            />
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-1.5">
        <Ionicons name="wallet-outline" size={14} color={colors.successText} />
        <Text className="text-text-secondary font-body text-xs">
          {t("home.dashboard.earnings", { amount: eur(monthlyEarnings) })}
        </Text>
      </View>
    </Card>
  );
}

async function loadDashboard(): Promise<DashboardData | null> {
  // Prefer a trip already under way, else the nearest upcoming one.
  const [inProgress, upcoming] = await Promise.all([
    tripsApi.listMine({ status: "IN_PROGRESS", limit: 1 }),
    tripsApi.listMine({ limit: 20 }),
  ]);

  const active =
    inProgress.trips[0] ??
    upcoming.trips
      .filter((tr) => tr.status === "PUBLISHED" || tr.status === "MATCHING")
      .sort((a, b) => +new Date(a.departureTime) - +new Date(b.departureTime))[0];

  if (!active) return null;

  const matches = await getMatchesForTrip(active.id).catch(() => null);
  const matchCount = matches?.matches.length ?? matches?.totalCandidates ?? 0;

  let progress: number | null = null;
  if (active.status === "IN_PROGRESS") {
    const cp = await tripsApi.getCheckpoints(active.id).catch(() => null);
    const done = new Set((cp?.checkpoints ?? []).map((c) => c.type));
    const count = CHECKPOINT_STEPS.filter((s) => done.has(s)).length;
    progress = count / CHECKPOINT_STEPS.length;
  }

  const monthlyEarnings = await estimateMonthlyEarnings();

  return { trip: active, matchCount, progress, monthlyEarnings };
}

/** Best-effort: sum released escrow payouts for parcels delivered on this
 * month's completed trips. No aggregate endpoint exists server-side, so this
 * walks a bounded set of recent completed trips/parcels client-side. */
async function estimateMonthlyEarnings(): Promise<number> {
  try {
    const completed = await tripsApi.listMine({ status: "COMPLETED", limit: 10 });
    const now = new Date();
    const thisMonth = completed.trips.filter((tr) => {
      const ref = tr.actualArrival ?? tr.departureTime;
      const d = new Date(ref);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    });

    let total = 0;
    for (const tr of thisMonth.slice(0, 8)) {
      const full = await tripsApi.getTrip(tr.id).catch(() => null);
      const delivered = (full?.trip.parcels ?? []).filter((p) => p.status === "DELIVERED");
      for (const p of delivered.slice(0, 8)) {
        const esc = await getEscrow(p.id).catch(() => null);
        if (esc && (esc.escrow.status === "RELEASED" || esc.escrow.status === "PARTIAL_RELEASE")) {
          total += esc.escrow.travelerPayout;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}
