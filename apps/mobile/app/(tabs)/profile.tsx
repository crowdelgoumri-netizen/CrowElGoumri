/**
 * Profile & wallet (board 05) + traveler earnings entry (board 15).
 *
 * The user's trust/KYC snapshot, a wallet card that surfaces Stripe Connect
 * onboarding status (so the traveler can get paid), and quick links to the
 * traveler's trips, KYC verification, notifications, and settings.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { Avatar } from "../../src/components/Avatar";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getConnectStatus, startConnectOnboarding } from "../../src/lib/escrow";
import { ApiError } from "../../src/lib/api";
import { KYC_LEVEL } from "../../src/lib/format";

const BADGE_EMOJI: Record<string, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { user, tokens, logout } = useAuth();
  // Guests get the sign-in wall (profile + wallet are per-account); skip
  // the Connect status call instead of eating a 401.
  const connect = useAsync(
    () =>
      tokens
        ? getConnectStatus().catch(() => null)
        : Promise.resolve(null),
    [!!tokens],
  );
  const [onboarding, setOnboarding] = useState(false);

  if (!tokens) {
    return (
      <AuthWall
        title={t("profile.guestTitle")}
        subtitle={t("profile.guestSubtitle")}
      />
    );
  }

  async function startOnboarding() {
    setOnboarding(true);
    try {
      const { url } = await startConnectOnboarding();
      // Stripe Connect onboarding is a hosted web flow — open it in the system
      // browser (in-app browser on iOS SFSafariViewController / Android Custom
      // Tabs). openBrowserAsync resolves when the user returns to the app, so
      // refresh Connect status right after to pick up payoutsEnabled.
      await WebBrowser.openBrowserAsync(url);
      connect.refresh();
    } catch (e) {
      Alert.alert(
        t("common.impossible"),
        e instanceof ApiError ? e.message : t("common.retryLater"),
      );
    } finally {
      setOnboarding(false);
    }
  }

  const kyc = user ? KYC_LEVEL[user.kycLevel as keyof typeof KYC_LEVEL] : null;
  const badge = user?.trustBadge ? BADGE_EMOJI[user.trustBadge] ?? "•" : "•";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-xl"
      >
        {/* Header */}
        <View className="flex-row items-center gap-stack-gap mt-md">
          <Avatar name={user?.firstName} size="lg" />
          <View className="flex-1">
            <Text className="text-text-primary font-heading text-2xl font-bold">
              {user?.firstName} {user?.lastName}
            </Text>
            <Text className="text-text-muted font-body text-sm">{user?.email}</Text>
            <View className="flex-row items-center gap-2 mt-1.5">
              {kyc ? <StatusPill label={t(kyc.key)} tone={kyc.tone} /> : null}
              <Text className="text-text-secondary font-body text-xs">
                {t("profile.trustScore", { badge, score: user?.trustScore ?? 0 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Activity stats */}
        <View className="flex-row justify-between mt-section-gap">
          <Stat label={t("profile.statDeliveries")} value={user?.completedDeliveries ?? 0} />
          <Stat label={t("profile.statTrips")} value={user?.completedTrips ?? 0} />
          <Stat
            label={t("profile.statRating")}
            value={user?.averageRating ? user.averageRating.toFixed(1) : "—"}
          />
        </View>

        {/* Wallet / earnings (traveler payouts) */}
        <Text className="font-mono text-meta uppercase tracking-wide text-text-secondary mt-section-gap mb-2">
          {t("profile.wallet")}
        </Text>
        <Card raised className="gap-2">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-mono text-meta text-text-secondary">{t("profile.paymentsStatus")}</Text>
              <Text className="text-text-primary font-heading text-lg font-semibold">
                {connect.data?.payoutsEnabled ? t("profile.paymentsEnabled") : t("profile.paymentsDisabled")}
              </Text>
            </View>
            <Ionicons
              name={connect.data?.payoutsEnabled ? "checkmark-circle" : "alert-circle-outline"}
              size={28}
              color={connect.data?.payoutsEnabled ? colors.successText : colors.accent}
            />
          </View>
          <Text className="text-text-muted font-body text-xs">
            {connect.data?.payoutsEnabled
              ? t("profile.paymentsEnabledHint")
              : t("profile.paymentsDisabledHint")}
          </Text>
          <Button
            label={connect.data?.payoutsEnabled ? t("profile.viewStatus") : t("profile.setupPayments")}
            variant="secondary"
            loading={onboarding}
            onPress={startOnboarding}
          />
        </Card>

        {/* Menu */}
        <Text className="font-mono text-meta uppercase tracking-wide text-text-secondary mt-section-gap mb-2">
          {t("profile.account")}
        </Text>
        <Card className="gap-1">
          <MenuRow
            icon="shield-checkmark-outline"
            label={t("profile.kyc")}
            value={kyc ? t(kyc.key) : undefined}
            onPress={() => router.push("/kyc")}
          />
          <Divider />
          <MenuRow
            icon="airplane-outline"
            label={t("profile.myTrips")}
            onPress={() => router.push("/my-trips")}
          />
          <Divider />
          <MenuRow
            icon="cube-outline"
            label={t("profile.myParcels")}
            onPress={() => router.replace("/(tabs)")}
          />
          <Divider />
          <MenuRow
            icon="notifications-outline"
            label={t("profile.notifications")}
            onPress={() => router.push("/notifications")}
          />
          <Divider />
          <MenuRow
            icon="settings-outline"
            label={t("profile.settings")}
            onPress={() => router.push("/settings")}
          />
        </Card>

        <View className="mt-section-gap">
          <Button label={t("common.logout")} variant="secondary" onPress={() => logout()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 items-center rounded-card bg-glass border border-hairline py-stack-gap">
      <Text className="text-text-primary font-heading text-numeral font-bold">{value}</Text>
      <Text className="text-text-muted font-body text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-sm active:opacity-70">
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text className="text-text-primary font-body flex-1 ml-stack-gap">{label}</Text>
      {value ? <Text className="text-text-muted font-body text-xs mr-1">{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-divider" />;
}
