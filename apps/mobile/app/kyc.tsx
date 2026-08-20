/**
 * KYC verification (board 09) — submit ID + selfie for manual admin review.
 *
 * Shows the current level + latest submission status, and a submit form to
 * step up to ENHANCED or FULL. Document + selfie are picked from the photo
 * library and uploaded via /uploads/presign (see lib/uploads), then the
 * resulting object URLs are submitted for review. On approval the backend
 * bumps kycLevel + recomputes trust (async, by an admin).
 */
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";
import { StatusPill } from "../src/components/StatusPill";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { getKycStatus, submitKyc, type DocumentType } from "../src/lib/kyc";
import { ApiError } from "../src/lib/api";
import { KYC_LEVEL, formatDateTime } from "../src/lib/format";

export default function KycScreen() {
  const { t } = useTranslation();
  const { refreshUser, tokens } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => getKycStatus(), []);
  const [submitting, setSubmitting] = useState(false);

  const [docType, setDocType] = useState<DocumentType>("PASSPORT");
  const [docUrl, setDocUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [target, setTarget] = useState<"ENHANCED" | "FULL">("ENHANCED");

  const docTypes: { value: DocumentType; label: string }[] = [
    { value: "PASSPORT", label: t("kyc.docPassport") },
    { value: "NATIONAL_ID", label: t("kyc.docNationalId") },
    { value: "DRIVERS_LICENSE", label: t("kyc.docLicense") },
    { value: "RESIDENCY_PERMIT", label: t("kyc.docResidency") },
  ];
  const targetLevels = [
    { value: "ENHANCED", label: t("kyc.targetEnhanced") },
    { value: "FULL", label: t("kyc.targetFull") },
  ];

  // Verification is per-account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("profile.kyc")} />;
  }

  const level = data ? KYC_LEVEL[data.kycLevel] : null;
  const sub = data?.latestSubmission;

  async function submit() {
    if (!docUrl.trim() || !selfieUrl.trim()) {
      Alert.alert(t("common.missingTitle"), t("kyc.missingBody"));
      return;
    }
    setSubmitting(true);
    try {
      await submitKyc({
        documentType: docType,
        documentUrl: docUrl.trim(),
        selfieUrl: selfieUrl.trim(),
        targetLevel: target,
      });
      Alert.alert(t("kyc.sentTitle"), t("kyc.sentBody"));
      refresh();
      refreshUser().catch(() => {});
    } catch (e) {
      Alert.alert(t("common.impossible"), e instanceof ApiError ? e.message : t("common.retryShort"));
    } finally {
      setSubmitting(false);
    }
  }

  const pending = sub?.status === "PENDING";

  return (
    <Screen>
      <ScreenHeader title={t("profile.kyc")} />

      {loading ? null : error ? (
        <Text>{error}</Text>
      ) : (
        <View className="gap-stack-gap">
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-meta uppercase text-text-secondary">{t("kyc.currentLevel")}</Text>
              {level ? <StatusPill label={t(level.key)} tone={level.tone} /> : null}
            </View>
            {sub ? (
              <View>
                <Text className="text-text-muted text-xs font-body">
                  {t("kyc.lastSubmission")} : {sub.status === "PENDING" ? t("kyc.subPending") : sub.status === "APPROVED" ? t("kyc.subApproved") : t("kyc.subRejected")}
                  {" · "}{formatDateTime(sub.createdAt)}
                </Text>
                {sub.status === "REJECTED" && sub.reviewNote ? (
                  <Text className="text-danger text-xs font-body mt-1">{t("kyc.reviewNote", { note: sub.reviewNote })}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>

          {data && data.kycLevel === "FULL" ? (
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-body text-sm">
                {t("kyc.maxLevel")}
              </Text>
            </Card>
          ) : pending ? (
            <Card className="bg-info/10 border-info/30">
              <Text className="text-text-secondary font-body text-sm">
                {t("kyc.pendingReview")}
              </Text>
            </Card>
          ) : (
            <View className="gap-stack-gap">
              <Text className="font-mono text-meta uppercase text-text-secondary">{t("kyc.newSubmission")}</Text>
              <Select label={t("kyc.docType")} value={docType} options={docTypes} onSelect={(v) => setDocType(v as DocumentType)} />
              <PhotoPicker
                label={t("kyc.docPhoto")}
                purpose="kyc-doc"
                onUploaded={setDocUrl}
                onClear={() => setDocUrl("")}
              />
              <PhotoPicker
                label={t("kyc.selfie")}
                purpose="kyc-selfie"
                onUploaded={setSelfieUrl}
                onClear={() => setSelfieUrl("")}
              />
              <Select
                label={t("kyc.targetLevel")}
                value={target}
                options={targetLevels}
                onSelect={(v) => setTarget(v as "ENHANCED" | "FULL")}
              />
              <Button label={t("kyc.submit")} onPress={submit} loading={submitting} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
