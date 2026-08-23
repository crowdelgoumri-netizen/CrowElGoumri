/**
 * Post a shipment (board 03) — multi-step parcel creation.
 *
 *  1. Colis   — description, category, weight, value, dimensions
 *  2. Itinéraire — origin (EUR country/city), destination wilaya, recipient
 *  3. Prix    — urgency, offered price, review → POST /parcels
 *
 * Corridors come entirely from config/corridors.ts — no country/currency
 * literals here. On success the sender lands on the parcel detail, ready to
 * find matches.
 */
import { useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Stepper } from "../src/components/Stepper";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { createParcel, type CreateParcelInput } from "../src/lib/parcels";
import { ApiError } from "../src/lib/api";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { pickAndUploadImage } from "../src/lib/uploads";
import {
  CATEGORY_KEY,
  URGENCY_KEY,
  eur,
} from "../src/lib/format";
import {
  ORIGIN_COUNTRIES,
  WILAYAS_1_58,
} from "../src/config/corridors";
import type {
  ParcelCategory,
  UrgencyLevel,
} from "../src/lib/types";

const COUNTRIES = ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export default function PostParcelScreen() {
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const steps = [t("postParcel.stepParcel"), t("postParcel.stepItinerary"), t("postParcel.stepPrice")];
  const categories = Object.entries(CATEGORY_KEY).map(([value, key]) => ({ value, label: t(key) }));
  const urgencies = Object.entries(URGENCY_KEY).map(([value, key]) => ({ value, label: t(key) }));

  // Step 1 — parcel details
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ParcelCategory>("Electronics");
  const [weightKg, setWeightKg] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [photos, setPhotos] = useState<{ localUri: string; objectUrl: string }[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // Step 2 — itinerary
  const [originCountry, setOriginCountry] = useState("FR");
  const [originCity, setOriginCity] = useState("Paris");
  const [destinationWilaya, setDestinationWilaya] = useState("Alger");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Step 3 — price & urgency
  const [urgency, setUrgency] = useState<UrgencyLevel>("MEDIUM");
  const [offeredPrice, setOfferedPrice] = useState("");

  const cities = useMemo(
    () =>
      ORIGIN_COUNTRIES.find((c) => c.code === originCountry)?.cities ?? [],
    [originCountry],
  );

  // Posting requires an account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("postParcel.title")} />;
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (description.trim().length < 10) return t("postParcel.errDescription");
      if (!parseFloat(weightKg)) return t("postParcel.errWeight");
      if (!parseFloat(estimatedValue)) return t("postParcel.errValue");
      if (!parseFloat(lengthCm) || !parseFloat(widthCm) || !parseFloat(heightCm))
        return t("postParcel.errDimensions");
    }
    if (step === 1) {
      if (!originCity) return t("postParcel.errOriginCity");
      if (!destinationWilaya) return t("postParcel.errWilaya");
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      Alert.alert(t("common.missingTitle"), err);
      return;
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  // Append-only photo grid: pick one image at a time until 5. Each upload
  // goes through /uploads/presign (see lib/uploads); only objectUrl is sent
  // to /parcels, the localUri is kept purely for the thumbnail preview.
  async function pickPhoto() {
    if (pickingPhoto || photos.length >= 5) return;
    setPickingPhoto(true);
    try {
      const picked = await pickAndUploadImage("parcel-photo");
      if (!picked) return; // canceled
      setPhotos((prev) => [...prev, picked]);
    } catch (e) {
      Alert.alert(
        t("common.uploadError"),
        e instanceof ApiError ? e.message : t("common.retryLater"),
      );
    } finally {
      setPickingPhoto(false);
    }
  }

  async function submit() {
    const err = validateStep();
    if (err) {
      Alert.alert(t("common.missingTitle"), err);
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateParcelInput = {
        description: description.trim(),
        category,
        weightKg: parseFloat(weightKg),
        dimensionsCm: {
          length: parseFloat(lengthCm),
          width: parseFloat(widthCm),
          height: parseFloat(heightCm),
        },
        estimatedValue: parseFloat(estimatedValue),
        valueCurrency: "EUR",
        photoUrls: photos.length ? photos.map((p) => p.objectUrl) : undefined,
        invoiceUrl: invoiceUrl ?? undefined,
        pickupAddress: {
          level: "OFFICIAL_GEOCODE",
          label: `${originCity}, ${ORIGIN_COUNTRIES.find((c) => c.code === originCountry)?.name}`,
          city: originCity,
          country: originCountry,
        },
        deliveryAddress: {
          level: "OFFICIAL_GEOCODE",
          label: `${destinationWilaya}, Algérie`,
          wilaya: destinationWilaya,
          country: "DZ",
        },
        urgencyLevel: urgency,
        offeredPrice: offeredPrice ? parseFloat(offeredPrice) : undefined,
        priceCurrency: "EUR",
        recipientName: recipientName.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
      };
      const { parcel } = await createParcel(input);
      router.replace(`/parcel/${parcel.id}`);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader title={t("postParcel.title")} />
        <Stepper steps={steps} current={step} />

        {step === 0 ? (
          <View className="gap-stack-gap">
            <Input
              label={t("postParcel.description")}
              value={description}
              onChangeText={setDescription}
              placeholder={t("postParcel.descriptionPlaceholder")}
              multiline
              className="h-24"
              testID="parcel-description"
            />
            <Select
              label={t("postParcel.category")}
              value={category}
              options={categories}
              onSelect={(v) => setCategory(v as ParcelCategory)}
            />
            <Input
              label={t("postParcel.weight")}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="2.5"
              testID="parcel-weight"
            />
            <Input
              label={t("postParcel.value")}
              value={estimatedValue}
              onChangeText={setEstimatedValue}
              keyboardType="numeric"
              placeholder="350"
              testID="parcel-value"
            />
            <View className="flex-row gap-stack-gap">
              <View className="flex-1">
                <Input label={t("postParcel.length")} value={lengthCm} onChangeText={setLengthCm} keyboardType="numeric" testID="parcel-length" />
              </View>
              <View className="flex-1">
                <Input label={t("postParcel.width")} value={widthCm} onChangeText={setWidthCm} keyboardType="numeric" testID="parcel-width" />
              </View>
              <View className="flex-1">
                <Input label={t("postParcel.height")} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" testID="parcel-height" />
              </View>
            </View>

            <View className="gap-1 mt-sm">
              <Text className="font-mono text-meta uppercase text-text-secondary">{t("postParcel.photos")}</Text>
              <View className="flex-row flex-wrap gap-stack-gap">
                {photos.map((p, i) => (
                  <View key={p.objectUrl}>
                    <Image source={{ uri: p.localUri }} className="h-20 w-20 rounded-xl bg-glass" resizeMode="cover" />
                    <Pressable
                      onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      hitSlop={8}
                      className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-danger"
                    >
                      <Text className="text-text-primary font-body text-xs font-semibold">×</Text>
                    </Pressable>
                  </View>
                ))}
                {photos.length < 5 ? (
                  <Pressable
                    onPress={pickPhoto}
                    disabled={pickingPhoto}
                    className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-hairline bg-glass"
                  >
                    {pickingPhoto ? <ActivityIndicator /> : <Text className="text-text-muted text-2xl">+</Text>}
                  </Pressable>
                ) : null}
              </View>
            </View>

            <PhotoPicker
              label={t("postParcel.invoice")}
              purpose="invoice"
              onUploaded={setInvoiceUrl}
              onClear={() => setInvoiceUrl(null)}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View className="gap-stack-gap">
            <Text className="font-mono text-meta text-text-secondary ml-1">{t("route.departure")}</Text>
            <Select label={t("route.originCountry")} value={originCountry} options={COUNTRIES} onSelect={(v) => { setOriginCountry(v); setOriginCity(""); }} />
            <Select
              label={t("route.originCity")}
              value={originCity}
              options={cities}
              onSelect={setOriginCity}
              placeholder={t("route.chooseCity")}
            />
            <Text className="font-mono text-meta text-text-secondary ml-1 mt-sm">{t("route.arrival")}</Text>
            <Select
              label={t("route.destWilaya")}
              value={destinationWilaya}
              options={WILAYAS_1_58}
              onSelect={setDestinationWilaya}
            />
            <Input
              label={t("postParcel.recipientName")}
              value={recipientName}
              onChangeText={setRecipientName}
              testID="parcel-recipient-name"
            />
            <Input
              label={t("postParcel.recipientPhone")}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
              testID="parcel-recipient-phone"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View className="gap-stack-gap">
            <Select
              label={t("postParcel.urgency")}
              value={urgency}
              options={urgencies}
              onSelect={(v) => setUrgency(v as UrgencyLevel)}
            />
            <Input
              label={t("postParcel.offeredPrice")}
              value={offeredPrice}
              onChangeText={setOfferedPrice}
              keyboardType="numeric"
              placeholder="30"
              testID="parcel-price"
            />
            <Card raised className="gap-2 mt-sm">
              <Text className="font-mono text-meta uppercase text-text-secondary">{t("postParcel.summary")}</Text>
              <Row k={t("postParcel.stepParcel")} v={`${weightKg || "—"} kg · ${t(CATEGORY_KEY[category])}`} />
              <Row
                k={t("postParcel.stepItinerary")}
                v={`${originCity} → ${destinationWilaya}`}
              />
              <Row k={t("postParcel.urgency")} v={t(URGENCY_KEY[urgency])} />
              {offeredPrice ? (
                <Row k={t("postParcel.summaryPrice")} v={eur(parseFloat(offeredPrice))} />
              ) : null}
            </Card>
          </View>
        ) : null}

        <View className="flex-row gap-stack-gap mt-section-gap">
          {step > 0 ? (
            <View className="flex-1">
              <Button label={t("postParcel.back")} variant="secondary" onPress={() => setStep((s) => s - 1)} />
            </View>
          ) : null}
          <View className="flex-1">
            {step < steps.length - 1 ? (
              <Button label={t("postParcel.continue")} onPress={next} />
            ) : (
              <Button label={t("postParcel.publish")} onPress={submit} loading={submitting} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-text-muted font-body text-sm">{k}</Text>
      <Text className="text-text-primary font-body text-sm font-semibold">{v}</Text>
    </View>
  );
}
