/**
 * Rechercher (board 03, DiasporaCart) — browse-first destination explorer,
 * matching the NewDesign mockup: hero title, floating destination cards over
 * the corridors map, a live "top corridor" summary strip, an "Autres
 * destinations" photo grid, and a "post your trip" promo banner. The search
 * icon in the header reveals the full filter form (départ / destination /
 * quand / poids) for anyone who wants to search directly instead of
 * browsing; submitting it (or tapping a destination card for a route that's
 * actually live) filters the real published-trips feed below.
 *
 * Only Paris↔Alger and the other Tier-1 EUR corridors (see
 * src/config/corridors.ts) are wired to live search. The mockup's Montréal /
 * Londres / New York / Genève cards are shown as in the design (kept static
 * per product direction) but aren't searchable yet — tapping one shows a
 * "bientôt disponible" notice instead of silently doing nothing.
 */
import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { Input } from "../../src/components/Input";
import { Select } from "../../src/components/Select";
import { EmptyState } from "../../src/components/EmptyState";
import { TripCard } from "../../src/components/TripCard";
import { PopularRoutesMapArt } from "../../src/components/Illustrations";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import * as tripsApi from "../../src/lib/trips";
import { cityOf } from "../../src/lib/format";
import { CITY_OPTIONS, WILAYAS_1_58 } from "../../src/config/corridors";
import planeWindow from "../../assets/plane-window.jpg";
import heroAlgiers from "../../assets/hero-algiers.jpg";
import cityMontreal from "../../assets/city-montreal.jpg";
import cityLondon from "../../assets/city-london.jpg";
import cityParis from "../../assets/city-paris.jpg";
import cityNewYork from "../../assets/city-newyork.jpg";
import cityGeneva from "../../assets/city-geneva.jpg";
import destOran from "../../assets/dest-oran.jpg";
import destConstantine from "../../assets/dest-constantine.jpg";

interface Query {
  city: string;
  wilaya: string;
  date: string;
  weight: string;
}

const EMPTY_QUERY: Query = { city: "", wilaya: "", date: "", weight: "" };

/**
 * PhotoTile — a destination's photo, or (while most destinations have no
 * real photo yet) a consistent brand-gradient placeholder with a landmark
 * icon instead of a mismatched flat color. Swapping in a real photo later
 * is just passing `image`.
 */
function PhotoTile({ image, style }: { image?: ImageSourcePropType; style?: object }) {
  if (image) {
    return <ImageBackground source={image} resizeMode="cover" style={[{ flex: 1 }, style]} />;
  }
  return (
    <LinearGradient
      colors={["#0F5D4A", "#5C8B6F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}
    >
      <Ionicons name="location" size={20} color="rgba(255,255,255,0.8)" />
    </LinearGradient>
  );
}

/** Mockup's exact floating destination cards, positioned over the map art
 * (see the `anchor` percentages, matching PopularRoutesMapArt's line
 * endpoints). Only Paris is a real Tier-1 origin (see
 * src/config/corridors.ts) — the rest are shown per product direction but
 * aren't searchable yet. Photos are cropped directly from the mockup
 * (NewDesign/ChatGPT Image 28 sept. 2026, 14_40_45.png). */
const EXPLORE_CITIES: {
  key: string;
  city: string;
  wilaya: string;
  image?: ImageSourcePropType;
  supported: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  anchor: { top: DimensionValue; left?: DimensionValue; right?: DimensionValue };
}[] = [
  { key: "montreal", city: "Montréal", wilaya: "Alger", image: cityMontreal, supported: false, icon: "heart", anchor: { top: "4%", left: "3%" } },
  { key: "london", city: "Londres", wilaya: "Alger", image: cityLondon, supported: false, icon: "heart", anchor: { top: "18%", right: "3%" } },
  { key: "paris", city: "Paris", wilaya: "Alger", image: cityParis, supported: true, icon: "airplane", anchor: { top: "40%", right: "3%" } },
  { key: "newyork", city: "New York", wilaya: "Alger", image: cityNewYork, supported: false, icon: "airplane", anchor: { top: "48%", left: "2%" } },
  { key: "geneva", city: "Genève", wilaya: "Alger", image: cityGeneva, supported: false, icon: "airplane", anchor: { top: "62%", right: "3%" } },
];

/** "Autres destinations" — real Tier-1 countries (France, Espagne, Italie),
 * filtered by destination wilaya only (no single city implied). Stats are
 * live when trips exist for that wilaya, else the mockup's placeholder
 * numbers. All three photos are cropped from the mockup; Espagne→Alger
 * reuses the existing hero-algiers.jpg instead (same Maqam Echahid
 * monument, higher resolution). The mockup's favorite-heart badge is baked
 * into these crops, so the card below doesn't draw its own on top. */
const OTHER_DESTINATIONS: {
  key: string;
  label: string;
  wilaya: string;
  image?: ImageSourcePropType;
  fallbackCount: number;
  fallbackPrice: number;
}[] = [
  { key: "oran", label: "France → Oran", wilaya: "Oran", image: destOran, fallbackCount: 23, fallbackPrice: 30 },
  { key: "alger", label: "Espagne → Alger", wilaya: "Alger", image: heroAlgiers, fallbackCount: 18, fallbackPrice: 35 },
  { key: "constantine", label: "Italie → Constantine", wilaya: "Constantine", image: destConstantine, fallbackCount: 12, fallbackPrice: 40 },
];

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
  const [formOpen, setFormOpen] = useState(!!corridor);

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

  // Live stats per destination wilaya (for the "Autres destinations" grid
  // and the top summary strip) — falls back to mockup placeholders when a
  // route has no live trips yet.
  const byWilaya = useMemo(() => {
    const map = new Map<string, { count: number; minPrice?: number }>();
    for (const tr of all) {
      const wilaya = tr.destination.wilaya ?? cityOf(tr.destination);
      const cur = map.get(wilaya) ?? { count: 0, minPrice: undefined };
      cur.count += 1;
      if (tr.pricePerKg != null) {
        cur.minPrice = cur.minPrice == null ? tr.pricePerKg : Math.min(cur.minPrice, tr.pricePerKg);
      }
      map.set(wilaya, cur);
    }
    return map;
  }, [all]);

  const parisAlger = corridors.find((c) => c.city === "Paris" && c.wilaya === "Alger");

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

  function resetSearch() {
    setDraft(EMPTY_QUERY);
    setQuery(EMPTY_QUERY);
    setFormOpen(false);
  }

  function applyCorridor(c: { city: string; wilaya: string }) {
    const q = { ...EMPTY_QUERY, city: c.city, wilaya: c.wilaya };
    setDraft(q);
    setQuery(q);
  }

  function applyDestination(wilaya: string) {
    const q = { ...EMPTY_QUERY, wilaya };
    setDraft(q);
    setQuery(q);
  }

  function tapExploreCity(c: (typeof EXPLORE_CITIES)[number]) {
    if (!c.supported) {
      Alert.alert(t("searchExplore.comingSoonTitle"), t("searchExplore.comingSoonBody"));
      return;
    }
    applyCorridor(c);
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-edge pb-xl"
      >
        {/* Logo lockup — matches HomeHero's, so the brand header is
            consistent across the tabs the mockup shows it on. */}
        <View className="mt-md flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Ionicons name="heart" size={16} color={colors.accentOn} />
            </View>
            <Text className="font-heading text-lg font-extrabold">
              <Text className="text-text-primary">Diaspora</Text>
              <Text className="text-accent">Cart</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => setFormOpen((v) => !v)}
            className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
          >
            <Ionicons
              name={formOpen ? "close" : "search"}
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        {/* Title + subtitle */}
        <View className="mt-section-gap">
          <Text className="text-text-primary font-heading text-screen-title font-bold">
            {queryActive || formOpen ? t("search.title") : t("searchExplore.heroTitle")}
          </Text>
          <Text className="text-text-secondary font-body text-sm mt-1">
            {queryActive || formOpen ? t("search.subtitle") : t("searchExplore.heroSubtitle")}
          </Text>
        </View>

        {/* Search form (collapsed by default; opened via the header icon,
            or pre-opened when we arrived with a corridor param) */}
        {formOpen ? (
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
        ) : null}

        {/* Browse mode: destination cards + map + popular routes + promo */}
        {!queryActive && !formOpen ? (
          <>
            {/* Corridors map — floating destination cards scattered over a
                tall map backdrop, matching the mockup's collage layout
                (cards anchored via EXPLORE_CITIES.anchor, not a stacked list). */}
            <View
              className="mt-section-gap rounded-card overflow-hidden"
              style={{ height: 340 }}
            >
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <PopularRoutesMapArt />
              </View>
              {EXPLORE_CITIES.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => tapExploreCity(c)}
                  className="flex-row items-center gap-2 rounded-card bg-glass-strong border border-hairline p-1.5 active:opacity-80"
                  style={[{ position: "absolute", maxWidth: 170 }, c.anchor]}
                >
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-text-primary">
                    <Ionicons name={c.icon} size={13} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary font-heading font-bold text-xs" numberOfLines={1}>
                      {c.city}
                    </Text>
                    <Text className="text-text-muted font-body text-[10px]">→ {c.wilaya}</Text>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 8, overflow: "hidden" }}>
                    <PhotoTile image={c.image} />
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Top corridor summary strip (live when Paris→Alger has trips) */}
            <Pressable
              onPress={() => applyCorridor({ city: "Paris", wilaya: "Alger" })}
              className="mt-stack-gap flex-row items-center rounded-card bg-glass border border-hairline p-card-padding gap-3 active:opacity-80"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/12">
                <Ionicons name="location" size={18} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-text-primary font-heading font-bold text-base">
                  Paris → Alger
                </Text>
                <Text className="text-text-secondary font-body text-xs mt-0.5">
                  {t("searchExplore.summaryTravelers", { n: parisAlger?.count ?? 47 })} ·{" "}
                  {t("searchExplore.summaryKgAvailable", { kg: Math.round(parisAlger?.kg ?? 132) })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* Autres destinations — real Tier-1 countries, live stats when available */}
            <View className="mt-section-gap">
              <View className="flex-row items-center justify-between">
                <Text className="text-text-primary font-heading font-bold text-base">
                  {t("searchExplore.otherDestinations")}
                </Text>
                <Pressable onPress={() => setFormOpen(true)}>
                  <Text className="text-accent font-heading text-xs font-bold">
                    {t("searchExplore.seeAll")}
                  </Text>
                </Pressable>
              </View>
              <View className="flex-row gap-3 mt-2.5">
                {OTHER_DESTINATIONS.map((d) => {
                  const live = byWilaya.get(d.wilaya);
                  const count = live?.count || d.fallbackCount;
                  const price = live?.minPrice ?? d.fallbackPrice;
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => applyDestination(d.wilaya)}
                      className="flex-1 rounded-card overflow-hidden bg-glass border border-hairline"
                    >
                      <View style={{ height: 88 }}>
                        <PhotoTile image={d.image} />
                        {d.key !== "oran" && d.key !== "constantine" ? (
                          <View className="absolute top-1.5 right-1.5 h-6 w-6 items-center justify-center rounded-full bg-white">
                            <Ionicons name="heart-outline" size={13} color={colors.textPrimary} />
                          </View>
                        ) : null}
                      </View>
                      <View className="p-2">
                        <Text className="text-text-primary font-heading font-bold text-xs" numberOfLines={1}>
                          {d.label}
                        </Text>
                        <View className="flex-row items-center gap-1 mt-1">
                          <Ionicons name="people-outline" size={11} color={colors.textMuted} />
                          <Text className="text-text-muted font-body text-[10px]">
                            {t("searchExplore.summaryTravelers", { n: count })}
                          </Text>
                        </View>
                        <View className="mt-1.5 self-start rounded-chip bg-success-bg px-1.5 py-0.5">
                          <Text className="text-success-text font-heading text-[9px] font-bold">
                            {t("searchExplore.fromPrice", { price })}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Promo banner — post your own trip */}
            <Pressable
              onPress={() => router.push("/post-trip")}
              className="mt-section-gap rounded-card overflow-hidden"
              style={{ height: 128 }}
            >
              <ImageBackground source={planeWindow} resizeMode="cover" style={{ flex: 1 }}>
                <LinearGradient
                  colors={["rgba(15,93,74,0.15)", "rgba(15,93,74,0.55)"]}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", padding: 16 }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-heading font-bold text-sm">
                      {t("searchExplore.promoTitle")}
                    </Text>
                    <Text className="text-white/80 font-body text-xs mt-1" numberOfLines={2}>
                      {t("searchExplore.promoBody")}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 rounded-field bg-text-primary px-3 py-2.5">
                    <Text className="text-white font-heading font-bold text-xs">
                      {t("searchExplore.promoCta")}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                </LinearGradient>
              </ImageBackground>
            </Pressable>
          </>
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
              <Pressable onPress={resetSearch}>
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
