/**
 * Delivery confirmation (board 16) — the PIN handoff.
 *
 * Two roles, resolved from the parcel:
 *  - Sender (owns the parcel): generates the 6-digit PIN to share out-of-band
 *    with the recipient; regenerating overwrites the hash.
 *  - Traveler (owns the matched trip): enters the PIN at handover to confirm
 *    delivery — POST /parcels/:id/deliver flips → DELIVERED and fires escrow
 *    release server-side.
 *
 * The screen auto-detects the role so the same route serves both parties.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import {
  deliverParcel,
  generateDeliveryPin,
  getParcel,
} from "../../src/lib/parcels";
import { getRatings, submitRating, type Rating } from "../../src/lib/ratings";
import { ApiError } from "../../src/lib/api";

export default function DeliveryScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const user = useAuth((s) => s.user);
  const { data, loading, error, refresh } = useAsync(() => getParcel(parcelId), [parcelId]);
  const parcel = data?.parcel;
  const {
    data: ratingsData,
    loading: ratingsLoading,
    setData: setRatingsData,
  } = useAsync(() => getRatings(parcelId), [parcelId]);

  const [pin, setPin] = useState("");
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Livraison" />
        <Text className="text-muted">Chargement…</Text>
      </Screen>
    );
  }
  if (error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Livraison" />
        <Text className="text-danger">{error ?? "Colis introuvable."}</Text>
        <View className="mt-md">
          <Button label="Réessayer" variant="secondary" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const isSender = !!user && parcel.senderId === user.id;
  const isTraveler = !!user && parcel.matchedTrip?.traveler?.id === user.id;
  const myRating = ratingsData?.ratings.find((r) => r.fromUserId === user?.id) ?? null;

  async function onGenerate() {
    setBusy(true);
    try {
      const { pin: p } = await generateDeliveryPin(parcel!.id);
      setRevealedPin(p);
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeliver() {
    if (!/^\d{6}$/.test(pin.trim())) {
      Alert.alert("Code invalide", "Entrez les 6 chiffres.");
      return;
    }
    setBusy(true);
    try {
      const res = await deliverParcel(parcel!.id, pin.trim());
      const payout = res.payout as { status?: string };
      Alert.alert(
        "Livraison confirmée ✓",
        "Le colis est livré. " +
          (payout?.status === "RELEASED"
            ? "Le paiement a été libéré au voyageur."
            : payout?.status === "PAYOUT_PENDING"
              ? "Le paiement sera libéré dès que le voyageur aura configuré ses paiements."
              : "Le paiement est en cours de libération."),
        [{ text: "OK", onPress: () => router.replace(`/parcel/${parcel!.id}`) }],
      );
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader title="Confirmation de livraison" />

        {parcel.status === "DELIVERED" ? (
          <View className="gap-md">
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-heading font-bold text-lg">Colis livré ✓</Text>
              <Text className="text-mist font-body text-sm mt-1">
                La livraison a déjà été confirmée.
              </Text>
            </Card>
            {ratingsLoading ? (
              <Text className="text-muted">Chargement de votre avis…</Text>
            ) : myRating ? (
              <RatingSubmitted rating={myRating} />
            ) : (
              <RatingPrompt
                parcelId={parcel.id}
                onSubmitted={(rating) =>
                  setRatingsData((prev) => ({
                    ratings: [...(prev?.ratings ?? []), rating],
                  }))
                }
              />
            )}
          </View>
        ) : isSender ? (
          <View className="gap-md">
            <Text className="text-white font-body">
              Générez un code à 6 chiffres et partagez-le hors-app avec le
              destinataire (ex. WhatsApp). Le voyageur le saisira à la remise
              pour confirmer la livraison et déclencher le paiement.
            </Text>
            {revealedPin ? (
              <Card className="items-center bg-violet/15 border-violet/40 py-xl">
                <Text className="text-mist/70 text-xs font-body uppercase">Code de livraison</Text>
                <Text className="text-accent font-heading text-5xl font-bold tracking-[0.3em] mt-2">
                  {revealedPin}
                </Text>
                <Text className="text-muted text-xs font-body mt-3 text-center">
                  Ne partagez ce code qu'avec le destinataire final.
                </Text>
              </Card>
            ) : null}
            <Button
              label={revealedPin ? "Régénérer le code" : "Générer le code"}
              onPress={onGenerate}
              loading={busy}
            />
          </View>
        ) : isTraveler ? (
          <View className="gap-md">
            <Text className="text-white font-body">
              À la remise, demandez le code à 6 chiffres au destinataire et
              saisissez-le pour confirmer la livraison. Le paiement est libéré
              automatiquement.
            </Text>
            <Input
              label="Code de livraison (6 chiffres)"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
            />
            <Button label="Confirmer la livraison" onPress={onDeliver} loading={busy} />
          </View>
        ) : (
          <Text className="text-muted">
            Vous n'êtes pas partie à ce colis.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function RatingPrompt({
  parcelId,
  onSubmitted,
}: {
  parcelId: string;
  onSubmitted: (rating: Rating) => void;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (score < 1) {
      Alert.alert("Note manquante", "Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    setSubmitting(true);
    try {
      const { rating } = await submitRating({
        parcelId,
        score,
        comment: comment.trim() || undefined,
      });
      onSubmitted(rating);
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-md">
      <Text className="text-white font-heading font-bold">Notez votre expérience</Text>
      <View className="flex-row gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} hitSlop={8}>
            <Ionicons
              name={n <= score ? "star" : "star-outline"}
              size={32}
              color="#FF6A2B"
            />
          </Pressable>
        ))}
      </View>
      <Input
        label="Commentaire (optionnel)"
        value={comment}
        onChangeText={setComment}
        placeholder="Un mot sur votre expérience…"
        multiline
        className="h-20"
      />
      <Button label="Envoyer mon avis" onPress={submit} loading={submitting} />
    </Card>
  );
}

function RatingSubmitted({ rating }: { rating: Rating }) {
  return (
    <Card className="gap-2 bg-violet/10 border-violet/30">
      <Text className="text-white font-body font-semibold">Merci pour votre avis !</Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name={n <= rating.score ? "star" : "star-outline"}
            size={18}
            color="#FF6A2B"
          />
        ))}
      </View>
      {rating.comment ? (
        <Text className="text-muted font-body text-sm mt-1">{rating.comment}</Text>
      ) : null}
    </Card>
  );
}
