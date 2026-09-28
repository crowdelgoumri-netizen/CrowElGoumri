/**
 * PromoCards — two side-by-side Home screen promo tiles: a community
 * illustration card and a photo card inviting the viewer to post a trip.
 */
import { router } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SenderArt } from "./Illustrations";
import { useThemeColors } from "../hooks/useThemeColors";
import planeWindow from "../../assets/plane-window.jpg";

export function PromoCards() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-3 mt-section-gap" style={{ height: 190 }}>
      <Pressable
        onPress={() => router.push("/invite")}
        className="flex-1 rounded-card bg-glass border border-hairline p-card-padding"
      >
        <View className="items-center">
          <SenderArt />
        </View>
        <Text className="font-heading font-bold text-text-primary text-xs mt-1.5 leading-4">
          {t("home.promo.familiesTitle")}
        </Text>
        <Text className="font-body text-text-muted text-[10px] mt-1 leading-3.5">
          {t("home.promo.familiesBody")}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.accent} style={{ marginTop: 4 }} />
      </Pressable>

      <Pressable onPress={() => router.push("/post-trip")} className="flex-1 rounded-card overflow-hidden">
        <ImageBackground source={planeWindow} resizeMode="cover" style={{ flex: 1 }}>
          <View className="flex-1 justify-end bg-black/35 p-card-padding">
            <Text className="font-heading font-bold text-white text-xs leading-4">
              {t("home.promo.travelTitle")}
            </Text>
            <Text className="font-body text-white/80 text-[10px] mt-1 leading-3.5">
              {t("home.promo.travelBody")}
            </Text>
            <Ionicons name="chevron-forward" size={15} color="#fff" style={{ marginTop: 4 }} />
          </View>
        </ImageBackground>
      </Pressable>
    </View>
  );
}
