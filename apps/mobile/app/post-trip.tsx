/**
 * Ajouter mon voyage (board 04, DiasporaCart) — the traveler publishes bag
 * space. Mirrors POST /trips: itinerary (Europe → Algerian wilaya),
 * departure date/time, transport mode, capacity, optional price/kg and
 * notes. Grouped into cards (itinerary / details / comfort guarantees) with
 * a single full-width CTA. On success the traveler lands on the trip detail,
 * ready to find parcels to carry.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { createTrip, type CreateTripInput } from "../src/lib/trips";
import { ApiError } from "../src/lib/api";
import { MODE_KEY } from "../src/lib/format";
import { ORIGIN_COUNTRIES, WILAYAS_1_58 } from "../src/config/corridors";
import type { TransportMode } from "../src/lib/types";
import { useThemeColors } from "../src/hooks/useThemeColors";

const COUNTRIES = ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

const CAPACITY_PRESETS = [5, 10, 15, 20, 30];

const COMFORT = [
  { icon: "call-outline", key: "postTrip.comfortContact" },
  { icon: "shield-checkmark-outline", key: "postTrip.comfortInsurance" },
  { icon: "time-outline", key: "postTrip.comfortMatching" },
] as const;

export default function PostTripScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const [submitting, setSubmitting] = useState(false);
  const modes = Object.entries(MODE_KEY).map(([value, key]) => ({ value, label: t(key) }));

  const [originCountry, setOriginCountry] = useState("FR");
  const [originCity, setOriginCity] = useState("Paris");
  const [destinationWilaya, setDestinationWilaya] = useState("Alger");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState<TransportMode>("FLIGHT");
  const [tripType, setTripType] = useState<"oneway" | "roundtrip">("oneway");
  const [returnDate, setReturnDate] = useState("");
  const [maxWeightKg, setMaxWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [notes, setNotes] = useState("");

  const cities = ORIGIN_COUNTRIES.find((c) => c.code === originCountry)?.cities ?? [];

  // Publishing requires an account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("postTrip.title")} />;
  }

  async function submit() {
    if (!originCity || !destinationWilaya) {
      Alert.alert(t("common.missingTitle"), t("postTrip.errItinerary"));
      return;
    }
    if (!date || !time) {
      Alert.alert(t("common.missingTitle"), t("postTrip.errDateTime"));
      return;
    }
    if (!parseFloat(maxWeightKg)) {
      Alert.alert(t("common.missingTitle"), t("postTrip.errCapacity"));
      return;
    }

    const departure = new Date(`${date}T${time}:00`);
    if (isNaN(departure.getTime())) {
      Alert.alert(t("postTrip.invalidDateTitle"), t("postTrip.errDateFormat"));
      return;
    }
    if (departure <= new Date()) {
      Alert.alert(t("postTrip.invalidDateTitle"), t("postTrip.errDateFuture"));
      return;
    }

    let returnDeparture: Date | null = null;
    if (tripType === "roundtrip") {
      if (!returnDate) {
        Alert.alert(t("common.missingTitle"), t("postTrip.errReturnDate"));
        return;
      }
      returnDeparture = new Date(`${returnDate}T${time}:00`);
      if (isNaN(returnDeparture.getTime())) {
        Alert.alert(t("postTrip.invalidDateTitle"), t("postTrip.errDateFormat"));
        return;
      }
      if (returnDeparture <= departure) {
        Alert.alert(t("postTrip.invalidDateTitle"), t("postTrip.errReturnDateOrder"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const input: CreateTripInput = {
        origin: {
          level: "OFFICIAL_GEOCODE",
          label: `${originCity}, ${ORIGIN_COUNTRIES.find((c) => c.code === originCountry)?.name}`,
          city: originCity,
          country: originCountry,
        },
        destination: {
          level: "OFFICIAL_GEOCODE",
          label: `${destinationWilaya}, Algérie`,
          wilaya: destinationWilaya,
          country: "DZ",
        },
        totalDistanceKm: parseFloat(distanceKm) || 1500,
        departureTime: departure.toISOString(),
        mode,
        maxWeightKg: parseFloat(maxWeightKg),
        pricePerKg: pricePerKg ? parseFloat(pricePerKg) : undefined,
        priceCurrency: "EUR",
        notes: notes.trim() || undefined,
      };
      const { trip } = await createTrip(input);

      if (returnDeparture) {
        const returnInput: CreateTripInput = {
          origin: {
            level: "OFFICIAL_GEOCODE",
            label: `${destinationWilaya}, Algérie`,
            wilaya: destinationWilaya,
            country: "DZ",
          },
          destination: {
            level: "OFFICIAL_GEOCODE",
            label: `${originCity}, ${ORIGIN_COUNTRIES.find((c) => c.code === originCountry)?.name}`,
            city: originCity,
            country: originCountry,
          },
          totalDistanceKm: input.totalDistanceKm,
          departureTime: returnDeparture.toISOString(),
          mode,
          maxWeightKg: parseFloat(maxWeightKg),
          pricePerKg: pricePerKg ? parseFloat(pricePerKg) : undefined,
          priceCurrency: "EUR",
          notes: notes.trim() || undefined,
        };
        try {
          await createTrip(returnInput);
        } catch (e) {
          // Outbound leg already published — surface the return-leg failure
          // separately rather than losing the whole submission.
          Alert.alert(
            t("postTrip.returnLegErrorTitle"),
            e instanceof ApiError ? e.message : t("common.retryLater"),
          );
        }
      }

      router.replace(`/trip/${trip.id}`);
    } catch (e) {
      Alert.alert(
        t("common.publishError"),
        e instanceof ApiError ? e.message : t("common.retryLater"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-screen-edge pb-xl"
        >
          <ScreenHeader title={t("postTrip.title")} />

          {/* Itinerary */}
          <View className="rounded-card bg-glass border border-hairline p-card-padding gap-stack-gap">
            <View className="flex-row items-center gap-2">
              <Ionicons name="navigate-outline" size={17} color={colors.accent} />
              <Text className="text-text-primary font-heading font-bold text-base">
                {t("route.departure")}
              </Text>
            </View>
            <Select
              label={t("route.originCountry")}
              value={originCountry}
              options={COUNTRIES}
              onSelect={(v) => {
                setOriginCountry(v);
                setOriginCity("");
              }}
            />
            <Select
              label={t("route.originCity")}
              value={originCity}
              options={cities}
              onSelect={setOriginCity}
              placeholder={t("route.chooseCity")}
            />
            <View className="flex-row items-center gap-2 mt-sm">
              <Ionicons name="location-outline" size={17} color={colors.accent} />
              <Text className="text-text-primary font-heading font-bold text-base">
                {t("route.arrival")}
              </Text>
            </View>
            <Select
              label={t("route.arrivalWilaya")}
              value={destinationWilaya}
              options={WILAYAS_1_58}
              onSelect={setDestinationWilaya}
            />
          </View>

          {/* Trip details */}
          <View className="mt-stack-gap rounded-card bg-glass border border-hairline p-card-padding gap-stack-gap">
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={17} color={colors.accent} />
              <Text className="text-text-primary font-heading font-bold text-base">
                {t("postTrip.detailsTitle")}
              </Text>
            </View>
            <View className="flex-row bg-glass-strong rounded-chip p-1">
              <Pressable
                onPress={() => setTripType("oneway")}
                className={`flex-1 items-center py-2 rounded-chip ${tripType === "oneway" ? "bg-accent" : ""}`}
                testID="trip-type-oneway"
              >
                <Text
                  className={`font-heading font-semibold text-xs ${
                    tripType === "oneway" ? "text-accent-on" : "text-text-secondary"
                  }`}
                >
                  {t("postTrip.oneWay")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTripType("roundtrip")}
                className={`flex-1 items-center py-2 rounded-chip ${tripType === "roundtrip" ? "bg-accent" : ""}`}
                testID="trip-type-roundtrip"
              >
                <Text
                  className={`font-heading font-semibold text-xs ${
                    tripType === "roundtrip" ? "text-accent-on" : "text-text-secondary"
                  }`}
                >
                  {t("postTrip.roundTrip")}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row gap-stack-gap">
              <View className="flex-1">
                <Input
                  label={t("postTrip.date")}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-09-01"
                  testID="trip-date"
                />
              </View>
              <View className="flex-1">
                <Input
                  label={t("postTrip.time")}
                  value={time}
                  onChangeText={setTime}
                  placeholder="14:30"
                  testID="trip-time"
                />
              </View>
            </View>
            {tripType === "roundtrip" ? (
              <Input
                label={t("postTrip.returnDate")}
                value={returnDate}
                onChangeText={setReturnDate}
                placeholder="2026-09-10"
                testID="trip-return-date"
              />
            ) : null}
            <Select
              label={t("postTrip.transportMode")}
              value={mode}
              options={modes}
              onSelect={(v) => setMode(v as TransportMode)}
            />
            <View className="flex-row gap-stack-gap">
              <View className="flex-1">
                <Input
                  label={t("postTrip.capacity")}
                  value={maxWeightKg}
                  onChangeText={setMaxWeightKg}
                  keyboardType="numeric"
                  placeholder="20"
                  testID="trip-capacity"
                />
                <View className="flex-row flex-wrap gap-1.5 mt-1.5">
                  {CAPACITY_PRESETS.map((kg) => (
                    <Pressable
                      key={kg}
                      onPress={() => setMaxWeightKg(String(kg))}
                      className={`rounded-chip border px-2.5 py-1 ${
                        maxWeightKg === String(kg)
                          ? "bg-accent/12 border-accent"
                          : "border-hairline"
                      }`}
                      testID={`trip-capacity-preset-${kg}`}
                    >
                      <Text
                        className={`font-body text-[11px] ${
                          maxWeightKg === String(kg) ? "text-accent-text font-semibold" : "text-text-muted"
                        }`}
                      >
                        {kg} kg
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View className="flex-1">
                <Input
                  label={t("postTrip.pricePerKg")}
                  value={pricePerKg}
                  onChangeText={setPricePerKg}
                  keyboardType="numeric"
                  placeholder="8"
                  testID="trip-price"
                />
              </View>
            </View>
            <Input
              label={t("postTrip.distance")}
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="numeric"
              placeholder="1500"
              testID="trip-distance"
            />
            <Input
              label={t("postTrip.notes")}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("postTrip.notesPlaceholder")}
              multiline
              className="h-20"
              testID="trip-notes"
            />
          </View>

          {/* Comfort guarantees */}
          <View className="mt-stack-gap rounded-card bg-glass border border-hairline p-card-padding">
            <Text className="text-text-primary font-heading font-bold text-base mb-1">
              {t("postTrip.comfortTitle")}
            </Text>
            {COMFORT.map((c) => (
              <View key={c.key} className="flex-row items-center gap-3 py-sm">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-info/15">
                  <Ionicons name={c.icon} size={16} color={colors.infoIcon} />
                </View>
                <Text className="text-text-secondary font-body text-sm flex-1">
                  {t(c.key)}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color={colors.successText} />
              </View>
            ))}
          </View>

          <View className="mt-section-gap">
            <Button
              label={t("postTrip.publish")}
              onPress={submit}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
