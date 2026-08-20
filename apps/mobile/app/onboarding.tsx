/**
 * Onboarding / guide (board 01) — a lightweight "how it works" walkthrough.
 *
 * Reachable from Settings. Three steps mirroring the marketplace loop:
 * envoyez → matchez → payez & suivez. Kept deliberately simple (no first-run
 * gate logic); it doubles as an in-app guide.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { Button } from "../src/components/Button";
import { useThemeColors } from "../src/hooks/useThemeColors";

const STEPS = [
  {
    icon: "cube-outline" as const,
    titleKey: "onboarding.step1Title",
    bodyKey: "onboarding.step1Body",
  },
  {
    icon: "people-outline" as const,
    titleKey: "onboarding.step2Title",
    bodyKey: "onboarding.step2Body",
  },
  {
    icon: "shield-checkmark-outline" as const,
    titleKey: "onboarding.step3Title",
    bodyKey: "onboarding.step3Body",
  },
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center">
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-glass border border-hairline mb-section-gap">
            <Ionicons name={step.icon} size={44} color={colors.accent} />
          </View>
          <Text className="text-text-primary font-heading text-2xl font-bold text-center">
            {t(step.titleKey)}
          </Text>
          <Text className="text-text-muted font-body text-base text-center mt-2 max-w-[300px]">
            {t(step.bodyKey)}
          </Text>
        </View>

        <View className="flex-row justify-center gap-2 mt-section-gap">
          {STEPS.map((_, idx) => (
            <View
              key={idx}
              className={
                "h-2 rounded-full " +
                (idx === i ? "w-6 bg-accent" : "w-2 bg-glass")
              }
            />
          ))}
        </View>
      </View>

      <View className="flex-row gap-stack-gap">
        {i > 0 ? (
          <View className="flex-1">
            <Button label={t("onboarding.prev")} variant="secondary" onPress={() => setI((x) => x - 1)} />
          </View>
        ) : null}
        <View className="flex-1">
          {last ? (
            <Button label={t("onboarding.start")} onPress={() => router.replace("/(tabs)")} />
          ) : (
            <Button label={t("onboarding.next")} onPress={() => setI((x) => x + 1)} />
          )}
        </View>
      </View>

      <Pressable onPress={() => router.back()} className="items-center mt-section-gap">
        <Text className="text-text-muted font-body text-sm">{t("onboarding.skip")}</Text>
      </Pressable>
    </Screen>
  );
}
