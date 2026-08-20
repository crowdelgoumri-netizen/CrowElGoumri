/**
 * Tracking (board 04 / full-glass variant 20) — the parcel's live progress.
 *
 * Loads the parcel, then (if matched) the matched trip's checkpoint audit
 * trail, and renders a vertical timeline of the journey (departure → transit
 * → customs → arrival → delivery). The traveler posts checkpoints from the
 * trip detail; this screen is the read-only progress view for both parties.
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
import { getCheckpoints, type Checkpoint, type CheckpointType } from "../../src/lib/trips";
import { cityOf, formatDateTime, PARCEL_STATUS } from "../../src/lib/format";

const CK_ICON: Record<CheckpointType, keyof typeof Ionicons.glyphMap> = {
  DEPARTURE: "airplane",
  PICKUP: "cube",
  TRANSIT: "navigate",
  CUSTOMS: "shield-checkmark",
  ARRIVAL: "flag",
  DELIVERY: "checkmark-done",
};
const CK_KEY: Record<CheckpointType, string> = {
  DEPARTURE: "tracking.ckDeparture",
  PICKUP: "tracking.ckPickup",
  TRANSIT: "tracking.ckTransit",
  CUSTOMS: "tracking.ckCustoms",
  ARRIVAL: "tracking.ckArrival",
  DELIVERY: "tracking.ckDelivery",
};

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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-xl">
        <ScreenHeader
          title={t("tracking.fullTitle")}
          subtitle={`${cityOf(parcel.pickupAddress)} → ${cityOf(parcel.deliveryAddress)}`}
        />
        <StatusPill label={t(st.key)} tone={st.tone} />

        {parcel.deliveredAt ? (
          <Card className="mt-section-gap bg-success/10 border-success/30">
            <Text className="text-success font-heading font-bold">{t("tracking.delivered")}</Text>
            <Text className="text-text-secondary font-body text-xs mt-1">
              {formatDateTime(parcel.deliveredAt)}
            </Text>
          </Card>
        ) : null}

        <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">
          {t("tracking.timeline")}
        </Text>

        {checkpoints.length === 0 && !ckReq.loading ? (
          <Card>
            <Text className="text-text-muted font-body text-sm">
              {t("tracking.empty")}
            </Text>
          </Card>
        ) : null}

        <View className="mt-stack-gap">
          {checkpoints
            .slice()
            .reverse() // most recent first
            .map((ck, i) => (
              <TimelineRow key={ck.id} ck={ck} last={i === checkpoints.length - 1} />
            ))}
        </View>

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

function TimelineRow({ ck, last }: { ck: Checkpoint; last: boolean }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const icon = CK_ICON[ck.type] ?? "ellipse";
  return (
    <View className="flex-row">
      <View className="items-center mr-stack-gap" style={{ width: 28 }}>
        <View className="h-7 w-7 items-center justify-center rounded-full bg-accent/20">
          <Ionicons name={icon} size={14} color={colors.accent} />
        </View>
        {!last ? <View className="flex-1 w-px bg-divider mt-1" /> : null}
      </View>
      <View className="flex-1 pb-stack-gap">
        <Text className="text-text-primary font-body font-semibold">
          {t(CK_KEY[ck.type] ?? ck.type)}
        </Text>
        <Text className="text-text-muted text-xs font-body">
          {formatDateTime(ck.createdAt)}
        </Text>
        {ck.location?.address ? (
          <Text className="text-text-secondary text-xs font-body mt-0.5">
            {String(ck.location.address)}
          </Text>
        ) : null}
        {ck.notes ? (
          <Text className="text-text-secondary/70 text-xs font-body mt-0.5">{ck.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}
