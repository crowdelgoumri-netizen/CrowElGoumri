/**
 * Tabs layout — the main app shell (guests welcome).
 *
 * Five flat tabs (Accueil / Rechercher / Mes voyages / Messages / Profil)
 * per the DiasporaCart Complete Design System nav spec. Parcel creation
 * ("Envoyer un colis" → /post-parcel) is reached from Home's action bar
 * and other in-context CTAs (trip detail, campaign, parcels list) rather
 * than from a dedicated tab.
 */
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
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
      {/* Not a tab — the center-button redirect this used to power is gone,
          but the route file stays as a safe fallback for any stale deep
          link. `href: null` keeps it out of the tab bar entirely. */}
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}
