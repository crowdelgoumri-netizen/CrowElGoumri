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
import { useTranslation } from "react-i18next";
import { useStripe } from "../../src/lib/stripe-compat";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { StatusPill } from "../../src/components/StatusPill";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { fund, getEscrow } from "../../src/lib/escrow";
import { eur, ESCROW_STATUS } from "../../src/lib/format";
import type { EscrowStatus } from "../../src/lib/types";

export default function EscrowScreen() {
  const { t } = useTranslation();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh } = useAsync(
    // Funding is a mutation — guests never fire it, they get the wall.
    () => (tokens ? fund(parcelId) : Promise.resolve(null)),
    [parcelId, !!tokens],
  );
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);

  // Escrow involves the sender's payment — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("escrow.title")} />;
  }

  const breakdown = data?.breakdown;
  const st = data ? ESCROW_STATUS[data.status] : null;

  const alreadyLocked = data?.status === "LOCKED" || data?.status === "RELEASED";

  async function onPay() {
    if (!data?.clientSecret) {
      Alert.alert(t("escrow.errorTitle"), t("escrow.prepareError"));
      return;
    }

    setBusy(true);
    try {
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: "DiasporaCart",
        paymentIntentClientSecret: data.clientSecret,
      });

      if (initErr) {
        Alert.alert(t("escrow.payment"), initErr.message);
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
        Alert.alert(t("escrow.payFailed"), payErr.message, [
          { text: t("common.retry"), onPress: () => onPay() },
          { text: t("escrow.later"), style: "cancel" },
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
      Alert.alert(t("escrow.payment"), e instanceof Error ? e.message : t("escrow.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("escrow.title")} subtitle={t("escrow.subtitle")} />

      {loading ? (
        <Text className="text-text-muted">{t("escrow.preparing")}</Text>
      ) : null}

      {error ? (
        <View className="gap-stack-gap">
          <Text className="text-danger">{error}</Text>
          {error.includes("must be MATCHED") ? (
            <Text className="text-text-muted font-body text-sm">
              {t("escrow.mustBeMatched")}
            </Text>
          ) : null}
          <Button label={t("postParcel.back")} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : null}

      {breakdown ? (
        <View className="gap-stack-gap">
          {st ? <StatusPill label={t(st.key)} tone={st.tone} /> : null}

          <Card className="gap-2">
            <Text className="font-mono text-meta uppercase text-text-secondary">{t("escrow.details")}</Text>
            <Line k={t("escrow.travelerPayout")} v={eur(breakdown.travelerPayout)} />
            <Line k={t("escrow.platformFee")} v={eur(breakdown.platformFee)} />
            {breakdown.insuranceFee > 0 ? (
              <Line k={t("escrow.insurance")} v={eur(breakdown.insuranceFee)} />
            ) : null}
            <View className="h-px bg-divider my-1" />
            <View className="flex-row justify-between items-center">
              <Text className="text-text-primary font-heading text-lg font-bold">{t("escrow.total")}</Text>
              <Text className="text-accent font-heading text-numeral font-bold">
                {eur(breakdown.totalAmount)}
              </Text>
            </View>
          </Card>

          {breakdown.discountPct > 0 ? (
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-body text-xs font-semibold">
                {t("escrow.referralDiscountApplied", { pct: breakdown.discountPct })}
              </Text>
            </Card>
          ) : null}

          <Card className="bg-info/10 border-info/30">
            <Text className="text-text-secondary font-body text-xs">
              {t("escrow.escrowHint")}
            </Text>
          </Card>

          {alreadyLocked ? (
            <Text className="text-text-muted font-body text-sm text-center">
              {t("escrow.alreadyPaid")}
            </Text>
          ) : !data.clientSecret ? (
            <Text className="text-danger font-body text-sm text-center">
              {t("escrow.stripeMissing")}
            </Text>
          ) : (
            <Button
              label={paid ? t("escrow.confirming") : t("escrow.pay", { amount: eur(breakdown.totalAmount) })}
              onPress={onPay}
              loading={busy || paid}
              disabled={paid}
            />
          )}
        </View>
      ) : null}

      {!loading && !error && !breakdown ? (
        <Button label={t("common.retry")} variant="secondary" onPress={refresh} />
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
