/**
 * Parcel detail — the sender's view of one parcel, with status-driven actions.
 *
 * Routes the user to the right next step based on the parcel's lifecycle:
 *   PENDING_MATCH   → find matches
 *   MATCHED         → fund escrow + chat + generate delivery PIN
 *   in-transit/awaiting → track
 * Also offers cancel (pre-transit) and the chat thread.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { Avatar } from "../../src/components/Avatar";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import {
  cancelParcel,
  generateDeliveryPin,
  getParcel,
  markAwaitingDelivery,
  markInTransit,
  markPickedUp,
} from "../../src/lib/parcels";
import { ApiError, OfflineQueuedError } from "../../src/lib/api";
import {
  CATEGORY_LABEL,
  cityOf,
  eur,
  formatDate,
  formatDateTime,
  PARCEL_STATUS,
  URGENCY_LABEL,
} from "../../src/lib/format";
import type { Parcel } from "../../src/lib/parcels";

/** Traveler-only status advance: MATCHED → AWAITING_PICKUP → IN_TRANSIT → AWAITING_DELIVERY. */
const TRAVELER_STEPS: Record<
  string,
  { label: string; action: (id: string) => Promise<{ parcel: Parcel }> } | undefined
> = {
  MATCHED: { label: "Marquer le colis récupéré", action: markPickedUp },
  AWAITING_PICKUP: { label: "Marquer en transit", action: markInTransit },
  IN_TRANSIT: { label: "Marquer arrivé à destination", action: markAwaitingDelivery },
};

export default function ParcelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh, setData } = useAsync(
    () => getParcel(id),
    [id],
  );
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  const parcel = data?.parcel;

  if (loading && !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Colis" />
        <Text className="text-muted">Chargement…</Text>
      </Screen>
    );
  }
  if (error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Colis" />
        <Text className="text-danger">{error ?? "Colis introuvable."}</Text>
        <View className="mt-md">
          <Button label="Réessayer" variant="secondary" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const st = PARCEL_STATUS[parcel.status] ?? { label: parcel.status, tone: "muted" as const };
  const matched = parcel.status !== "PENDING_MATCH" && parcel.status !== "DRAFT" && parcel.status !== "CANCELLED";
  const inMotion = ["AWAITING_PICKUP", "IN_TRANSIT", "AWAITING_DELIVERY"].includes(parcel.status);
  const canCancel = ["DRAFT", "PENDING_MATCH", "MATCHED"].includes(parcel.status);
  const isTraveler = !!user && parcel.matchedTrip?.traveler?.id === user.id;
  const canReport = matched && parcel.status !== "SEIZED" && (isTraveler || parcel.senderId === user?.id);
  const canGoToDelivery = parcel.status === "AWAITING_DELIVERY" || parcel.status === "DELIVERED";
  const travelerStep = isTraveler ? TRAVELER_STEPS[parcel.status] : undefined;

  async function onAdvance() {
    if (!travelerStep) return;
    setBusy(true);
    try {
      // The lifecycle endpoints return the bare updated row (no relations),
      // so refetch via getParcel to keep matchedTrip.traveler/sender populated.
      await travelerStep.action(parcel!.id);
      refresh();
    } catch (e) {
      if (e instanceof OfflineQueuedError) {
        Alert.alert("Action enregistrée", "Envoi automatique à la reconnexion.");
      } else {
        Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onGeneratePin() {
    setBusy(true);
    try {
      const { pin } = await generateDeliveryPin(parcel!.id);
      Alert.alert(
        "Code de livraison",
        `${pin}\n\nPartagez-le hors-app avec le destinataire (ex. WhatsApp). Le voyageur le saisira à la livraison.`,
      );
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    Alert.alert("Annuler ce colis ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const { parcel: updated } = await cancelParcel(parcel!.id);
            setData({ parcel: updated });
          } catch (e) {
            Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader title={`Colis · ${st.label}`} subtitle={parcel.description} />

        <StatusPill label={st.label} tone={st.tone} />

        <Card className="mt-md gap-2">
          <Row k="Itinéraire" v={`${cityOf(parcel.pickupAddress)} → ${cityOf(parcel.deliveryAddress)}`} />
          <Row k="Poids" v={`${parcel.weightKg} kg`} />
          <Row k="Catégorie" v={CATEGORY_LABEL[parcel.category] ?? parcel.category} />
          <Row k="Urgence" v={URGENCY_LABEL[parcel.urgencyLevel]} />
          {parcel.urgencyDeadline ? (
            <Row k="Échéance" v={formatDate(parcel.urgencyDeadline)} />
          ) : null}
          {parcel.offeredPrice != null ? (
            <Row k="Prix proposé" v={eur(parcel.offeredPrice)} />
          ) : null}
          <Row k="Créé le" v={formatDateTime(parcel.createdAt)} />
        </Card>

        {/* Matched traveler */}
        {parcel.matchedTrip?.traveler ? (
          <Card className="mt-md gap-2">
            <Text className="text-mist/70 text-xs font-body uppercase">Voyageur</Text>
            <View className="flex-row items-center gap-md">
              <Avatar name={parcel.matchedTrip.traveler.firstName} />
              <View className="flex-1">
                <Text className="text-white font-body font-semibold">
                  {parcel.matchedTrip.traveler.firstName}
                </Text>
                {parcel.matchedTrip.departureTime ? (
                  <Text className="text-muted text-xs font-body">
                    Départ {formatDate(parcel.matchedTrip.departureTime)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => router.push(`/chat/${parcel.id}`)}
                className="rounded-pill bg-accent/20 px-3 py-1.5"
              >
                <Text className="text-accent text-xs font-bold">Discuter</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Actions */}
        <View className="gap-md mt-lg">
          {parcel.status === "PENDING_MATCH" ? (
            <Button label="Trouver un voyageur" onPress={() => router.push(`/matching/${parcel.id}`)} />
          ) : null}
          {parcel.status === "MATCHED" ? (
            <Button label="Sécuriser le paiement" onPress={() => router.push(`/escrow/${parcel.id}`)} />
          ) : null}
          {travelerStep ? (
            <Button label={travelerStep.label} onPress={onAdvance} loading={busy} />
          ) : null}
          {matched ? (
            <Button
              label="Générer le code de livraison"
              variant="secondary"
              onPress={onGeneratePin}
              loading={busy}
            />
          ) : null}
          {canGoToDelivery ? (
            <Button
              label={parcel.status === "DELIVERED" ? "Livraison & avis" : "Confirmer la livraison"}
              variant="secondary"
              onPress={() => router.push(`/delivery/${parcel.id}`)}
            />
          ) : null}
          {inMotion ? (
            <Button label="Suivre le colis" onPress={() => router.push(`/tracking/${parcel.id}`)} />
          ) : null}
          {matched ? (
            <Button
              label="Suivi & détails"
              variant="ghost"
              onPress={() => router.push(`/tracking/${parcel.id}`)}
            />
          ) : null}
          {canCancel ? (
            <Button label="Annuler ce colis" variant="ghost" onPress={onCancel} loading={busy} />
          ) : null}
          {canReport ? (
            <Button
              label="Signaler un problème"
              variant="ghost"
              onPress={() =>
                router.push(
                  `/report/${parcel.id}?role=${isTraveler ? "traveler" : "sender"}`,
                )
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between gap-md">
      <Text className="text-muted font-body text-sm">{k}</Text>
      <Text className="text-white font-body text-sm font-semibold text-right flex-shrink" numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}
