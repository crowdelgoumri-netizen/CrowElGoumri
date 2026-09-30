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
import { useTranslation } from "react-i18next";
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
  CATEGORY_KEY,
  cityOf,
  eur,
  formatDate,
  formatDateTime,
  PARCEL_STATUS,
  URGENCY_KEY,
} from "../../src/lib/format";
import type { Parcel } from "../../src/lib/parcels";

/** Traveler-only status advance: MATCHED → AWAITING_PICKUP → IN_TRANSIT → AWAITING_DELIVERY. */
const TRAVELER_STEPS: Record<
  string,
  { key: string; action: (id: string) => Promise<{ parcel: Parcel }> } | undefined
> = {
  MATCHED: { key: "parcelDetail.stepPickedUp", action: markPickedUp },
  AWAITING_PICKUP: { key: "parcelDetail.stepInTransit", action: markInTransit },
  IN_TRANSIT: { key: "parcelDetail.stepArrived", action: markAwaitingDelivery },
};

export default function ParcelDetailScreen() {
  const { t } = useTranslation();
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
        <ScreenHeader title={t("parcelDetail.title")} />
        <Text className="text-text-muted">{t("common.loading")}</Text>
      </Screen>
    );
  }
  if (error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("parcelDetail.title")} />
        <Text className="text-danger">{error ?? t("parcelDetail.notFound")}</Text>
        <View className="mt-section-gap">
          <Button label={t("common.retry")} variant="secondary" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const st = PARCEL_STATUS[parcel.status] ?? { key: parcel.status, tone: "muted" as const };
  const matched = parcel.status !== "PENDING_MATCH" && parcel.status !== "DRAFT" && parcel.status !== "CANCELLED";
  const inMotion = ["AWAITING_PICKUP", "IN_TRANSIT", "AWAITING_DELIVERY"].includes(parcel.status);
  const canCancel = ["DRAFT", "PENDING_MATCH", "MATCHED"].includes(parcel.status);
  const isTraveler = !!user && parcel.matchedTrip?.traveler?.id === user.id;
  const isSender = !!user && parcel.senderId === user.id;
  // Guests get a read-only vetting view — every action below needs an account
  // and would otherwise surface a raw 401 alert.
  const canAct = !!user;
  const canReport = matched && parcel.status !== "SEIZED" && (isTraveler || isSender);
  const canGoToDelivery = parcel.status === "AWAITING_DELIVERY" || parcel.status === "DELIVERED";
  const travelerStep = isTraveler ? TRAVELER_STEPS[parcel.status] : undefined;

  async function onAdvance() {
    if (!travelerStep) return;
    setBusy(true);
    try {
      await travelerStep.action(parcel!.id);
      refresh();
    } catch (e) {
      if (e instanceof OfflineQueuedError) {
        Alert.alert(t("common.queuedTitle"), t("common.queuedBody"));
      } else {
        Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onGeneratePin() {
    setBusy(true);
    try {
      const { pin } = await generateDeliveryPin(parcel!.id);
      Alert.alert(t("parcelDetail.pinTitle"), t("parcelDetail.pinBody", { pin }));
    } catch (e) {
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    Alert.alert(t("parcelDetail.cancelTitle"), t("parcelDetail.cancelBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const { parcel: updated } = await cancelParcel(parcel!.id);
            setData({ parcel: updated });
          } catch (e) {
            Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
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
        <ScreenHeader title={`${t("parcelDetail.title")} · ${t(st.key)}`} subtitle={parcel.description} />

        <StatusPill label={t(st.key)} tone={st.tone} />

        <Card className="mt-section-gap gap-2">
          <Row k={t("parcelDetail.itinerary")} v={`${cityOf(parcel.pickupAddress)} → ${cityOf(parcel.deliveryAddress)}`} />
          <Row k={t("parcelDetail.weight")} v={`${parcel.weightKg} kg`} />
          <Row k={t("postParcel.category")} v={t(CATEGORY_KEY[parcel.category] ?? parcel.category)} />
          <Row k={t("postParcel.urgency")} v={t(URGENCY_KEY[parcel.urgencyLevel])} />
          {parcel.urgencyDeadline ? (
            <Row k={t("parcelDetail.deadline")} v={formatDate(parcel.urgencyDeadline)} />
          ) : null}
          {parcel.offeredPrice != null ? (
            <Row k={t("postParcel.summaryPrice")} v={eur(parcel.offeredPrice)} />
          ) : null}
          <Row k={t("parcelDetail.created")} v={formatDateTime(parcel.createdAt)} />
        </Card>

        {/* Matched traveler */}
        {parcel.matchedTrip?.traveler ? (
          <Card className="mt-section-gap gap-2">
            <Text className="font-mono text-meta uppercase text-text-secondary">{t("tripCard.traveler")}</Text>
            <View className="flex-row items-center gap-stack-gap">
              <Avatar name={parcel.matchedTrip.traveler.firstName} />
              <View className="flex-1">
                <Text className="text-text-primary font-body font-semibold">
                  {parcel.matchedTrip.traveler.firstName}
                </Text>
                {parcel.matchedTrip.departureTime ? (
                  <Text className="text-text-muted text-xs font-body">
                    {t("parcelDetail.departs", { date: formatDate(parcel.matchedTrip.departureTime) })}
                  </Text>
                ) : null}
              </View>
              {canAct ? (
                <Pressable
                  onPress={() => router.push(`/chat/${parcel.id}`)}
                  className="rounded-field bg-accent/20 px-3 py-1.5"
                >
                  <Text className="text-accent text-xs font-bold">{t("parcelDetail.chat")}</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Actions */}
        {canAct ? (
          <View className="gap-stack-gap mt-section-gap">
            {parcel.status === "PENDING_MATCH" ? (
              <Button label={t("parcelDetail.findTraveler")} onPress={() => router.push(`/matching/${parcel.id}`)} />
            ) : null}
            {parcel.status === "MATCHED" ? (
              <Button label={t("parcelDetail.securePayment")} onPress={() => router.push(`/escrow/${parcel.id}`)} />
            ) : null}
            {travelerStep ? (
              <Button label={t(travelerStep.key)} onPress={onAdvance} loading={busy} />
            ) : null}
            {matched ? (
              <Button
                label={t("parcelDetail.generatePin")}
                variant="secondary"
                onPress={onGeneratePin}
                loading={busy}
              />
            ) : null}
            {canGoToDelivery ? (
              <Button
                label={parcel.status === "DELIVERED" ? t("parcelDetail.deliveryReview") : t("parcelDetail.confirmDelivery")}
                variant="secondary"
                onPress={() => router.push(`/delivery/${parcel.id}`)}
              />
            ) : null}
            {inMotion ? (
              <Button label={t("parcelDetail.track")} onPress={() => router.push(`/tracking/${parcel.id}`)} />
            ) : null}
            {matched ? (
              <Button
                label={t("parcelDetail.trackingDetails")}
                variant="ghost"
                onPress={() => router.push(`/tracking/${parcel.id}`)}
              />
            ) : null}
            {canCancel ? (
              <Button label={t("parcelDetail.cancelParcel")} variant="ghost" onPress={onCancel} loading={busy} />
            ) : null}
            {canReport ? (
              <Button
                label={t("parcelDetail.reportProblem")}
                variant="ghost"
                onPress={() =>
                  router.push(
                    `/report/${parcel.id}?role=${isTraveler ? "traveler" : "sender"}`,
                  )
                }
              />
            ) : null}
          </View>
        ) : (
          <View className="mt-section-gap">
            <Button
              label={t("parcelDetail.loginToSend")}
              onPress={() => router.push("/auth/login")}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between gap-stack-gap">
      <Text className="text-text-muted font-body text-sm">{k}</Text>
      <Text className="text-text-primary font-body text-sm font-semibold text-right flex-shrink" numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}
