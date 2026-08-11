/**
 * Settings (board 18) — account preferences + danger zone.
 *
 * Push notification toggle, help/guide (onboarding), and logout.
 * Lightweight on purpose: payment methods and a language selector aren't
 * buildable yet (no saved-card API, no i18n infrastructure) — see
 * docs/superpowers/specs/2026-08-11-settings-push-toggle-design.md.
 */
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { useAuth } from "../src/store/auth";
import { isPushEnabled, registerForPush, setPushEnabled } from "../src/lib/push";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    isPushEnabled().then(setPushOn);
  }, []);

  async function onTogglePush(next: boolean) {
    setPushOn(next);
    await setPushEnabled(next);
    if (next) {
      const token = await registerForPush();
      if (!token) {
        Alert.alert(
          "Notifications",
          "Inscription impossible (simulateur ou permission refusée).",
        );
      }
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Paramètres" />

      <Card className="gap-1">
        <Row icon="information-circle-outline" label="Compte" value={user?.email} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">Préférences</Text>
      <Card className="gap-1">
        <View className="flex-row items-center py-sm">
          <Ionicons name="notifications" size={20} color="#FF6A2B" />
          <Text className="text-white font-body flex-1 ml-md">Notifications push</Text>
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            trackColor={{ false: "#16213B", true: "#FF6A2B" }}
            thumbColor="#F5F7FA"
          />
        </View>
        <Divider />
        <PressableRow icon="help-circle-outline" label="Comment ça marche" onPress={() => router.push("/onboarding")} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">À propos</Text>
      <Card>
        <Text className="text-white font-heading font-bold">CrowdShipping</Text>
        <Text className="text-muted font-body text-xs mt-1">
          Marketplace de livraison entre particuliers · Europe → Algérie. v0.1
        </Text>
      </Card>

      <View className="mt-lg">
        <Button label="Se déconnecter" variant="secondary" onPress={() => logout()} />
      </View>
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View className="flex-row items-center py-sm">
      <Ionicons name={icon} size={20} color="#FF6A2B" />
      <Text className="text-white font-body flex-1 ml-md">{label}</Text>
      {value ? <Text className="text-muted font-body text-xs">{value}</Text> : null}
    </View>
  );
}

function PressableRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-sm active:opacity-70">
      <Ionicons name={icon} size={20} color="#FF6A2B" />
      <Text className="text-white font-body flex-1 ml-md">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#8A94A6" />
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-line" />;
}
