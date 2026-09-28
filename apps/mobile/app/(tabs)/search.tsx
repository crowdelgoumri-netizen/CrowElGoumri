/**
 * Rechercher (board 03, DiasporaCart) — find a traveler.
 *
 * Top: the conversational search form (départ / destination / quand / poids).
 * Below: the corridors panel (map art) and "Nos trajets populaires" cards —
 * live stats computed from the published-trips feed (voyageurs + kg
 * disponibles per corridor). Searching filters the real feed; tapping a
 * result opens the traveler's trip detail.
 */
import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { Input } from "../../src/components/Input";
import { Select } from "../../src/components/Select";
import { EmptyState } from "../../src/components/EmptyState";
import { TripCard } from "../../src/components/TripCard";
import { CorridorMapArt } from "../../src/components/Illustrations";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import * as tripsApi from "../../src/lib/trips";
import { cityOf } from "../../src/lib/format";
import { CITY_OPTIONS, WILAYAS_1_58 } from "../../src/config/corridors";

interface Query {
  city: string;
  wilaya: string;
  date: string;
  weight: string;
}

const EMPTY_QUERY: Query = { city: "", wilaya: "", date: "", weight: "" };

export default function SearchScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Home corridor chips pre-fill the query ("Paris → Alger").
  const { corridor } = useLocalSearchParams<{ corridor?: string }>();

  const initial = useMemo<Query>(() => {
    if (!corridor) return EMPTY_QUERY;
    const [city, wilaya] = String(corridor).split("→").map((s) => s.trim());
    return { ...EMPTY_QUERY, city: city || "", wilaya: wilaya || "" };
  }, [corridor]);

  const [draft, setDraft] = useState<Query>(initial);
  const [query, setQuery] = useState<Query>(initial);

  const trips = useAsync(() => tripsApi.listPublished({}), []);
  const all = trips.data?.trips ?? [];

  // Live corridor stats: trip count + remaining capacity per route.
  const corridors = useMemo(() => {
    const byRoute = new Map<string, { city: string; wilaya: string; count: number; kg: number }>();
    for (const tr of all) {
      const city = cityOf(tr.origin);
      const wilaya = tr.destination.wilaya ?? cityOf(tr.destination);
      const key = `${city}→${wilaya}`;
      const remaining = Math.max(0, tr.maxWeightKg - (tr.currentWeightKg ?? 0));
      const cur = byRoute.get(key) ?? { city, wilaya, count: 0, kg: 0 };
      cur.count += 1;
      cur.kg += remaining;
      byRoute.set(key, cur);
    }
    return [...byRoute.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [all]);

  const results = useMemo(() => {
    return all.filter((tr) => {
      if (query.city && cityOf(tr.origin) !== query.city) return false;
      const wilaya = tr.destination.wilaya ?? cityOf(tr.destination);
      if (query.wilaya && wilaya !== query.wilaya) return false;
      if (query.date) {
        const day = new Date(query.date);
        if (!isNaN(day.getTime()) && new Date(tr.departureTime) < day) return false;
      }
      if (query.weight) {
        const w = parseFloat(query.weight);
        const remaining = tr.maxWeightKg - (tr.currentWeightKg ?? 0);
        if (!isNaN(w) && remaining < w) return false;
      }
      return true;
    });
  }, [all, query]);

  const queryActive =
    !!(query.city || query.wilaya || query.date || query.weight);

  function search() {
    setQuery(draft);
  }

  function applyCorridor(c: { city: string; wilaya: string }) {
    const q = { ...EMPTY_QUERY, city: c.city, wilaya: c.wilaya };
    setDraft(q);
    setQuery(q);
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-edge pb-xl"
      >
        <View className="mt-md">
          <Text className="text-text-primary font-heading text-screen-title font-bold">
            {t("search.title")}
          </Text>
          <Text className="text-text-secondary font-body text-sm mt-1">
            {t("search.subtitle")}
          </Text>
        </View>

        {/* Search form */}
        <View className="mt-section-gap rounded-card bg-glass border border-hairline p-card-padding gap-stack-gap">
          <Select
            label={t("search.from")}
            value={draft.city || null}
            options={CITY_OPTIONS}
            onSelect={(v) => setDraft((d) => ({ ...d, city: v }))}
            placeholder={t("search.anyCity")}
          />
          <Select
            label={t("search.to")}
            value={draft.wilaya || null}
            options={WILAYAS_1_58}
            onSelect={(v) => setDraft((d) => ({ ...d, wilaya: v }))}
            placeholder={t("search.anyWilaya")}
          />
          <View className="flex-row gap-stack-gap">
            <View className="flex-1">
              <Input
                label={t("search.when")}
                value={draft.date}
                onChangeText={(v) => setDraft((d) => ({ ...d, date: v }))}
                placeholder={t("search.datePlaceholder")}
              />
            </View>
            <View className="flex-1">
              <Input
                label={t("search.weight")}
                value={draft.weight}
                onChangeText={(v) => setDraft((d) => ({ ...d, weight: v }))}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>
          </View>
          <Pressable
            onPress={search}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-field bg-accent py-4 active:opacity-80"
          >
            <Ionicons name="search" size={18} color={colors.accentOn} />
            <Text className="text-accent-on font-heading font-extrabold text-base">
              {t("search.cta")}
            </Text>
          </Pressable>
        </View>

        {/* Corridors map panel */}
        {!queryActive ? (
          <View className="mt-section-gap rounded-card bg-chip-bg border border-chip-border overflow-hidden">
            <View className="pt-card-padding px-card-padding">
              <Text className="text-text-primary font-heading font-bold text-base">
                {t("search.corridorsTitle")}
              </Text>
              <Text className="text-text-secondary font-body text-xs mt-0.5">
                {t("search.corridorsSubtitle")}
              </Text>
            </View>
            <CorridorMapArt />
            <View className="pb-card-padding px-card-padding flex-row items-center gap-1.5">
              <Ionicons name="location" size={13} color={colors.accent} />
              <Text className="text-accent font-heading text-xs font-bold">
                {t("search.allToAlgiers")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Popular routes (live stats) */}
        {!queryActive && corridors.length > 0 ? (
          <View className="mt-section-gap">
            <Text className="text-text-primary font-heading font-bold text-base">
              {t("search.popularTitle")}
            </Text>
            <View className="mt-2.5 gap-3">
              {corridors.map((c, i) => (
                <Pressable
                  key={`${c.city}-${c.wilaya}`}
                  onPress={() => applyCorridor(c)}
                  className={
                    "flex-row items-center rounded-card p-card-padding gap-3 active:opacity-80 " +
                    (i === 0
                      ? "bg-accent"
                      : "bg-glass border border-hairline")
                  }
                >
                  <View
                    className={
                      "h-10 w-10 items-center justify-center rounded-full " +
                      (i === 0 ? "bg-sand" : "bg-accent/12")
                    }
                  >
                    <Ionicons
                      name="airplane"
                      size={18}
                      color={i === 0 ? colors.accent : colors.accent}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={
                        "font-heading font-bold text-base " +
                        (i === 0 ? "text-accent-on" : "text-text-primary")
                      }
                    >
                      {c.city} → {c.wilaya}
                    </Text>
                    <Text
                      className={
                        "font-body text-xs mt-0.5 " +
                        (i === 0 ? "text-accent-on/75" : "text-text-secondary")
                      }
                    >
                      {t("search.corridorStats", {
                        travelers: c.count,
                        kg: Math.round(c.kg),
                      })}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={i === 0 ? colors.accentOn : colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Results */}
        {queryActive ? (
          <View className="mt-section-gap">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-primary font-heading font-bold text-base">
                {trips.loading
                  ? t("common.loading")
                  : t("search.resultsCount", { n: results.length })}
              </Text>
              <Pressable onPress={() => { setDraft(EMPTY_QUERY); setQuery(EMPTY_QUERY); }}>
                <Text className="text-accent font-heading text-xs font-bold">
                  {t("search.reset")}
                </Text>
              </Pressable>
            </View>
            <View className="mt-2.5 gap-3">
              {trips.loading && all.length === 0 ? (
                <View className="py-xl items-center">
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : trips.error ? (
                <EmptyState
                  icon="cloud-offline-outline"
                  title={t("common.errorTitle")}
                  subtitle={trips.error}
                  ctaLabel={t("common.retry")}
                  onCta={trips.refresh}
                />
              ) : results.length === 0 ? (
                <EmptyState
                  icon="search-outline"
                  title={t("search.noResultsTitle")}
                  subtitle={t("search.noResultsSubtitle")}
                />
              ) : (
                results.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onPress={(tr) => router.push(`/trip/${tr.id}`)}
                  />
                ))
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
