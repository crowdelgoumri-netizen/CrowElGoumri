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
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { Avatar } from "../../src/components/Avatar";
import { StatusPill } from "../../src/components/StatusPill";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
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
  const { user, logout } = useAuth();
  const connect = useAsync(() => getConnectStatus().catch(() => null), []);
  const [onboarding, setOnboarding] = useState(false);

  async function startOnboarding() {
    setOnboarding(true);
    try {
      const { url } = await startConnectOnboarding();
      // Stripe Connect onboarding is a hosted web flow. In-app we'd open it via
      // WebBrowser; here we surface the URL so the dev can open it. A native
      // WebBrowser.openBrowserAsync lands with the auth-browser phase.
      Alert.alert(
        "Onboarding Stripe",
        "Ouvrez ce lien dans votre navigateur pour compléter l'onboarding :\n\n" + url,
      );
      connect.refresh();
    } catch (e) {
      Alert.alert(
        "Impossible",
        e instanceof ApiError ? e.message : "Réessayez plus tard.",
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
        <View className="flex-row items-center gap-md mt-md">
          <Avatar name={user?.firstName} size="lg" />
          <View className="flex-1">
            <Text className="text-white font-heading text-2xl font-bold">
              {user?.firstName} {user?.lastName}
            </Text>
            <Text className="text-muted font-body text-sm">{user?.email}</Text>
            <View className="flex-row items-center gap-2 mt-1.5">
              {kyc ? <StatusPill label={kyc.label} tone={kyc.tone} /> : null}
              <Text className="text-mist font-body text-xs">
                {badge} Score {user?.trustScore ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Activity stats */}
        <View className="flex-row justify-between mt-lg">
          <Stat label="Livraisons" value={user?.completedDeliveries ?? 0} />
          <Stat label="Trajets" value={user?.completedTrips ?? 0} />
          <Stat
            label="Note"
            value={user?.averageRating ? user.averageRating.toFixed(1) : "—"}
          />
        </View>

        {/* Wallet / earnings (traveler payouts) */}
        <Text className="text-mist/60 text-xs font-body uppercase tracking-wide mt-xl mb-2">
          Portefeuille
        </Text>
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-mist/70 text-xs font-body">Statut paiements</Text>
              <Text className="text-white font-heading text-lg font-semibold">
                {connect.data?.payoutsEnabled ? "Activé" : "Non configuré"}
              </Text>
            </View>
            <Ionicons
              name={connect.data?.payoutsEnabled ? "checkmark-circle" : "alert-circle-outline"}
              size={28}
              color={connect.data?.payoutsEnabled ? "#22C55E" : "#FF6A2B"}
            />
          </View>
          <Text className="text-muted font-body text-xs">
            {connect.data?.payoutsEnabled
              ? "Vos gains seront versés automatiquement à chaque livraison confirmée."
              : "Complétez l'onboarding Stripe pour recevoir vos paiements."}
          </Text>
          <Button
            label={connect.data?.payoutsEnabled ? "Voir le statut" : "Configurer mes paiements"}
            variant="secondary"
            loading={onboarding}
            onPress={startOnboarding}
          />
        </Card>

        {/* Menu */}
        <Text className="text-mist/60 text-xs font-body uppercase tracking-wide mt-xl mb-2">
          Compte
        </Text>
        <Card className="gap-1">
          <MenuRow
            icon="shield-checkmark-outline"
            label="Vérification d'identité"
            value={kyc?.label}
            onPress={() => router.push("/kyc")}
          />
          <Divider />
          <MenuRow
            icon="airplane-outline"
            label="Mes trajets"
            onPress={() => router.push("/my-trips")}
          />
          <Divider />
          <MenuRow
            icon="cube-outline"
            label="Mes colis"
            onPress={() => router.replace("/(tabs)")}
          />
          <Divider />
          <MenuRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />
          <Divider />
          <MenuRow
            icon="settings-outline"
            label="Paramètres"
            onPress={() => router.push("/settings")}
          />
        </Card>

        <View className="mt-lg">
          <Button label="Se déconnecter" variant="secondary" onPress={() => logout()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 items-center rounded-card bg-navySoft/60 border border-line py-md">
      <Text className="text-white font-heading text-xl font-bold">{value}</Text>
      <Text className="text-muted font-body text-xs mt-0.5">{label}</Text>
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
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-sm active:opacity-70">
      <Ionicons name={icon} size={20} color="#FF6A2B" />
      <Text className="text-white font-body flex-1 ml-md">{label}</Text>
      {value ? <Text className="text-muted font-body text-xs mr-1">{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color="#8A94A6" />
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-line" />;
}
