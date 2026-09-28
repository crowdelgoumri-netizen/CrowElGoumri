import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";

import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { createCampaign } from "../src/lib/campaigns";
import { ApiError } from "../src/lib/api";
import { ORIGIN_COUNTRIES, WILAYAS_1_58 } from "../src/config/corridors";
import { MODE_KEY } from "../src/lib/format";

const MODE_OPTIONS = (["FLIGHT", "FERRY", "BUS", "CAR", "TRUCK", "TRAIN"] as const).map((m) => ({
  value: m,
  label: m, // resolved via t(MODE_KEY[m]) below
}));

const COUNTRY_OPTIONS = ORIGIN_COUNTRIES.map((c) => ({ value: c.name, label: c.name }));
const WILAYA_OPTIONS = WILAYAS_1_58.map((w) => ({ value: w, label: w }));

export default function PostCampaignScreen() {
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [originCountry, setOriginCountry] = useState<string | null>(null);
  const [originCity, setOriginCity] = useState<string | null>(null);
  const [selectedWilaya, setSelectedWilaya] = useState<string | null>(null);
  const [destWilayas, setDestWilayas] = useState<string[]>([]);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  if (!tokens) return <AuthWall />;

  const cityOptions =
    ORIGIN_COUNTRIES.find((c) => c.name === originCountry)?.cities.map((city) => ({
      value: city,
      label: city,
    })) ?? [];

  const modeOptionsLabeled = MODE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(MODE_KEY[o.value as keyof typeof MODE_KEY] ?? o.value),
  }));

  function addWilaya(w: string) {
    if (!destWilayas.includes(w)) setDestWilayas((prev) => [...prev, w]);
    setSelectedWilaya(null);
  }

  function removeWilaya(w: string) {
    setDestWilayas((prev) => prev.filter((x) => x !== w));
  }

  async function submit() {
    if (title.trim().length < 5) { Alert.alert("", t("campaign.errTitle")); return; }
    if (!originCity) { Alert.alert("", t("campaign.errOriginCity")); return; }
    if (!originCountry) { Alert.alert("", t("campaign.errOriginCountry")); return; }
    if (destWilayas.length === 0) { Alert.alert("", t("campaign.errWilayas")); return; }
    if (!departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert("", t("campaign.errDate")); return; }
    if (!capacity || isNaN(Number(capacity))) { Alert.alert("", t("campaign.errCapacity")); return; }
    if (!price || isNaN(Number(price))) { Alert.alert("", t("campaign.errPrice")); return; }

    setLoading(true);
    try {
      await createCampaign({
        title: title.trim(),
        description: description.trim() || undefined,
        originCity: originCity!,
        originCountry: originCountry!,
        destWilayas,
        departureDate: new Date(departureDate).toISOString(),
        returnDate: returnDate.match(/^\d{4}-\d{2}-\d{2}$/)
          ? new Date(returnDate).toISOString()
          : undefined,
        mode: (mode ?? "FLIGHT") as "FLIGHT" | "FERRY" | "BUS" | "CAR" | "TRUCK" | "TRAIN",
        capacityKg: Number(capacity),
        pricePerKg: Number(price),
      });
      Alert.alert(t("campaign.published"), t("campaign.publishedBody"), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("common.retryLater");
      Alert.alert(t("common.publishError"), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("campaign.postTitle")} onBack={() => router.back()} />

      <Text className="text-text-muted font-body text-sm mt-2 mb-section-gap">
        {t("campaign.postSubtitle")}
      </Text>

      <View className="gap-stack-gap pb-xl">
        <Input
          label={t("campaign.titleLabel")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("campaign.titlePlaceholder")}
          maxLength={120}
        />

        <Input
          label={t("campaign.descLabel")}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ height: 100, textAlignVertical: "top" }}
        />

        <Select
          label={t("campaign.originCountryLabel")}
          value={originCountry}
          options={COUNTRY_OPTIONS}
          onSelect={(v) => { setOriginCountry(v); setOriginCity(null); }}
        />

        {originCountry ? (
          <Select
            label={t("campaign.originCityLabel")}
            value={originCity}
            options={cityOptions}
            onSelect={setOriginCity}
          />
        ) : null}

        {/* Wilaya multi-select */}
        <View className="gap-2">
          <Select
            label={t("campaign.destWilayasLabel")}
            value={selectedWilaya}
            options={WILAYA_OPTIONS.filter((w) => !destWilayas.includes(w.value))}
            onSelect={addWilaya}
            placeholder="Ajouter une wilaya…"
          />
          {destWilayas.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {destWilayas.map((w) => (
                <Pressable
                  key={w}
                  onPress={() => removeWilaya(w)}
                  className="flex-row items-center gap-1 rounded-chip bg-accent/15 px-3 py-1.5"
                >
                  <Text className="text-accent font-body text-xs font-semibold">{w}</Text>
                  <Text className="text-accent font-body text-xs">✕</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View className="flex-row gap-stack-gap">
          <View className="flex-1">
            <Input
              label={t("campaign.departureDateLabel")}
              value={departureDate}
              onChangeText={setDepartureDate}
              placeholder="2026-10-15"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("campaign.returnDateLabel")}
              value={returnDate}
              onChangeText={setReturnDate}
              placeholder="2026-10-25"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        <Select
          label={t("campaign.modeLabel")}
          value={mode}
          options={modeOptionsLabeled}
          onSelect={setMode}
        />

        <View className="flex-row gap-stack-gap">
          <View className="flex-1">
            <Input
              label={t("campaign.capacityLabel")}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="decimal-pad"
              placeholder="50"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("campaign.priceLabel")}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="8"
            />
          </View>
        </View>

        <Button label={t("campaign.publish")} onPress={submit} loading={loading} />
      </View>
    </Screen>
  );
}
