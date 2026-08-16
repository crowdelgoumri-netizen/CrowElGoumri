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
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { createTrip, type CreateTripInput } from "../src/lib/trips";
import { ApiError } from "../src/lib/api";
import { MODE_LABEL } from "../src/lib/format";
import { ORIGIN_COUNTRIES, WILAYAS_1_58 } from "../src/config/corridors";
import type { TransportMode } from "../src/lib/types";

const COUNTRIES = ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const MODES = Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }));

export default function PostTripScreen() {
  const tokens = useAuth((s) => s.tokens);
  const [submitting, setSubmitting] = useState(false);

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
    return <AuthWall headerTitle="Proposer un trajet" />;
  }

  async function submit() {
    if (!originCity || !destinationWilaya) {
      Alert.alert("Champ manquant", "Itinéraire incomplet.");
      return;
    }
    if (!date || !time) {
      Alert.alert("Champ manquant", "Date et heure de départ requises.");
      return;
    }
    if (!parseFloat(maxWeightKg)) {
      Alert.alert("Champ manquant", "Capacité (kg) requise.");
      return;
    }

    const departure = new Date(`${date}T${time}:00`);
    if (isNaN(departure.getTime())) {
      Alert.alert("Date invalide", "Format attendu : AAAA-MM-JJ et HH:MM.");
      return;
    }
    if (departure <= new Date()) {
      Alert.alert("Date invalide", "Le départ doit être dans le futur.");
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
        "Publication impossible",
        e instanceof ApiError ? e.message : "Réessayez plus tard.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader title="Proposer un trajet" />

        <View className="gap-stack-gap">
          <Text className="font-mono text-meta text-text-secondary ml-1">Départ (Europe)</Text>
          <Select label="Pays d'origine" value={originCountry} options={COUNTRIES} onSelect={(v) => { setOriginCountry(v); setOriginCity(""); }} />
          <Select label="Ville de départ" value={originCity} options={cities} onSelect={setOriginCity} placeholder="Choisir une ville" />

          <Text className="font-mono text-meta text-text-secondary ml-1 mt-sm">Arrivée (Algérie)</Text>
          <Select label="Wilaya d'arrivée" value={destinationWilaya} options={WILAYAS_1_58} onSelect={setDestinationWilaya} />

          <View className="flex-row gap-stack-gap">
            <View className="flex-1">
              <Input label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} placeholder="2026-09-01" />
            </View>
            <View className="flex-1">
              <Input label="Heure (HH:MM)" value={time} onChangeText={setTime} placeholder="14:30" />
            </View>
          </View>

          <Select label="Mode de transport" value={mode} options={MODES} onSelect={(v) => setMode(v as TransportMode)} />

          <View className="flex-row gap-stack-gap">
            <View className="flex-1">
              <Input label="Capacité (kg)" value={maxWeightKg} onChangeText={setMaxWeightKg} keyboardType="numeric" placeholder="20" />
            </View>
            <View className="flex-1">
              <Input label="Prix/kg (€)" value={pricePerKg} onChangeText={setPricePerKg} keyboardType="numeric" placeholder="8" />
            </View>
          </View>

          <Input label="Distance estimée (km)" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" placeholder="1500" />
          <Input label="Notes (optionnel)" value={notes} onChangeText={setNotes} placeholder="Climatisé, accepts fragile…" multiline className="h-20" />

          <View className="mt-section-gap">
            <Button label="Publier le trajet" onPress={submit} loading={submitting} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
