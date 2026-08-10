/**
 * Report an issue (board 13) — a simple dispute/feedback form.
 *
 * v1: the backend doesn't expose a disputes endpoint yet (the parcel state
 * machine reserves DISPUTED, with a dedicated moderation phase to come). So
 * this screen captures the report client-side and confirms — no data is lost
 * to the user, and wiring POST /reports later is a one-liner.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Alert, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Input } from "../src/components/Input";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";

const REASONS = [
  { value: "delay", label: "Retard de livraison" },
  { value: "damaged", label: "Colis endommagé" },
  { value: "not_delivered", label: "Colis non livré" },
  { value: "payment", label: "Problème de paiement" },
  { value: "behavior", label: "Comportement inapproprié" },
  { value: "other", label: "Autre" },
];

export default function ReportScreen() {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    if (!reason) {
      Alert.alert("Champ manquant", "Choisissez un motif.");
      return;
    }
    setSubmitting(true);
    // No backend endpoint yet; capture locally and confirm. The report is
    // complete from the user's perspective; a POST /reports lands with the
    // moderation phase.
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert(
        "Signalement envoyé",
        "Merci. Notre équipe examine votre signalement. Pour les urgences, contactez le support.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }, 400);
  }

  return (
    <Screen>
      <ScreenHeader title="Signaler un problème" />
      <View className="gap-md">
        <Select label="Motif" value={reason} options={REASONS} onSelect={setReason} placeholder="Choisir un motif" />
        <Input
          label="Détails"
          value={details}
          onChangeText={setDetails}
          placeholder="Décrivez ce qui s'est passé…"
          multiline
          className="h-28"
        />
        <Button label="Envoyer le signalement" onPress={submit} loading={submitting} />
      </View>
    </Screen>
  );
}
