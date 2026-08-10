/**
 * Settings (board 18) — account preferences + danger zone.
 *
 * Push re-registration, help/guide (onboarding), report an issue, and logout.
 * Lightweight on purpose: real preferences (language, notifications granular
 * controls) land with a settings subsystem phase.
 */
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { useAuth } from "../src/store/auth";
import { registerForPush } from "../src/lib/push";
import { BASE_URL } from "../src/lib/api";

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  async function reRegisterPush() {
    const token = await registerForPush();
    Alert.alert(
      "Notifications",
      token ? "Ce périphérique est enregistré pour les notifications." : "Inscription impossible (simulateur ou permission refusée).",
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Paramètres" />

      <Card className="gap-1">
        <Row icon="information-circle-outline" label="Compte" value={user?.email} />
        <Divider />
        <Row icon="server-outline" label="Serveur API" value={BASE_URL.replace(/^https?:\/\//, "")} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">Préférences</Text>
      <Card className="gap-1">
        <PressableRow icon="notifications" label="Réactiver les notifications" onPress={reRegisterPush} />
        <Divider />
        <PressableRow icon="help-circle-outline" label="Comment ça marche" onPress={() => router.push("/onboarding")} />
        <Divider />
        <PressableRow icon="flag-outline" label="Signaler un problème" onPress={() => router.push("/report")} />
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
