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
import { useAuth } from "../../src/store/auth";
import { listNotifications } from "../../src/lib/notifications-api";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function TabsLayout() {
  const colors = useThemeColors();
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
            height: 64,
            paddingBottom: 8,
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
            title: "Accueil",
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid-outline" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubble-outline" size={22} color={color} />
            ),
            tabBarBadge: unread > 0 ? unread : undefined,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
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
          bottom: 38,
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
              Que voulez-vous faire ?
            </Text>
            <ChooserOption
              icon="cube"
              title="Envoyer un colis"
              subtitle="Trouvez un voyageur pour livrer en Algérie"
              onPress={() => {
                setFabOpen(false);
                router.push("/post-parcel");
              }}
            />
            <ChooserOption
              icon="airplane"
              title="Proposer un trajet"
              subtitle="Gagnez de l'espace disponible dans vos bagages"
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
