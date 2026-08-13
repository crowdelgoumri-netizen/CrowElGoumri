/**
 * Settings (board 18) — account preferences + danger zone.
 *
 * Push notification toggle, help/guide (onboarding), and logout.
 * i18n is wired (this screen is migrated via useTranslation); the language
 * selector lands once broader coverage exists (no fake button — see
 * docs/superpowers/specs/2026-08-11-settings-push-toggle-design.md). Payment
 * methods still need a saved-card API.
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
import { useTranslation } from "react-i18next";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
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
        Alert.alert(t("settings.pushAlertTitle"), t("settings.pushAlertBody"));
      }
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("settings.title")} />

      <Card className="gap-1">
        <Row icon="information-circle-outline" label={t("settings.account")} value={user?.email} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">{t("settings.preferences")}</Text>
      <Card className="gap-1">
        <View className="flex-row items-center py-sm">
          <Ionicons name="notifications" size={20} color="#FF6A2B" />
          <Text className="text-white font-body flex-1 ml-md">{t("settings.pushNotifications")}</Text>
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            trackColor={{ false: "#16213B", true: "#FF6A2B" }}
            thumbColor="#F5F7FA"
          />
        </View>
        <Divider />
        <PressableRow icon="help-circle-outline" label={t("settings.howItWorks")} onPress={() => router.push("/onboarding")} />
      </Card>

      <Text className="text-mist/60 text-xs font-body uppercase mt-lg mb-2">{t("settings.about")}</Text>
      <Card>
        <Text className="text-white font-heading font-bold">{t("settings.appName")}</Text>
        <Text className="text-muted font-body text-xs mt-1">
          {t("settings.aboutTagline")}
        </Text>
      </Card>

      <View className="mt-lg">
        <Button label={t("settings.logout")} variant="secondary" onPress={() => logout()} />
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
