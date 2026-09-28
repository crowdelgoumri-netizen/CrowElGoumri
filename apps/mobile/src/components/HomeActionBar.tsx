/**
 * HomeActionBar — Home screen's dual-intent action card: a 3-way segmented
 * control (send a parcel / post a trip / search trips) over a De/Vers route
 * row, sitting directly below the hero photo (not overlapping it).
 */
import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Select } from "./Select";
import { useThemeColors } from "../hooks/useThemeColors";
import { CITY_OPTIONS, WILAYAS_1_58 } from "../config/corridors";

type Segment = "parcel" | "trip" | "search";

const SEGMENTS: { key: Segment; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "parcel", icon: "cube-outline", labelKey: "home.actionBar.segmentParcel" },
  { key: "trip", icon: "airplane-outline", labelKey: "home.actionBar.segmentTrip" },
  { key: "search", icon: "search-outline", labelKey: "home.actionBar.segmentSearch" },
];

export function HomeActionBar() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>("parcel");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function swap() {
    const f = from;
    setFrom(to);
    setTo(f);
  }

  function go() {
    if (segment === "parcel") {
      router.push("/post-parcel");
      return;
    }
    if (segment === "trip") {
      router.push("/post-trip");
      return;
    }
    if (from && to) {
      router.push({ pathname: "/(tabs)/search", params: { corridor: `${from} → ${to}` } });
    } else {
      router.push("/(tabs)/search");
    }
  }

  return (
    <Card raised className="mt-section-gap">
      <View className="flex-row bg-glass rounded-chip p-1">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              className={
                "flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-chip " +
                (active ? "bg-accent" : "bg-transparent")
              }
            >
              <Ionicons name={s.icon} size={13} color={active ? colors.accentOn : colors.textMuted} />
              <Text
                className={
                  "font-body font-semibold text-[11px] " +
                  (active ? "text-accent-on" : "text-text-muted")
                }
                numberOfLines={1}
              >
                {t(s.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-end gap-2 mt-stack-gap">
        <View className="flex-1">
          <Select
            label={t("home.actionBar.from")}
            value={from || null}
            options={CITY_OPTIONS}
            onSelect={setFrom}
            placeholder={t("home.actionBar.fromPlaceholder")}
          />
        </View>
        <Pressable
          onPress={swap}
          className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
        <View className="flex-1">
          <Select
            label={t("home.actionBar.to")}
            value={to || null}
            options={WILAYAS_1_58}
            onSelect={setTo}
            placeholder={t("home.actionBar.toPlaceholder")}
          />
        </View>
        <Pressable
          onPress={go}
          accessibilityLabel={t("home.actionBar.cta")}
          className="h-11 w-11 items-center justify-center rounded-full bg-accent active:opacity-80"
        >
          <Ionicons name="search" size={17} color={colors.accentOn} />
        </Pressable>
      </View>
    </Card>
  );
}
