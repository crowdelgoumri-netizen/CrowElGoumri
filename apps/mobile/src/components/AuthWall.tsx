/**
 * AuthWall — login prompt shown when a guest reaches a screen that needs
 * an account (posting, matching, chat, escrow…). Guests can browse the
 * marketplace freely; this wall converts them at the moment of action.
 */
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "./Screen";
import { ScreenHeader } from "./ScreenHeader";
import { Button } from "./Button";
import { useThemeColors } from "../hooks/useThemeColors";

interface AuthWallProps {
  /** Header bar title for pushed screens (adds a back button). Omit inside tabs. */
  headerTitle?: string;
  title?: string;
  subtitle?: string;
}

export function AuthWall({ headerTitle, title, subtitle }: AuthWallProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      {headerTitle ? <ScreenHeader title={headerTitle} /> : null}
      <View className="flex-1 items-center justify-center px-lg">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-glass border border-hairline mb-section-gap">
          <Ionicons name="person-circle-outline" size={44} color={colors.accent} />
        </View>
        <Text className="text-text-primary font-heading text-2xl font-bold text-center">
          {title ?? t("authWall.title")}
        </Text>
        <Text className="text-text-muted font-body text-base text-center mt-2 max-w-[300px]">
          {subtitle ?? t("authWall.subtitle")}
        </Text>
        <View className="gap-stack-gap mt-section-gap w-full max-w-[300px]">
          <Button label={t("common.login")} onPress={() => router.push("/auth/login")} />
          <Button
            label={t("common.signup")}
            variant="secondary"
            onPress={() => router.push("/auth/signup")}
          />
        </View>
      </View>
    </Screen>
  );
}
