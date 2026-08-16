/**
 * Messages (board 08 list) — the chat inbox.
 *
 * Lists every parcel thread the user is a party to (sender or matched
 * traveler), with the counterparty, last message preview, and unread badge.
 * Tapping a thread opens the live chat (chat/[parcelId]).
 */
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Avatar } from "../../src/components/Avatar";
import { EmptyState } from "../../src/components/EmptyState";
import { useAsync } from "../../src/hooks/useAsync";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { listThreads, type ChatThread } from "../../src/lib/chat";
import { PARCEL_STATUS, timeAgo } from "../../src/lib/format";

export default function MessagesScreen() {
  const colors = useThemeColors();
  const { data, loading, error, refresh } = useAsync(() => listThreads(), []);
  const threads = data?.threads ?? [];

  return (
    <Screen>
      <Text className="text-text-primary font-heading text-screen-title font-bold mt-md">
        Messages
      </Text>

      <FlatList
        className="mt-stack-gap"
        data={threads}
        keyExtractor={(t) => t.parcelId}
        renderItem={({ item }) => <ThreadRow thread={item} />}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-divider ml-16" />
        )}
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
              icon="chatbubbles-outline"
              title="Aucun message"
              subtitle="Vos conversations avec les voyageurs et expéditeurs apparaîtront ici, dès qu'un match est accepté."
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      />
    </Screen>
  );
}

function ThreadRow({ thread }: { thread: ChatThread }) {
  const st = PARCEL_STATUS[thread.status];
  return (
    <Pressable
      onPress={() => router.push(`/chat/${thread.parcelId}`)}
      className="flex-row items-center gap-stack-gap py-stack-gap active:opacity-70"
    >
      <Avatar name={thread.counterparty.firstName} size="md" />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-text-primary font-body font-semibold" numberOfLines={1}>
            {thread.counterparty.firstName}
          </Text>
          <Text className="text-text-muted text-xs font-body">
            {timeAgo(thread.lastMessage?.createdAt)}
          </Text>
        </View>
        <Text className="text-text-secondary font-body text-sm" numberOfLines={1}>
          {thread.lastMessage?.body ?? "Nouvelle conversation · " + (st?.label ?? thread.status)}
        </Text>
        <Text className="text-text-muted/50 text-xs font-body mt-0.5" numberOfLines={1}>
          {thread.description}
        </Text>
      </View>
      {thread.unreadCount > 0 ? (
        <View className="h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-accent">
          <Text className="text-accent-on text-xs font-bold">{thread.unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
