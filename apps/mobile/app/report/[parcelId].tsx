/**
 * Report an issue (board 13) — opens a Dispute for a specific parcel.
 *
 * Reasons are filtered by the caller's role: a sender never sees "the
 * sender never showed up" as an option, and vice versa for the traveler.
 * If a dispute already exists for this parcel, shows it read-only instead
 * of the form (Dispute.parcelId is unique — one report per parcel).
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Input } from "../../src/components/Input";
import { Select, type SelectOption } from "../../src/components/Select";
import { Button } from "../../src/components/Button";
import { useAsync } from "../../src/hooks/useAsync";
import { getDispute, openDispute, type Dispute } from "../../src/lib/disputes";
import { ApiError } from "../../src/lib/api";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS, formatDateTime } from "../../src/lib/format";
import type { DisputeReason } from "../../src/lib/types";

const SHARED_REASONS: DisputeReason[] = [
  "PARCEL_NOT_DELIVERED",
  "PARCEL_DAMAGED",
  "PARCEL_STOLEN",
  "CUSTOMS_SEIZURE",
  "FRAUD_ATTEMPT",
  "OTHER",
];

function reasonsFor(role: "sender" | "traveler"): SelectOption[] {
  const roleSpecific: DisputeReason = role === "sender" ? "TRAVELER_NO_SHOW" : "SENDER_NO_SHOW";
  return [...SHARED_REASONS, roleSpecific].map((value) => ({
    value,
    label: DISPUTE_REASON_LABEL[value],
  }));
}

export default function ReportScreen() {
  const { parcelId, role } = useLocalSearchParams<{
    parcelId: string;
    role: "sender" | "traveler";
  }>();
  const { data, loading, error, setData } = useAsync(() => getDispute(parcelId), [parcelId]);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = data?.dispute ?? null;

  async function submit() {
    if (!reason) {
      Alert.alert("Champ manquant", "Choisissez un motif.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Champ manquant", "Décrivez ce qui s'est passé.");
      return;
    }
    setSubmitting(true);
    try {
      const { dispute } = await openDispute({ parcelId, reason, description });
      setData({ dispute });
      Alert.alert(
        "Signalement envoyé",
        "Merci. Notre équipe examine votre signalement. Pour les urgences, contactez le support.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Race: someone opened a dispute for this parcel between our GET and this POST.
        const { dispute } = await getDispute(parcelId);
        setData({ dispute });
      } else {
        Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Signaler un problème" />

      {loading ? <Text className="text-muted">Chargement…</Text> : null}
      {error ? <Text className="text-danger">{error}</Text> : null}

      {!loading && !error && existing ? (
        <DisputeReadOnly dispute={existing} />
      ) : null}

      {!loading && !error && !existing ? (
        <View className="gap-md">
          <Select
            label="Motif"
            value={reason || null}
            options={reasonsFor(role)}
            onSelect={(v) => setReason(v as DisputeReason)}
            placeholder="Choisir un motif"
          />
          <Input
            label="Détails"
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez ce qui s'est passé…"
            multiline
            className="h-28"
          />
          <Button label="Envoyer le signalement" onPress={submit} loading={submitting} />
        </View>
      ) : null}
    </Screen>
  );
}

function DisputeReadOnly({ dispute }: { dispute: Dispute }) {
  const st = DISPUTE_STATUS[dispute.status];
  return (
    <Card className="gap-2">
      <StatusPill label={st.label} tone={st.tone} />
      <Text className="text-white font-body font-semibold mt-1">
        {DISPUTE_REASON_LABEL[dispute.reason]}
      </Text>
      <Text className="text-muted font-body text-sm">{dispute.description}</Text>
      <Text className="text-mist/50 font-body text-xs mt-2">
        Signalé le {formatDateTime(dispute.createdAt)}
      </Text>
    </Card>
  );
}
