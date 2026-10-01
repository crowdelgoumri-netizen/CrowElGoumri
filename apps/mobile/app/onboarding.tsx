/**
 * Onboarding / guide (boards 01+11) — Welcome → Suitcase → Traveler.
 *
 * Reachable from Settings; also doubles as an in-app guide (no first-run
 * gate logic). Three full-bleed brand screens mirroring the design
 * system's WelcomeScreen / OnboardingSuitcaseScreen / OnboardingTravelerScreen:
 * trust stats + handwritten tagline on Welcome, an emotional "bout de chez
 * soi" hook with a framed photo on Suitcase, and the three traveler pillars
 * (Simple/Sécurisé/Communautaire) on Traveler.
 */
import { useState } from "react";
import { router } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { Button } from "../src/components/Button";
import { useThemeColors } from "../src/hooks/useThemeColors";
import heroAlgiers from "../assets/hero-algiers.jpg";
import planeWindow from "../assets/plane-window.jpg";

const STATS = [
  { valueKey: "home.heroBanner.statTravelersValue", labelKey: "home.heroBanner.statTravelersLabel" },
  { valueKey: "home.heroBanner.statParcelsValue", labelKey: "home.heroBanner.statParcelsLabel" },
  { valueKey: "home.heroBanner.statRatingValue", labelKey: "home.heroBanner.statRatingLabel" },
] as const;

const PILLARS = [
  { icon: "sparkles-outline" as const, titleKey: "onboarding.pillarSimpleTitle", bodyKey: "onboarding.pillarSimpleBody" },
  { icon: "shield-checkmark-outline" as const, titleKey: "onboarding.pillarSecureTitle", bodyKey: "onboarding.pillarSecureBody" },
  { icon: "people-outline" as const, titleKey: "onboarding.pillarCommunityTitle", bodyKey: "onboarding.pillarCommunityBody" },
];

const PAGE_COUNT = 3;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const last = i === PAGE_COUNT - 1;

  function next() {
    if (last) router.replace("/(tabs)");
    else setI((x) => x + 1);
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        {i === 0 ? <WelcomePage /> : i === 1 ? <SuitcasePage /> : <TravelerPage />}

        {/* Dots */}
        <View className="flex-row justify-center gap-2 py-section-gap">
          {Array.from({ length: PAGE_COUNT }).map((_, idx) => (
            <View
              key={idx}
              className={
                "h-2 rounded-full " +
                (idx === i ? "w-6 bg-accent" : "w-2 bg-chip-bg border border-chip-border")
              }
            />
          ))}
        </View>

        {/* Nav */}
        <View className="px-screen-edge pb-section-gap gap-stack-gap">
          <View className="flex-row gap-stack-gap">
            {i > 0 ? (
              <View className="flex-1">
                <Button label={t("onboarding.prev")} variant="secondary" onPress={() => setI((x) => x - 1)} />
              </View>
            ) : null}
            <View className="flex-1">
              <Button label={last ? t("onboarding.start") : t("onboarding.next")} onPress={next} />
            </View>
          </View>
          <Pressable onPress={() => router.back()} className="items-center">
            <Text className="text-text-muted font-body text-sm">{t("onboarding.skip")}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function WelcomePage() {
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <ImageBackground source={heroAlgiers} resizeMode="cover" style={{ flex: 1 }}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.92)"]}
          locations={[0, 0.5, 0.85]}
          style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 8 }}
        >
          <Text className="font-heading text-2xl font-extrabold">
            <Text className="text-text-primary">Diaspora</Text>
            <Text className="text-accent">Cart</Text>
          </Text>
          <Text className="text-text-primary font-heading text-xl font-bold leading-6 mt-2">
            {t("home.heroBanner.tagline")}
          </Text>
          <Text
            className="text-accent font-script text-lg mt-2"
            style={{ transform: [{ rotate: "-2deg" }] }}
          >
            {t("home.heroBanner.quote")}
          </Text>

          <View className="flex-row mt-section-gap bg-glass-raised rounded-card border border-hairline-raised p-card-padding">
            {STATS.map((s, idx) => (
              <View
                key={s.valueKey}
                className={"flex-1 items-center gap-0.5" + (idx > 0 ? " border-l border-hairline" : "")}
              >
                <Text className="font-heading font-bold text-text-primary text-sm">{t(s.valueKey)}</Text>
                <Text className="font-body text-text-muted text-[10px] text-center">{t(s.labelKey)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

function SuitcasePage() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-screen-edge">
      <View
        className="overflow-hidden"
        style={{
          width: 180,
          height: 180,
          borderRadius: 90,
          borderWidth: 3,
          borderColor: colors.accent,
        }}
      >
        <ImageBackground source={planeWindow} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      </View>

      <Text className="font-heading text-xl font-bold text-text-primary text-center mt-section-gap">
        {t("onboarding.suitcaseTitle")}
      </Text>
      <Text className="font-body text-text-muted text-sm text-center mt-2 max-w-[300px] leading-5">
        {t("onboarding.suitcaseBody")}
      </Text>
      <Text
        className="text-accent font-script text-lg mt-3"
        style={{ transform: [{ rotate: "-2deg" }] }}
      >
        {t("home.heroBanner.quote")}
      </Text>
    </View>
  );
}

function TravelerPage() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <ImageBackground source={planeWindow} resizeMode="cover" style={{ flex: 1 }}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.95)"]}
          locations={[0, 0.45, 0.8]}
          style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 8 }}
        >
          <Text className="text-text-primary font-heading text-xl font-bold leading-6">
            {t("onboarding.travelerTitle")}
          </Text>

          <View className="gap-2.5 mt-section-gap">
            {PILLARS.map((p) => (
              <View key={p.titleKey} className="flex-row items-start gap-3 bg-glass-raised rounded-field border border-hairline-raised p-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-accent/15">
                  <Ionicons name={p.icon} size={17} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text className="font-heading font-bold text-text-primary text-sm">{t(p.titleKey)}</Text>
                  <Text className="font-body text-text-muted text-xs mt-0.5 leading-4">{t(p.bodyKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
