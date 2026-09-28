/**
 * HomeHero — DiasporaCart brand hero for the top of the Home screen.
 *
 * Logo lockup + a combined-inbox bell + avatar, then the Algiers photo with
 * the tagline/value props/quote overlaid directly on it and a floating
 * "community" card. The old dedicated traveler CTA moved into
 * HomeActionBar's "Je voyage" segment; the stats bar is now its own
 * section in index.tsx, below HomeActionBar.
 */
import { router } from "expo-router";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Avatar } from "./Avatar";
import { useAuth } from "../store/auth";
import { useAsync } from "../hooks/useAsync";
import { useThemeColors } from "../hooks/useThemeColors";
import { listNotifications } from "../lib/notifications-api";
import { listThreads } from "../lib/chat";
import { PERSONAS } from "../theme/tokens";
import heroAlgiers from "../../assets/hero-algiers.jpg";

export function HomeHero() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const user = useAuth((s) => s.user);

  // Combined inbox badge: the bell now also stands in for the (removed)
  // Messages tab, so its count folds in unread chat threads too.
  const { data: notifData } = useAsync(
    () =>
      tokens
        ? listNotifications({ unreadOnly: true, limit: 1 })
        : Promise.resolve(null),
    [!!tokens],
  );
  const { data: threadsData } = useAsync(
    () => (tokens ? listThreads() : Promise.resolve(null)),
    [!!tokens],
  );
  const notifUnread = notifData?.unreadCount ?? 0;
  const messagesUnread = (threadsData?.threads ?? []).reduce(
    (sum, th) => sum + th.unreadCount,
    0,
  );
  const unread = notifUnread + messagesUnread;

  return (
    <View className="mt-md">
      {/* Logo lockup + bell + avatar */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Ionicons name="heart" size={16} color={colors.accentOn} />
          </View>
          <Text className="font-heading text-lg font-extrabold">
            <Text className="text-text-primary">Diaspora</Text>
            <Text className="text-accent">Cart</Text>
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/notifications")}
            className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unread > 0 ? (
              <View className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-accent">
                <Text className="text-accent-on text-[10px] font-bold">
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Avatar name={user?.firstName} size="sm" />
          </Pressable>
        </View>
      </View>

      {/* Photo card — tagline/quote overlaid directly, floating community card */}
      <View className="mt-section-gap rounded-card overflow-hidden">
        <ImageBackground source={heroAlgiers} resizeMode="cover">
          <LinearGradient
            colors={["rgba(255,255,255,0.65)", "rgba(255,255,255,0.25)", "transparent"]}
            locations={[0, 0.32, 0.55]}
            style={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 120 }}
          >
            <Text className="text-text-primary font-heading text-2xl font-bold leading-7">
              {t("home.heroBanner.tagline")}
            </Text>
            <Text className="text-text-secondary font-body text-sm mt-1.5">
              {t("home.heroBanner.valueProps")}
            </Text>
            <Text
              className="text-accent font-script text-lg mt-2"
              style={{ transform: [{ rotate: "-2deg" }] }}
            >
              {t("home.heroBanner.quote")}
            </Text>

            <Pressable
              onPress={() => router.push("/invite")}
              className="mt-section-gap flex-row items-center gap-2 self-start rounded-field bg-glass-strong border border-hairline px-3 py-2.5"
            >
              <View className="flex-row">
                {PERSONAS.slice(0, 3).map((p, i) => (
                  <View key={p.name} style={{ marginLeft: i > 0 ? -10 : 0 }}>
                    <Avatar name={p.name} size="sm" className="border-2 border-white" />
                  </View>
                ))}
              </View>
              <View className="ml-1">
                <Text className="font-heading font-bold text-text-primary text-xs">
                  {t("home.heroBanner.communityTitle")}
                </Text>
                <Text className="font-body text-text-muted text-[10px]">
                  <Text className="font-bold text-accent">+10K</Text>{" "}
                  {t("home.heroBanner.communitySubtitle")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
}
