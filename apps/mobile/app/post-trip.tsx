/**
 * Post a trip (board 14) — the traveler publishes bag space.
 *
 * Mirrors POST /trips. Origin is a European city, destination an Algerian
 * wilaya (from config), departure date/time, transport mode, capacity, and an
 * optional price/kg. On success the traveler lands on the trip detail, ready
 * to find parcels to carry.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
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

const COUNTRIES = ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export default function PostTripScreen() {
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader title={t("postTrip.title")} />

        <View className="gap-stack-gap">
          <Text className="font-mono text-meta text-text-secondary ml-1">{t("route.departure")}</Text>
          <Select label={t("route.originCountry")} value={originCountry} options={COUNTRIES} onSelect={(v) => { setOriginCountry(v); setOriginCity(""); }} />
          <Select label={t("route.originCity")} value={originCity} options={cities} onSelect={setOriginCity} placeholder={t("route.chooseCity")} />

          <Text className="font-mono text-meta text-text-secondary ml-1 mt-sm">{t("route.arrival")}</Text>
          <Select label={t("route.arrivalWilaya")} value={destinationWilaya} options={WILAYAS_1_58} onSelect={setDestinationWilaya} />

          <View className="flex-row gap-stack-gap">
            <View className="flex-1">
              <Input label={t("postTrip.date")} value={date} onChangeText={setDate} placeholder="2026-09-01" />
            </View>
            <View className="flex-1">
              <Input label={t("postTrip.time")} value={time} onChangeText={setTime} placeholder="14:30" />
            </View>
          </View>

          <Select label={t("postTrip.transportMode")} value={mode} options={modes} onSelect={(v) => setMode(v as TransportMode)} />

          <View className="flex-row gap-stack-gap">
            <View className="flex-1">
              <Input label={t("postTrip.capacity")} value={maxWeightKg} onChangeText={setMaxWeightKg} keyboardType="numeric" placeholder="20" />
            </View>
            <View className="flex-1">
              <Input label={t("postTrip.pricePerKg")} value={pricePerKg} onChangeText={setPricePerKg} keyboardType="numeric" placeholder="8" />
            </View>
          </View>

          <Input label={t("postTrip.distance")} value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" placeholder="1500" />
          <Input label={t("postTrip.notes")} value={notes} onChangeText={setNotes} placeholder={t("postTrip.notesPlaceholder")} multiline className="h-20" />

          <View className="mt-section-gap">
            <Button label={t("postTrip.publish")} onPress={submit} loading={submitting} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
