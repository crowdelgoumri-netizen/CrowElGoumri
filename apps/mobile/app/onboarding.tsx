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
import { Screen } from "../src/components/Screen";
import { Button } from "../src/components/Button";
import { useThemeColors } from "../src/hooks/useThemeColors";

const STEPS = [
  {
    icon: "cube-outline" as const,
    title: "Envoyez votre colis",
    body: "Décrivez ce que vous voulez envoyer, l'origine en Europe et la wilaya de destination. Fixez votre prix ou laissez les voyageurs proposer.",
  },
  {
    icon: "people-outline" as const,
    title: "Trouvez un voyageur",
    body: "Notre moteur classe les voyageurs de confiance pour votre corridor. Dès qu'un voyageur accepte, vous êtes notifié.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Payez en toute sécurité",
    body: "Le paiement est bloqué en escrow et libéré au voyageur à la livraison, confirmée par un code à 6 chiffres.",
  },
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
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
            {step.title}
          </Text>
          <Text className="text-text-muted font-body text-base text-center mt-2 max-w-[300px]">
            {step.body}
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
            <Button label="Précédent" variant="secondary" onPress={() => setI((x) => x - 1)} />
          </View>
        ) : null}
        <View className="flex-1">
          {last ? (
            <Button label="Commencer" onPress={() => router.replace("/(tabs)")} />
          ) : (
            <Button label="Suivant" onPress={() => setI((x) => x + 1)} />
          )}
        </View>
      </View>

      <Pressable onPress={() => router.back()} className="items-center mt-section-gap">
        <Text className="text-text-muted font-body text-sm">Passer</Text>
      </Pressable>
    </Screen>
  );
}
