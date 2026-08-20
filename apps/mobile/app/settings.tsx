/**
 * Settings (board 18) — account preferences + danger zone.
 *
 * Push notification toggle, help/guide (onboarding), appearance (theme mode)
 * + language selectors, and logout. Payment methods still need a saved-card
 * API.
 */
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useTheme, type ThemeMode } from "../src/store/theme";
import { useLang, type Lang } from "../src/store/lang";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { isPushEnabled, registerForPush, setPushEnabled } from "../src/lib/push";
import { useTranslation } from "react-i18next";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { user, tokens, logout } = useAuth();
  const { t } = useTranslation();
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const [pushOn, setPushOn] = useState(true);
  const modeOptions: { value: ThemeMode; label: string }[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "dark", label: t("settings.themeDark") },
    { value: "bright", label: t("settings.themeBright") },
  ];
  // Native names — each language shown in itself (iOS convention).
  const langOptions: { value: Lang; label: string }[] = [
    { value: "fr", label: "Français" },
    { value: "en", label: "English" },
  ];

  useEffect(() => {
    isPushEnabled().then(setPushOn);
  }, []);

  // Settings manage an account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle={t("settings.title")} />;
  }

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

      <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">{t("settings.preferences")}</Text>
      <Card className="gap-1">
        <View className="flex-row items-center py-card-padding">
          <Ionicons name="notifications" size={20} color={colors.accent} />
          <Text className="text-text-primary font-body flex-1 ml-stack-gap">{t("settings.pushNotifications")}</Text>
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            trackColor={{ false: colors.chipBg, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Divider />
        <PressableRow icon="help-circle-outline" label={t("settings.howItWorks")} onPress={() => router.push("/onboarding")} />
      </Card>

      <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">{t("settings.appearance")}</Text>
      <View className="flex-row bg-glass rounded-chip p-1 gap-1">
        {modeOptions.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setThemeMode(opt.value)}
            className={
              "flex-1 items-center py-2.5 rounded-chip " +
              (themeMode === opt.value ? "bg-accent" : "bg-transparent")
            }
          >
            <Text
              className={
                "font-body font-semibold text-sm " +
                (themeMode === opt.value ? "text-accent-on" : "text-text-muted")
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">{t("settings.language")}</Text>
      <View className="flex-row bg-glass rounded-chip p-1 gap-1">
        {langOptions.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setLang(opt.value)}
            className={
              "flex-1 items-center py-2.5 rounded-chip " +
              (lang === opt.value ? "bg-accent" : "bg-transparent")
            }
          >
            <Text
              className={
                "font-body font-semibold text-sm " +
                (lang === opt.value ? "text-accent-on" : "text-text-muted")
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">{t("settings.about")}</Text>
      <Card>
        <Text className="text-text-primary font-heading font-bold">{t("settings.appName")}</Text>
        <Text className="text-text-muted font-body text-xs mt-1">
          {t("settings.aboutTagline")}
        </Text>
      </Card>

      <View className="mt-section-gap">
        <Button label={t("common.logout")} variant="secondary" onPress={() => logout()} />
      </View>
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center py-card-padding">
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text className="text-text-primary font-body flex-1 ml-stack-gap">{label}</Text>
      {value ? <Text className="text-text-muted font-body text-xs">{value}</Text> : null}
    </View>
  );
}

function PressableRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-card-padding active:opacity-70">
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text className="text-text-primary font-body flex-1 ml-stack-gap">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-divider" />;
}
