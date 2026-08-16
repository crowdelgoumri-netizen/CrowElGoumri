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
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
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
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh } = useAsync(() => getParcel(parcelId), [parcelId]);
  const parcel = data?.parcel;
  const {
    data: ratingsData,
    loading: ratingsLoading,
    error: ratingsError,
    setData: setRatingsData,
  } = useAsync(() => getRatings(parcelId), [parcelId]);

  const [pin, setPin] = useState("");
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The PIN handoff involves the sender/traveler — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle="Livraison" />;
  }

  if (loading && !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Livraison" />
        <Text className="text-text-muted">Chargement…</Text>
      </Screen>
    );
  }
  if (error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Livraison" />
        <Text className="text-danger">{error ?? "Colis introuvable."}</Text>
        <View className="mt-section-gap">
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
          <View className="gap-stack-gap">
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-heading font-bold text-lg">Colis livré ✓</Text>
              <Text className="text-text-secondary font-body text-sm mt-1">
                La livraison a déjà été confirmée.
              </Text>
            </Card>
            {!isSender && !isTraveler ? null : ratingsLoading ? (
              <Text className="text-text-muted">Chargement de votre avis…</Text>
            ) : ratingsError ? (
              <Text className="text-text-muted font-body text-sm">
                Impossible de charger votre avis pour l'instant.
              </Text>
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
          <View className="gap-stack-gap">
            <Text className="text-text-primary font-body">
              Générez un code à 6 chiffres et partagez-le hors-app avec le
              destinataire (ex. WhatsApp). Le voyageur le saisira à la remise
              pour confirmer la livraison et déclencher le paiement.
            </Text>
            {revealedPin ? (
              <Card className="items-center bg-info/15 border-info/40 py-xl">
                <Text className="font-mono text-meta uppercase text-text-secondary">Code de livraison</Text>
                <Text className="text-accent font-heading text-5xl font-bold tracking-[0.3em] mt-2">
                  {revealedPin}
                </Text>
                <Text className="text-text-muted text-xs font-body mt-3 text-center">
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
          <View className="gap-stack-gap">
            <Text className="text-text-primary font-body">
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
          <Text className="text-text-muted">
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
  const colors = useThemeColors();
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
    <Card className="gap-stack-gap">
      <Text className="text-text-primary font-heading font-bold">Notez votre expérience</Text>
      <View className="flex-row gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} hitSlop={8}>
            <Ionicons
              name={n <= score ? "star" : "star-outline"}
              size={32}
              color={colors.accent}
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
  const colors = useThemeColors();
  return (
    <Card className="gap-2 bg-info/10 border-info/30">
      <Text className="text-text-primary font-body font-semibold">Merci pour votre avis !</Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name={n <= rating.score ? "star" : "star-outline"}
            size={18}
            color={colors.accent}
          />
        ))}
      </View>
      {rating.comment ? (
        <Text className="text-text-muted font-body text-sm mt-1">{rating.comment}</Text>
      ) : null}
    </Card>
  );
}
