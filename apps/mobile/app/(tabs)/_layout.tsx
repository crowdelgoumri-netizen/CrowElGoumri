/**
 * Tabs layout — the authenticated app shell.
 *
 * Three tabs (Accueil / Messages / Profil) over the board's navy, with a
 * floating center "+" FAB that opens a chooser: send a parcel or post a trip.
 * Both post screens push onto the root stack as modals (full-screen forms).
 */
import { useState } from "react";
import { Redirect, router, Tabs } from "expo-router";
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

export default function TabsLayout() {
  const tokens = useAuth((s) => s.tokens);
  const [fabOpen, setFabOpen] = useState(false);

  // Unread badge for the Messages + Notifications affordances.
  const { data: notifData } = useAsync(
    () => listNotifications({ unreadOnly: true, limit: 1 }),
    [],
  );
  const unread = notifData?.unreadCount ?? 0;

  if (!tokens) return <Redirect href="/auth/login" />;

  return (
    <View className="flex-1 bg-navy">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0B1220",
            borderTopColor: "rgba(255,255,255,0.08)",
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#FF6A2B",
          tabBarInactiveTintColor: "#8A94A6",
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
        onPress={() => setFabOpen(true)}
        className="absolute rounded-full bg-accent items-center justify-center active:opacity-80"
        style={{
          bottom: 38,
          alignSelf: "center",
          width: 60,
          height: 60,
          shadowColor: "#FF6A2B",
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color="#0B1220" />
      </Pressable>

      <Modal
        visible={fabOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFabOpen(false)}
      >
        <Pressable className="flex-1 justify-end" onPress={() => setFabOpen(false)}>
          <View className="flex-1 bg-black/50" />
          <View className="bg-navySoft border-t border-line rounded-t-card p-lg pb-xl">
            <View className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-mist/20" />
            </View>
            <Text className="text-white font-heading font-bold text-lg mb-md">
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
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-md rounded-card bg-navy/60 border border-line p-md mb-sm active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/20">
        <Ionicons name={icon} size={22} color="#FF6A2B" />
      </View>
      <View className="flex-1">
        <Text className="text-white font-body font-semibold">{title}</Text>
        <Text className="text-muted font-body text-xs">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A94A6" />
    </Pressable>
  );
}
