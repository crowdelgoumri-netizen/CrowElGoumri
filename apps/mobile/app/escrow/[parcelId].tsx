/**
 * Escrow checkout (board 10) — fund the escrow and (in real builds) confirm
 * the card payment.
 *
 * POST /escrow/:id/fund returns a Stripe PaymentIntent clientSecret + the EUR
 * breakdown (traveler payout, platform fee, insurance). The actual card
 * confirmation needs @stripe/stripe-react-native (a dev build, not Expo Go),
 * so on the Expo Go path we show the full breakdown + escrow state and gate
 * the final "Pay" step behind a clear note. The clientSecret is captured so
 * the moment dev builds are adopted, flipping in Stripe.confirmCardPayment is
 * the only change.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { StatusPill } from "../../src/components/StatusPill";
import { useAsync } from "../../src/hooks/useAsync";
import { fund } from "../../src/lib/escrow";
import { eur, ESCROW_STATUS } from "../../src/lib/format";

export default function EscrowScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const { data, loading, error, refresh } = useAsync(
    () => fund(parcelId),
    [parcelId],
  );
  const [paid, setPaid] = useState(false);

  const breakdown = data?.breakdown;
  const st = data ? ESCROW_STATUS[data.status] : null;

  function onPay() {
    // Card confirmation needs @stripe/stripe-react-native (dev build). On Expo
    // Go we surface this honestly — the escrow + clientSecret are ready.
    Alert.alert(
      "Paiement",
      "Le règlement par carte dans l'app nécessite le module Stripe (build de développement).\n\n" +
        "L'escrow est prêt : " +
        (data?.escrowId ? `n°${data.escrowId.slice(-6)}` : "") +
        (data?.clientSecret ? "\nclientSecret ✓" : "") +
        "\n\nEn build de dev, l'étape finale appelle Stripe.confirmCardPayment(clientSecret).",
      [{ text: "OK" }],
    );
    setPaid(true);
  }

  return (
    <Screen>
      <ScreenHeader title="Paiement sécurisé" subtitle="Fonds bloqués jusqu'à la livraison" />

      {loading ? (
        <Text className="text-muted">Préparation du paiement…</Text>
      ) : null}

      {error ? (
        <View className="gap-md">
          <Text className="text-danger">{error}</Text>
          {error.includes("must be MATCHED") ? (
            <Text className="text-muted font-body text-sm">
              Le colis doit d'abord être accepté par un voyageur pour pouvoir payer.
            </Text>
          ) : null}
          <Button label="Retour" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : null}

      {breakdown ? (
        <View className="gap-md">
          {st ? <StatusPill label={st.label} tone={st.tone} /> : null}

          <Card className="gap-2">
            <Text className="text-mist/70 text-xs font-body uppercase">Détail du paiement</Text>
            <Line k="Montant voyageur" v={eur(breakdown.travelerPayout)} />
            <Line k="Frais de plateforme" v={eur(breakdown.platformFee)} />
            {breakdown.insuranceFee > 0 ? (
              <Line k="Assurance" v={eur(breakdown.insuranceFee)} />
            ) : null}
            <View className="h-px bg-line my-1" />
            <View className="flex-row justify-between items-center">
              <Text className="text-white font-heading text-lg font-bold">Total bloqué</Text>
              <Text className="text-accent font-heading text-2xl font-bold">
                {eur(breakdown.totalAmount)}
              </Text>
            </View>
          </Card>

          <Card className="bg-violet/10 border-violet/30">
            <Text className="text-mist font-body text-xs">
              🔒 Les fonds sont séquestrés (escrow) et libérés au voyageur
              automatiquement dès que vous confirmez la livraison par code PIN.
            </Text>
          </Card>

          <Button
            label={paid ? "En attente de confirmation" : `Payer ${eur(breakdown.totalAmount)}`}
            onPress={onPay}
            loading={loading}
          />
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
      <Text className="text-muted font-body text-sm">{k}</Text>
      <Text className="text-white font-body text-sm font-semibold">{v}</Text>
    </View>
  );
}
