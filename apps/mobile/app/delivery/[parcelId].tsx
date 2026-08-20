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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    return <AuthWall headerTitle={t("delivery.title")} />;
  }

  if (loading && !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("delivery.title")} />
        <Text className="text-text-muted">{t("common.loading")}</Text>
      </Screen>
    );
  }
  if (error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("delivery.title")} />
        <Text className="text-danger">{error ?? t("parcelDetail.notFound")}</Text>
        <View className="mt-section-gap">
          <Button label={t("common.retry")} variant="secondary" onPress={refresh} />
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
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setBusy(false);
    }
  }

  async function onDeliver() {
    if (!/^\d{6}$/.test(pin.trim())) {
      Alert.alert(t("delivery.invalidCodeTitle"), t("delivery.invalidCodeBody"));
      return;
    }
    setBusy(true);
    try {
      const res = await deliverParcel(parcel!.id, pin.trim());
      const payout = res.payout as { status?: string };
      Alert.alert(
        t("delivery.deliveredAlertTitle"),
        t("delivery.deliveredBody") + " " +
          (payout?.status === "RELEASED"
            ? t("delivery.payoutReleased")
            : payout?.status === "PAYOUT_PENDING"
              ? t("delivery.payoutPendingSetup")
              : t("delivery.payoutReleasing")),
        [{ text: t("common.ok"), onPress: () => router.replace(`/parcel/${parcel!.id}`) }],
      );
    } catch (e) {
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader title={t("delivery.fullTitle")} />

        {parcel.status === "DELIVERED" ? (
          <View className="gap-stack-gap">
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-heading font-bold text-lg">{t("delivery.deliveredTitle")}</Text>
              <Text className="text-text-secondary font-body text-sm mt-1">
                {t("delivery.alreadyConfirmed")}
              </Text>
            </Card>
            {!isSender && !isTraveler ? null : ratingsLoading ? (
              <Text className="text-text-muted">{t("delivery.loadingRating")}</Text>
            ) : ratingsError ? (
              <Text className="text-text-muted font-body text-sm">
                {t("delivery.ratingLoadError")}
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
              {t("delivery.senderIntro")}
            </Text>
            {revealedPin ? (
              <Card className="items-center bg-info/15 border-info/40 py-xl">
                <Text className="font-mono text-meta uppercase text-text-secondary">{t("parcelDetail.pinTitle")}</Text>
                <Text className="text-accent font-heading text-5xl font-bold tracking-[0.3em] mt-2">
                  {revealedPin}
                </Text>
                <Text className="text-text-muted text-xs font-body mt-3 text-center">
                  {t("delivery.pinWarning")}
                </Text>
              </Card>
            ) : null}
            <Button
              label={revealedPin ? t("delivery.regenerate") : t("delivery.generate")}
              onPress={onGenerate}
              loading={busy}
            />
          </View>
        ) : isTraveler ? (
          <View className="gap-stack-gap">
            <Text className="text-text-primary font-body">
              {t("delivery.travelerIntro")}
            </Text>
            <Input
              label={t("delivery.pinInput")}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
            />
            <Button label={t("parcelDetail.confirmDelivery")} onPress={onDeliver} loading={busy} />
          </View>
        ) : (
          <Text className="text-text-muted">
            {t("delivery.notParty")}
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
  const { t } = useTranslation();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (score < 1) {
      Alert.alert(t("delivery.ratingMissingTitle"), t("delivery.ratingMissingBody"));
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
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-stack-gap">
      <Text className="text-text-primary font-heading font-bold">{t("delivery.rateTitle")}</Text>
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
        label={t("delivery.comment")}
        value={comment}
        onChangeText={setComment}
        placeholder={t("delivery.commentPlaceholder")}
        multiline
        className="h-20"
      />
      <Button label={t("delivery.submitRating")} onPress={submit} loading={submitting} />
    </Card>
  );
}

function RatingSubmitted({ rating }: { rating: Rating }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <Card className="gap-2 bg-info/10 border-info/30">
      <Text className="text-text-primary font-body font-semibold">{t("delivery.thanks")}</Text>
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
