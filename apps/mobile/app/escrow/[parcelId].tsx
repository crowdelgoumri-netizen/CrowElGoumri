/**
 * Escrow checkout — fund the escrow and confirm the card payment via Stripe
 * Payment Sheet.
 *
 * POST /escrow/:id/fund returns a Stripe PaymentIntent clientSecret + the EUR
 * breakdown. The Payment Sheet ( @stripe/stripe-react-native ) handles card
 * entry, 3D Secure, and Apple/Google Pay natively.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { useStripe } from "../../src/lib/stripe-compat";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { StatusPill } from "../../src/components/StatusPill";
import { useAsync } from "../../src/hooks/useAsync";
import { fund, getEscrow } from "../../src/lib/escrow";
import { eur, ESCROW_STATUS } from "../../src/lib/format";
import type { EscrowStatus } from "../../src/lib/types";

export default function EscrowScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const { data, loading, error, refresh } = useAsync(
    () => fund(parcelId),
    [parcelId],
  );
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);

  const breakdown = data?.breakdown;
  const st = data ? ESCROW_STATUS[data.status] : null;

  const alreadyLocked = data?.status === "LOCKED" || data?.status === "RELEASED";

  async function onPay() {
    if (!data?.clientSecret) {
      Alert.alert("Erreur", "Impossible de préparer le paiement.");
      return;
    }

    setBusy(true);
    try {
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: "CrowdShipping",
        paymentIntentClientSecret: data.clientSecret,
      });

      if (initErr) {
        Alert.alert("Paiement", initErr.message);
        setBusy(false);
        return;
      }

      const { error: payErr } = await presentPaymentSheet();

      if (payErr) {
        // User cancelled — not an error, just dismiss.
        if (payErr.code === "Canceled") {
          setBusy(false);
          return;
        }
        Alert.alert("Paiement échoué", payErr.message, [
          { text: "Réessayer", onPress: () => onPay() },
          { text: "Plus tard", style: "cancel" },
        ]);
        setBusy(false);
        return;
      }

      // Payment succeeded — poll escrow to confirm LOCKED (webhook may not have
      // arrived yet, so we give it a moment).
      setPaid(true);
      for (let i = 0; i < 5; i++) {
        const { escrow } = await getEscrow(parcelId);
        if (escrow.status === ("LOCKED" as EscrowStatus)) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      Alert.alert("Paiement", e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Paiement sécurisé" subtitle="Fonds bloqués jusqu'à la livraison" />

      {loading ? (
        <Text className="text-text-muted">Préparation du paiement…</Text>
      ) : null}

      {error ? (
        <View className="gap-stack-gap">
          <Text className="text-danger">{error}</Text>
          {error.includes("must be MATCHED") ? (
            <Text className="text-text-muted font-body text-sm">
              Le colis doit d'abord être accepté par un voyageur pour pouvoir payer.
            </Text>
          ) : null}
          <Button label="Retour" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : null}

      {breakdown ? (
        <View className="gap-stack-gap">
          {st ? <StatusPill label={st.label} tone={st.tone} /> : null}

          <Card className="gap-2">
            <Text className="font-mono text-meta uppercase text-text-secondary">Détail du paiement</Text>
            <Line k="Montant voyageur" v={eur(breakdown.travelerPayout)} />
            <Line k="Frais de plateforme" v={eur(breakdown.platformFee)} />
            {breakdown.insuranceFee > 0 ? (
              <Line k="Assurance" v={eur(breakdown.insuranceFee)} />
            ) : null}
            <View className="h-px bg-divider my-1" />
            <View className="flex-row justify-between items-center">
              <Text className="text-text-primary font-heading text-lg font-bold">Total bloqué</Text>
              <Text className="text-accent font-heading text-numeral font-bold">
                {eur(breakdown.totalAmount)}
              </Text>
            </View>
          </Card>

          <Card className="bg-info/10 border-info/30">
            <Text className="text-text-secondary font-body text-xs">
              🔒 Les fonds sont séquestrés (escrow) et libérés au voyageur
              automatiquement dès que vous confirmez la livraison par code PIN.
            </Text>
          </Card>

          {alreadyLocked ? (
            <Text className="text-text-muted font-body text-sm text-center">
              Paiement déjà confirmé.
            </Text>
          ) : !data.clientSecret ? (
            <Text className="text-danger font-body text-sm text-center">
              Configuration Stripe manquante — contactez le support.
            </Text>
          ) : (
            <Button
              label={paid ? "Confirmation en cours…" : `Payer ${eur(breakdown.totalAmount)}`}
              onPress={onPay}
              loading={busy || paid}
              disabled={paid}
            />
          )}
        </View>
      ) : null}

      {!loading && !error && !breakdown ? (
        <Button label="Réessayer" variant="secondary" onPress={refresh} />
      ) : null}
    </Screen>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-text-muted font-body text-sm">{k}</Text>
      <Text className="text-text-primary font-body text-sm font-semibold">{v}</Text>
    </View>
  );
}
