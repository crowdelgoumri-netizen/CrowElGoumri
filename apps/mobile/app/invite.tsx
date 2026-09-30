/**
 * Invite friends — shows the user's personal referral code, a native share
 * action, and the status of everyone they've referred so far.
 */
import { useEffect, useState } from "react";
import { Share, Text, View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { getMyReferrals, type MyReferrals } from "../src/lib/referrals";

export default function InviteScreen() {
  const { t } = useTranslation();
  const { tokens } = useAuth();
  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    getMyReferrals()
      .then(setData)
      .finally(() => setLoading(false));
  }, [tokens]);

  if (!tokens) {
    return <AuthWall headerTitle={t("invite.title")} />;
  }

  async function onShare() {
    if (!data) return;
    await Share.share({
      message: t("invite.shareMessage", { code: data.referralCode }),
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t("invite.title")} />

      {loading || !data ? (
        <ActivityIndicator />
      ) : (
        <>
          <Card className="items-center gap-stack-gap">
            <Text className="text-text-muted font-body">{t("invite.yourCode")}</Text>
            <Text className="text-text-primary font-heading text-screen-title font-bold tracking-widest">
              {data.referralCode}
            </Text>
            <Button label={t("invite.shareButton")} onPress={onShare} />
          </Card>

          <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">
            {t("invite.yourReferrals")}
          </Text>
          {data.referrals.length === 0 ? (
            <Text className="text-text-muted font-body">{t("invite.noReferralsYet")}</Text>
          ) : (
            <Card className="gap-1">
              {data.referrals.map((r, i) => (
                <View key={i} className="flex-row justify-between py-card-padding">
                  <Text className="text-text-primary font-body">{r.refereeFirstName}</Text>
                  <Text className="text-text-muted font-body">
                    {r.status === "REWARDED" ? t("invite.statusRewarded") : t("invite.statusPending")}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
