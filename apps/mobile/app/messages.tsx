/**
 * Messages (board 08 list) — the chat inbox.
 *
 * Lists every parcel thread the user is a party to (sender or matched
 * traveler), with the counterparty, last message preview, and unread badge.
 * Tapping a thread opens the live chat (chat/[parcelId]).
 */
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { Avatar } from "../src/components/Avatar";
import { EmptyState } from "../src/components/EmptyState";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { useAsync } from "../src/hooks/useAsync";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { listThreads, type ChatThread } from "../src/lib/chat";
import { PARCEL_STATUS, timeAgo } from "../src/lib/format";

export default function MessagesScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const tokens = useAuth((s) => s.tokens);
  const { data, loading, error, refresh } = useAsync(
    () =>
      tokens
        ? listThreads()
        : Promise.resolve({ threads: [] as ChatThread[] }),
    [!!tokens],
  );
  const threads = data?.threads ?? [];

  // Chat is party-only — guests get the login wall instead of a 401.
  if (!tokens) {
    return (
      <AuthWall
        title={t("messages.guestTitle")}
        subtitle={t("messages.guestSubtitle")}
      />
    );
  }

  return (
    <Screen>
      <Text className="text-text-primary font-heading text-screen-title font-bold mt-md">
        {t("messages.title")}
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
              title={t("common.errorTitle")}
              subtitle={error}
              ctaLabel={t("common.retry")}
              onCta={refresh}
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={t("messages.emptyTitle")}
              subtitle={t("messages.emptySubtitle")}
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
  const { t } = useTranslation();
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
          {thread.lastMessage?.body ??
            t("messages.newThread") + " · " + (st ? t(st.key) : thread.status)}
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
