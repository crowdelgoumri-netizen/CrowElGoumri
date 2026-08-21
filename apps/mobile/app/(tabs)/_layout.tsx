/**
 * Tabs layout — the main app shell (guests welcome).
 *
 * Three tabs (Accueil / Messages / Profil) over the Aurora base, with a
 * floating center "+" FAB that opens a chooser: send a parcel or post a trip.
 * Both post screens push onto the root stack as modals (full-screen forms).
 * Guests browse the Accueil feed; Messages/Profile/FAB route them to login.
 */
import { useState } from "react";
import { router, Tabs } from "expo-router";
import {
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/store/auth";
import { listNotifications } from "../../src/lib/notifications-api";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Lift the tab bar above the Android gesture/3-button nav bar — without
  // this, the system bar overlays the tabs on physical devices.
  const insets = useSafeAreaInsets();
  const tokens = useAuth((s) => s.tokens);
  const [fabOpen, setFabOpen] = useState(false);

  // Unread badge for the Messages + Notifications affordances.
  // Guests have no notifications — skip the call instead of eating a 401.
  const { data: notifData } = useAsync(
    () =>
      tokens
        ? listNotifications({ unreadOnly: true, limit: 1 })
        : Promise.resolve(null),
    [!!tokens],
  );
  const unread = notifData?.unreadCount ?? 0;

  // The "+" FAB publishes (parcel or trip) — an account is required, so
  // guests are sent to login instead of the chooser.
  function openFab() {
    if (!tokens) {
      router.push("/auth/login");
      return;
    }
    setFabOpen(true);
  }

  return (
    <View className="flex-1 bg-base">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.chromeBar,
            borderTopColor: colors.chromeBorder,
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: "PlusJakartaSans", fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.home"),
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t("tabs.messages"),
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubble-outline" size={22} color={color} />
            ),
            tabBarBadge: unread > 0 ? unread : undefined,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.profile"),
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={22} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Center floating "+" — opens the post chooser. */}
      <Pressable
        testID="fab-button"
        onPress={openFab}
        className="absolute rounded-full bg-accent items-center justify-center active:opacity-80"
        style={{
          bottom: 38 + insets.bottom,
          alignSelf: "center",
          width: 60,
          height: 60,
          shadowColor: colors.accent,
          shadowOpacity: 0.28,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color={colors.accentOn} />
      </Pressable>

      <Modal
        visible={fabOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFabOpen(false)}
      >
        <Pressable className="flex-1 justify-end" onPress={() => setFabOpen(false)}>
          <View className="flex-1 bg-black/50" />
          <View className="bg-glass-strong border-t border-hairline rounded-t-card p-lg pb-xl">
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-divider" />
            </View>
            <Text className="text-text-primary font-heading font-bold text-lg mb-stack-gap">
              {t("fab.title")}
            </Text>
            <ChooserOption
              icon="cube"
              title={t("fab.sendParcel")}
              subtitle={t("fab.sendParcelSubtitle")}
              onPress={() => {
                setFabOpen(false);
                router.push("/post-parcel");
              }}
            />
            <ChooserOption
              icon="airplane"
              title={t("fab.postTrip")}
              subtitle={t("fab.postTripSubtitle")}
              onPress={() => {
                setFabOpen(false);
                router.push("/post-trip");
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ChooserOption({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-stack-gap rounded-card bg-glass border border-hairline p-card-padding mb-sm active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/20">
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary font-body font-semibold">{title}</Text>
        <Text className="text-text-muted font-body text-xs">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
