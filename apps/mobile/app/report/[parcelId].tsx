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
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Input } from "../../src/components/Input";
import { Select, type SelectOption } from "../../src/components/Select";
import { Button } from "../../src/components/Button";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { getDispute, openDispute, type Dispute } from "../../src/lib/disputes";
import { ApiError } from "../../src/lib/api";
import { DISPUTE_REASON_KEY, DISPUTE_STATUS, formatDateTime } from "../../src/lib/format";
import type { DisputeReason } from "../../src/lib/types";

const SHARED_REASONS: DisputeReason[] = [
  "PARCEL_NOT_DELIVERED",
  "PARCEL_DAMAGED",
  "PARCEL_STOLEN",
  "CUSTOMS_SEIZURE",
  "FRAUD_ATTEMPT",
  "OTHER",
];

function reasonsFor(role: "sender" | "traveler", t: (key: string) => string): SelectOption[] {
  const roleSpecific: DisputeReason = role === "sender" ? "TRAVELER_NO_SHOW" : "SENDER_NO_SHOW";
  return [...SHARED_REASONS, roleSpecific].map((value) => ({
    value,
    label: t(DISPUTE_REASON_KEY[value]),
  }));
}

export default function ReportScreen() {
  const { t } = useTranslation();
  const { parcelId, role } = useLocalSearchParams<{
    parcelId: string;
    role: "sender" | "traveler";
  }>();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, setData } = useAsync(() => getDispute(parcelId), [parcelId]);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Disputes are between the two parties — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("parcelDetail.reportProblem")} />;
  }

  const existing = data?.dispute ?? null;

  async function submit() {
    if (!reason) {
      Alert.alert(t("common.missingTitle"), t("report.errReason"));
      return;
    }
    if (!description.trim()) {
      Alert.alert(t("common.missingTitle"), t("report.errDescription"));
      return;
    }
    setSubmitting(true);
    try {
      const { dispute } = await openDispute({ parcelId, reason, description });
      setData({ dispute });
      Alert.alert(
        t("report.sentTitle"),
        t("report.sentBody"),
        [{ text: t("common.ok"), onPress: () => router.back() }],
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const { dispute } = await getDispute(parcelId);
        setData({ dispute });
      } else {
        Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("parcelDetail.reportProblem")} />

      {loading ? <Text className="text-text-muted">{t("common.loading")}</Text> : null}
      {error ? <Text className="text-danger">{error}</Text> : null}

      {!loading && !error && existing ? (
        <DisputeReadOnly dispute={existing} />
      ) : null}

      {!loading && !error && !existing ? (
        <View className="gap-stack-gap">
          <Select
            label={t("report.reason")}
            value={reason || null}
            options={reasonsFor(role, t)}
            onSelect={(v) => setReason(v as DisputeReason)}
            placeholder={t("report.chooseReason")}
          />
          <Input
            label={t("report.details")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("report.detailsPlaceholder")}
            multiline
            className="h-28"
          />
          <Button label={t("report.submit")} onPress={submit} loading={submitting} />
        </View>
      ) : null}
    </Screen>
  );
}

function DisputeReadOnly({ dispute }: { dispute: Dispute }) {
  const { t } = useTranslation();
  const st = DISPUTE_STATUS[dispute.status];
  return (
    <Card className="gap-2">
      <StatusPill label={t(st.key)} tone={st.tone} />
      <Text className="text-text-primary font-body font-semibold mt-1">
        {t(DISPUTE_REASON_KEY[dispute.reason])}
      </Text>
      <Text className="text-text-muted font-body text-sm">{dispute.description}</Text>
      <Text className="text-text-muted/50 font-body text-xs mt-2">
        {t("report.reportedOn", { date: formatDateTime(dispute.createdAt) })}
      </Text>
    </Card>
  );
}
