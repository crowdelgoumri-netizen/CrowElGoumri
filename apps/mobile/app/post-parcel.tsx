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
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Stepper } from "../src/components/Stepper";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { createParcel, type CreateParcelInput } from "../src/lib/parcels";
import { ApiError } from "../src/lib/api";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { pickAndUploadImage } from "../src/lib/uploads";
import {
  CATEGORY_LABEL,
  URGENCY_LABEL,
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

const STEPS = ["Colis", "Itinéraire", "Prix"];
const CATEGORIES = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }));
const URGENCIES = Object.entries(URGENCY_LABEL).map(([value, label]) => ({ value, label }));
const COUNTRIES = ORIGIN_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export default function PostParcelScreen() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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

  function validateStep(): string | null {
    if (step === 0) {
      if (description.trim().length < 10) return "Décrivez le colis (10 caractères min).";
      if (!parseFloat(weightKg)) return "Poids requis.";
      if (!parseFloat(estimatedValue)) return "Valeur estimée requise.";
      if (!parseFloat(lengthCm) || !parseFloat(widthCm) || !parseFloat(heightCm))
        return "Dimensions requises.";
    }
    if (step === 1) {
      if (!originCity) return "Ville de départ requise.";
      if (!destinationWilaya) return "Wilaya de destination requise.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      Alert.alert("Champ manquant", err);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
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
        "Envoi impossible",
        e instanceof ApiError ? e.message : "Réessayez plus tard.",
      );
    } finally {
      setPickingPhoto(false);
    }
  }

  async function submit() {
    const err = validateStep();
    if (err) {
      Alert.alert("Champ manquant", err);
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
        "Publication impossible",
        e instanceof ApiError ? e.message : "Réessayez plus tard.",
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
        <ScreenHeader title="Envoyer un colis" />
        <Stepper steps={STEPS} current={step} />

        {step === 0 ? (
          <View className="gap-stack-gap">
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Ex : Téléphone pour mon frère, emballage d'origine"
              multiline
              className="h-24"
            />
            <Select
              label="Catégorie"
              value={category}
              options={CATEGORIES}
              onSelect={(v) => setCategory(v as ParcelCategory)}
            />
            <Input
              label="Poids (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="2.5"
            />
            <Input
              label="Valeur estimée (€)"
              value={estimatedValue}
              onChangeText={setEstimatedValue}
              keyboardType="numeric"
              placeholder="350"
            />
            <View className="flex-row gap-stack-gap">
              <View className="flex-1">
                <Input label="L (cm)" value={lengthCm} onChangeText={setLengthCm} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Input label="l (cm)" value={widthCm} onChangeText={setWidthCm} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Input label="h (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
              </View>
            </View>

            <View className="gap-1 mt-sm">
              <Text className="font-mono text-meta uppercase text-text-secondary">Photos (optionnel, max 5)</Text>
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
              label="Facture (optionnel)"
              purpose="invoice"
              onUploaded={setInvoiceUrl}
              onClear={() => setInvoiceUrl(null)}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View className="gap-stack-gap">
            <Text className="font-mono text-meta text-text-secondary ml-1">Départ (Europe)</Text>
            <Select label="Pays d'origine" value={originCountry} options={COUNTRIES} onSelect={(v) => { setOriginCountry(v); setOriginCity(""); }} />
            <Select
              label="Ville de départ"
              value={originCity}
              options={cities}
              onSelect={setOriginCity}
              placeholder="Choisir une ville"
            />
            <Text className="font-mono text-meta text-text-secondary ml-1 mt-sm">Arrivée (Algérie)</Text>
            <Select
              label="Wilaya de destination"
              value={destinationWilaya}
              options={WILAYAS_1_58}
              onSelect={setDestinationWilaya}
            />
            <Input
              label="Nom du destinataire (optionnel)"
              value={recipientName}
              onChangeText={setRecipientName}
            />
            <Input
              label="Téléphone du destinataire (optionnel, +213…)"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View className="gap-stack-gap">
            <Select
              label="Urgence"
              value={urgency}
              options={URGENCIES}
              onSelect={(v) => setUrgency(v as UrgencyLevel)}
            />
            <Input
              label="Prix proposé (€, optionnel)"
              value={offeredPrice}
              onChangeText={setOfferedPrice}
              keyboardType="numeric"
              placeholder="30"
            />
            <Card raised className="gap-2 mt-sm">
              <Text className="font-mono text-meta uppercase text-text-secondary">Récapitulatif</Text>
              <Row k="Colis" v={`${weightKg || "—"} kg · ${CATEGORY_LABEL[category]}`} />
              <Row
                k="Itinéraire"
                v={`${originCity} → ${destinationWilaya}`}
              />
              <Row k="Urgence" v={URGENCY_LABEL[urgency]} />
              {offeredPrice ? (
                <Row k="Prix proposé" v={eur(parseFloat(offeredPrice))} />
              ) : null}
            </Card>
          </View>
        ) : null}

        <View className="flex-row gap-stack-gap mt-section-gap">
          {step > 0 ? (
            <View className="flex-1">
              <Button label="Retour" variant="secondary" onPress={() => setStep((s) => s - 1)} />
            </View>
          ) : null}
          <View className="flex-1">
            {step < STEPS.length - 1 ? (
              <Button label="Continuer" onPress={next} />
            ) : (
              <Button label="Publier" onPress={submit} loading={submitting} />
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
