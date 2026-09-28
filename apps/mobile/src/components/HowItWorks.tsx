/**
 * HowItWorks — Home screen's static "Comment ça marche ?" 4-step explainer.
 *
 * Rendered as 4 equal columns rather than a literal dotted connector line
 * (no extra SVG plumbing needed to convey the same left-to-right sequence).
 */
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../hooks/useThemeColors";

const STEPS = [
  { icon: "airplane-outline", titleKey: "home.howItWorks.step1Title", bodyKey: "home.howItWorks.step1Body" },
  { icon: "cube-outline", titleKey: "home.howItWorks.step2Title", bodyKey: "home.howItWorks.step2Body" },
  { icon: "locate-outline", titleKey: "home.howItWorks.step3Title", bodyKey: "home.howItWorks.step3Body" },
  { icon: "heart-outline", titleKey: "home.howItWorks.step4Title", bodyKey: "home.howItWorks.step4Body" },
] as const;

export function HowItWorks() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="mt-section-gap">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary font-heading font-bold text-base">
          {t("home.howItWorks.title")}
        </Text>
        <Pressable onPress={() => router.push("/onboarding")}>
          <Text className="text-accent font-heading text-xs font-bold">
            {t("home.howItWorks.seeMore")}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row justify-between mt-3">
        {STEPS.map((step) => (
          <View key={step.titleKey} className="items-center" style={{ width: "23%" }}>
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/12 border border-accent/20">
              <Ionicons name={step.icon} size={18} color={colors.accent} />
            </View>
            <Text className="font-heading font-bold text-text-primary text-[11px] text-center mt-1.5 leading-4">
              {t(step.titleKey)}
            </Text>
            <Text className="font-body text-text-muted text-[10px] text-center mt-0.5 leading-3.5">
              {t(step.bodyKey)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
