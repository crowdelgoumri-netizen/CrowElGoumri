/**
 * Notifications (board 11) — the bell-icon list.
 *
 * Reads /notifications (cursor pagination ready), renders each by type, and
 * lets the user mark all read. The unread count also feeds the Messages tab
 * badge via the tab layout. Push registration itself happens at boot (push.ts).
 */
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { EmptyState } from "../src/components/EmptyState";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { listNotifications, markRead, type AppNotification } from "../src/lib/notifications-api";
import { timeAgo } from "../src/lib/format";

const ICON_FOR: Record<string, keyof typeof Ionicons.glyphMap> = {
  MATCH_FOUND: "people-outline",
  ESCROW_FUNDED: "lock-closed",
  ESCROW_REFUNDED: "cash-outline",
  DELIVERED: "checkmark-done-circle",
  CHAT_MESSAGE: "chatbubble",
  KYC_APPROVED: "shield-checkmark",
  KYC_REJECTED: "shield-outline",
  PARCEL_PICKED_UP: "cube",
  IN_TRANSIT: "airplane",
  AWAITING_DELIVERY: "flag-outline",
};

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh, setData } = useAsync(
    () =>
      tokens
        ? listNotifications({ limit: 30 })
        : Promise.resolve(null),
    [!!tokens],
  );
  const notifications = data?.notifications ?? [];

  // Notifications are per-account — guests get the login wall.
  if (!tokens) {
    return <AuthWall headerTitle="Notifications" />;
  }

  async function markAllRead() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          }
        : prev,
    );
    try {
      await markRead();
    } catch {
      /* optimistic */
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        right={
          data && data.unreadCount > 0 ? (
            <Pressable onPress={markAllRead} className="px-2 py-1">
              <Text className="text-accent font-body text-sm font-semibold">Tout lu</Text>
            </Pressable>
          ) : undefined
        }
      />

      {data && data.unreadCount > 0 ? (
        <Text className="text-text-muted font-body text-xs mb-2">
          {data.unreadCount} non lue{data.unreadCount > 1 ? "s" : ""}
        </Text>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotifRow n={item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-divider ml-14" />}
        ListEmptyComponent={
          loading ? null : error ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Connexion impossible"
              subtitle={error}
              ctaLabel="Réessayer"
              onCta={refresh}
            />
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title="Aucune notification"
              subtitle="Vos matchs, paiements et messages importants apparaîtront ici."
            />
          )
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      />
    </Screen>
  );
}

function NotifRow({ n }: { n: AppNotification }) {
  const colors = useThemeColors();
  const icon = ICON_FOR[n.type] ?? "notifications";
  return (
    <View className="flex-row items-start gap-stack-gap py-card-padding">
      <View
        className={
          "h-9 w-9 items-center justify-center rounded-full " +
          (n.isRead ? "bg-glass" : "bg-accent/20")
        }
      >
        <Ionicons name={icon} size={16} color={n.isRead ? colors.textMuted : colors.accent} />
      </View>
      <View className="flex-1">
        <Text className={"font-body text-sm " + (n.isRead ? "text-text-muted" : "text-text-primary font-semibold")}>
          {n.title}
        </Text>
        {n.body ? <Text className="text-text-muted font-body text-xs mt-0.5">{n.body}</Text> : null}
        <Text className="text-text-muted/50 text-[10px] font-body mt-0.5">{timeAgo(n.createdAt)}</Text>
      </View>
      {!n.isRead ? <View className="h-2 w-2 rounded-full bg-accent mt-2" /> : null}
    </View>
  );
}
