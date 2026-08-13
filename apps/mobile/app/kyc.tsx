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
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Select } from "../src/components/Select";
import { Button } from "../src/components/Button";
import { StatusPill } from "../src/components/StatusPill";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { getKycStatus, submitKyc, type DocumentType } from "../src/lib/kyc";
import { ApiError } from "../src/lib/api";
import { KYC_LEVEL, formatDateTime } from "../src/lib/format";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "PASSPORT", label: "Passeport" },
  { value: "NATIONAL_ID", label: "Carte d'identité" },
  { value: "DRIVERS_LICENSE", label: "Permis de conduire" },
  { value: "RESIDENCY_PERMIT", label: "Titre de séjour" },
];
const TARGET_LEVELS = [
  { value: "ENHANCED", label: "Vérifié (Enhanced)" },
  { value: "FULL", label: "Premium (Full)" },
];

export default function KycScreen() {
  const { refreshUser } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => getKycStatus(), []);
  const [submitting, setSubmitting] = useState(false);

  const [docType, setDocType] = useState<DocumentType>("PASSPORT");
  const [docUrl, setDocUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [target, setTarget] = useState<"ENHANCED" | "FULL">("ENHANCED");

  const level = data ? KYC_LEVEL[data.kycLevel] : null;
  const sub = data?.latestSubmission;

  async function submit() {
    if (!docUrl.trim() || !selfieUrl.trim()) {
      Alert.alert("Champ manquant", "Ajoutez la photo du document et du selfie.");
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
      Alert.alert("Demande envoyée", "Votre vérification est en attente de revue. Vous serez notifié de la décision.");
      refresh();
      refreshUser().catch(() => {});
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = sub?.status === "PENDING";

  return (
    <Screen>
      <ScreenHeader title="Vérification d'identité" />

      {loading ? null : error ? (
        <Text>{error}</Text>
      ) : (
        <View className="gap-md">
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-mist/70 text-xs font-body uppercase">Niveau actuel</Text>
              {level ? <StatusPill label={level.label} tone={level.tone} /> : null}
            </View>
            {sub ? (
              <View>
                <Text className="text-muted text-xs font-body">
                  Dernière demande : {sub.status === "PENDING" ? "En revue" : sub.status === "APPROVED" ? "Approuvée" : "Rejetée"}
                  {" · "}{formatDateTime(sub.createdAt)}
                </Text>
                {sub.status === "REJECTED" && sub.reviewNote ? (
                  <Text className="text-danger text-xs font-body mt-1">Motif : {sub.reviewNote}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>

          {data && data.kycLevel === "FULL" ? (
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-body text-sm">
                Niveau maximum atteint ✓ — votre profil est entièrement vérifié.
              </Text>
            </Card>
          ) : pending ? (
            <Card className="bg-violet/10 border-violet/30">
              <Text className="text-mist font-body text-sm">
                Votre demande est en cours de revue par notre équipe. Vous
                serez notifié dès qu'elle sera traitée.
              </Text>
            </Card>
          ) : (
            <View className="gap-md">
              <Text className="text-mist/70 text-xs font-body uppercase">Nouvelle demande</Text>
              <Select label="Type de document" value={docType} options={DOC_TYPES} onSelect={(v) => setDocType(v as DocumentType)} />
              <PhotoPicker
                label="Document (recto)"
                purpose="kyc-doc"
                onUploaded={setDocUrl}
                onClear={() => setDocUrl("")}
              />
              <PhotoPicker
                label="Selfie"
                purpose="kyc-selfie"
                onUploaded={setSelfieUrl}
                onClear={() => setSelfieUrl("")}
              />
              <Select
                label="Niveau visé"
                value={target}
                options={TARGET_LEVELS}
                onSelect={(v) => setTarget(v as "ENHANCED" | "FULL")}
              />
              <Button label="Soumettre" onPress={submit} loading={submitting} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
