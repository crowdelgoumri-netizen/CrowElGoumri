/**
 * Tabs layout — the main app shell (guests welcome).
 *
 * Five tabs (Accueil / Rechercher / Créer un envoi / Mes envois / Profil)
 * per the 2026-09-28 Home redesign. The center "Créer un envoi" tab has no
 * screen of its own — pressing it pushes /post-parcel directly (see
 * `tabPress` listener below); trip-posting stays reachable from the "Mes
 * envois" tab's own CTA and from Home's action bar. Messages moved out of
 * the tab bar entirely — chat threads are now reached via the Home
 * header's notification bell (see HomeHero.tsx) and a "Messages" row on
 * /notifications.
 */
import { Tabs } from "expo-router";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Lift the tab bar above the Android gesture/3-button nav bar — without
  // this, the system bar overlays the tabs on physical devices.
  const insets = useSafeAreaInsets();

  return (
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
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontFamily: "PlusJakartaSans", fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarButton: () => (
            <Pressable
              onPress={() => router.push("/post-parcel")}
              hitSlop={8}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              <Pressable
                onPress={() => router.push("/post-parcel")}
                style={{
                  marginTop: -22,
                  height: 52,
                  width: 52,
                  borderRadius: 26,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: colors.accentGlow,
                }}
              >
                <Ionicons name="add" size={26} color={colors.accentOn} />
              </Pressable>
            </Pressable>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/post-parcel");
          },
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t("tabs.trips"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "airplane" : "airplane-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
