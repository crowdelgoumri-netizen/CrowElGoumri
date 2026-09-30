/**
 * Suivi de livraison (board 07, DiasporaCart) — the parcel's live progress.
 *
 * Parcel summary card, then the 4-step vertical stepper (Demande acceptée →
 * Colis récupéré → En route → Livré) derived from the parcel's status and the
 * matched trip's checkpoints (filled dot = done, ring = current, muted =
 * upcoming), then the parcel details card + the chat CTA. The traveler posts
 * checkpoints from the trip detail; this is the read-only view for both
 * parties.
 */
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getParcel } from "../../src/lib/parcels";
import { getCheckpoints, type Checkpoint } from "../../src/lib/trips";
import { cityOf, eur, formatDateTime, PARCEL_STATUS } from "../../src/lib/format";

/** Status → progress rank: 0 pending, 1 accepted, 2 in transit, 3 delivered. */
const RANK: Record<string, number> = {
  PENDING_MATCH: 0,
  MATCHED: 1,
  AWAITING_PICKUP: 1,
  IN_TRANSIT: 2,
  AWAITING_DELIVERY: 2,
  DELIVERED: 3,
};

type StepState = "done" | "current" | "upcoming";

export default function TrackingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const tokens = useAuth((s) => s.tokens);
  const parcelReq = useAsync(() => getParcel(parcelId), [parcelId]);
  const parcel = parcelReq.data?.parcel;
  const tripId = parcel?.matchedTripId ?? null;

  const ckReq = useAsync(
    () => (tripId ? getCheckpoints(tripId) : Promise.resolve({ checkpoints: [] as Checkpoint[] })),
    [tripId],
  );
  const checkpoints = ckReq.data?.checkpoints ?? [];

  // Checkpoints are party-only — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("tracking.title")} />;
  }

  if (parcelReq.loading && !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("tracking.title")} />
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (parcelReq.error || !parcel) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title={t("tracking.title")} />
        <Text className="text-danger">{parcelReq.error ?? t("parcelDetail.notFound")}</Text>
        <View className="mt-section-gap">
          <Button label={t("common.retry")} variant="secondary" onPress={parcelReq.refresh} />
        </View>
      </Screen>
    );
  }

  const st = PARCEL_STATUS[parcel.status] ?? { key: parcel.status, tone: "muted" as const };
  const rank = RANK[parcel.status] ?? 0;
  const ckTypes = new Set(checkpoints.map((c) => c.type));

  const steps: { label: string; state: StepState; at?: string }[] = [
    {
      label: t("tracking.stepAccepted"),
      state: rank >= 1 ? "done" : rank === 0 ? "current" : "done",
    },
    {
      label: t("tracking.stepPickedUp"),
      state: rank >= 2 || ckTypes.has("PICKUP") ? "done" : "current",
      at: checkpoints.find((c) => c.type === "PICKUP")?.createdAt,
    },
    {
      label: t("tracking.stepEnRoute"),
      state: rank >= 2 ? "done" : "upcoming",
      at: checkpoints.find((c) => c.type === "TRANSIT")?.createdAt,
    },
    {
      label: t("tracking.stepDelivered"),
      state: parcel.deliveredAt ? "done" : "upcoming",
      at: parcel.deliveredAt ?? undefined,
    },
  ];
  // Only the first upcoming step is "current" after the last done one.
  const firstUpcoming = steps.findIndex((s) => s.state === "upcoming");
  if (firstUpcoming !== -1) steps[firstUpcoming].state = "current";

  const traveler = parcel.matchedTrip?.traveler;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader
          title={t("tracking.fullTitle")}
          subtitle={`${cityOf(parcel.pickupAddress)} → ${cityOf(parcel.deliveryAddress)}`}
        />

        {/* Parcel summary */}
        <Card className="gap-stack-gap">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-primary font-heading font-bold text-base flex-1 pr-2" numberOfLines={2}>
              {parcel.description}
            </Text>
            <StatusPill label={t(st.key)} tone={st.tone} />
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="cube-outline" size={15} color={colors.accent} />
            <Text className="text-text-secondary font-body text-sm">
              {parcel.weightKg} kg
              {parcel.offeredPrice != null ? ` · ${eur(parcel.offeredPrice)}` : ""}
            </Text>
          </View>
        </Card>

        {/* Stepper */}
        <Text className="text-text-primary font-heading font-bold text-base mt-section-gap mb-2.5">
          {t("tracking.progress")}
        </Text>
        <Card>
          {steps.map((step, i) => (
            <StepRow
              key={step.label}
              label={step.label}
              state={step.state}
              at={step.at}
              last={i === steps.length - 1}
            />
          ))}
        </Card>

        {/* Parcel details */}
        <Text className="text-text-primary font-heading font-bold text-base mt-section-gap mb-2.5">
          {t("tracking.details")}
        </Text>
        <Card className="gap-2.5">
          <Row k={t("tracking.detailWeight")} v={`${parcel.weightKg} kg`} />
          {parcel.offeredPrice != null ? (
            <Row k={t("tracking.detailPrice")} v={eur(parcel.offeredPrice)} />
          ) : null}
          {traveler ? (
            <Row k={t("tracking.detailTraveler")} v={traveler.firstName} />
          ) : null}
          {parcel.matchedTrip ? (
            <Row
              k={t("tracking.detailRoute")}
              v={formatDateTime(parcel.matchedTrip.departureTime)}
            />
          ) : null}
        </Card>

        {/* Checkpoint events */}
        {checkpoints.length > 0 ? (
          <>
            <Text className="text-text-primary font-heading font-bold text-base mt-section-gap mb-2.5">
              {t("tracking.timeline")}
            </Text>
            <Card className="gap-stack-gap">
              {checkpoints
                .slice()
                .reverse()
                .map((ck) => (
                  <View key={ck.id} className="flex-row items-start gap-2.5">
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-accent/12 mt-0.5">
                      <Ionicons name="ellipse" size={8} color={colors.accent} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-text-primary font-body text-sm font-semibold">
                        {t(`tracking.ck${ck.type.charAt(0)}${ck.type.slice(1).toLowerCase()}`)}
                      </Text>
                      <Text className="text-text-muted text-xs font-body">
                        {formatDateTime(ck.createdAt)}
                        {ck.location?.address ? ` · ${String(ck.location.address)}` : ""}
                      </Text>
                    </View>
                  </View>
                ))}
            </Card>
          </>
        ) : null}

        <View className="mt-section-gap">
          <Button
            label={t("tracking.chatTraveler")}
            variant="secondary"
            onPress={() => router.push(`/chat/${parcel.id}`)}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function StepRow({
  label,
  state,
  at,
  last,
}: {
  label: string;
  state: StepState;
  at?: string;
  last: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row">
      <View className="items-center mr-card-padding" style={{ width: 30 }}>
        {state === "done" ? (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
            <Ionicons name="checkmark" size={17} color={colors.accentOn} />
          </View>
        ) : state === "current" ? (
          <View className="h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-accent bg-accent/10">
            <View className="h-2.5 w-2.5 rounded-full bg-accent" />
          </View>
        ) : (
          <View className="h-8 w-8 items-center justify-center rounded-full border-[2px] border-hairline-raised">
            <View className="h-2 w-2 rounded-full bg-text-muted/30" />
          </View>
        )}
        {!last ? (
          <View
            className={
              "flex-1 w-[2.5px] rounded-full -my-1 " +
              (state === "done" ? "bg-accent" : "bg-hairline-raised")
            }
            style={{ minHeight: 18 }}
          />
        ) : null}
      </View>
      <View className="flex-1 pb-lg pt-1">
        <Text
          className={
            "font-body text-sm " +
            (state === "done"
              ? "text-text-primary font-semibold"
              : state === "current"
                ? "text-text-primary font-semibold"
                : "text-text-muted")
          }
        >
          {label}
        </Text>
        {at ? (
          <Text className="text-text-muted text-xs font-body mt-0.5">
            {formatDateTime(at)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between gap-stack-gap">
      <Text className="text-text-muted font-body text-sm">{k}</Text>
      <Text
        className="text-text-primary font-body text-sm font-semibold text-right flex-shrink"
        numberOfLines={2}
      >
        {v}
      </Text>
    </View>
  );
}
