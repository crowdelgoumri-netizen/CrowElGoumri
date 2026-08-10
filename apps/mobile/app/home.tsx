/**
 * Home — the de-risk screen.
 *
 * Renders the authenticated user's profile pulled from GET /me. If this
 * screen shows real data from the backend, the whole mobile ↔ API ↔
 * Postgres loop is proven. Everything else in Phase 10 builds on this.
 *
 * Phase 10 turns this into the actual browse/trip marketplace; for now it's
 * a session sanity check + logout affordance.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/store/auth";

const BADGE_EMOJI: Record<string, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

export default function HomeScreen() {
  const { user, refreshUser, logout, tokens } = useAuth();
  const [loading, setLoading] = useState(!user);

  // If the session exists but the user wasn't cached (e.g. straight from
  // login), pull the profile now.
  useEffect(() => {
    if (!user && tokens) {
      refreshUser()
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, tokens, refreshUser]);

  if (loading || !user) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6A2B" />
        </View>
      </Screen>
    );
  }

  const badge = user.trustBadge ? BADGE_EMOJI[user.trustBadge] ?? "•" : "•";

  return (
    <Screen>
      <View className="mt-xl">
        <Text className="text-white font-heading text-3xl font-bold">
          Bienvenue, {user.firstName} 👋
        </Text>
        <Text className="text-muted font-body text-base mt-1">
          Europe → Algérie · prêt à envoyer ou transporter.
        </Text>
      </View>

      <View className="mt-xl gap-md">
        <Card>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-mist/60 text-xs font-body">Niveau KYC</Text>
              <Text className="text-white font-heading text-lg font-semibold">
                {user.kycLevel === "NONE" ? "Non vérifié" : user.kycLevel}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-mist/60 text-xs font-body">Score confiance</Text>
              <Text className="text-white font-heading text-lg font-semibold">
                {badge} {user.trustScore}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text className="text-mist/60 text-xs font-body mb-1">Contact</Text>
          <Text className="text-white font-body text-base">{user.email}</Text>
          <Text className="text-white font-body text-base">{user.phone}</Text>
        </Card>

        <Card>
          <Text className="text-mist/60 text-xs font-body mb-2">Activité</Text>
          <View className="flex-row justify-between">
            <Stat label="Livraisons" value={user.completedDeliveries} />
            <Stat label="Trajets" value={user.completedTrips} />
            <Stat
              label="Note"
              value={user.averageRating ? user.averageRating.toFixed(1) : "—"}
            />
          </View>
        </Card>

        <View className="mt-lg">
          <Button
            label="Se déconnecter"
            variant="secondary"
            onPress={() => logout()}
          />
        </View>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="items-center">
      <Text className="text-white font-heading text-xl font-bold">{value}</Text>
      <Text className="text-muted font-body text-xs mt-1">{label}</Text>
    </View>
  );
}
