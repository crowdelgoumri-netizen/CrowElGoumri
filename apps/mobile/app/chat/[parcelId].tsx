/**
 * Chat thread (board 08 detail) — the live, parcel-scoped conversation.
 *
 * useChatThread merges the REST history with realtime Socket.IO delivery, so a
 * message from the counterparty appears instantly. Bubbles: mine on the right
 * (accent), theirs on the left (glass). The thread is marked read on mount.
 */
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Avatar } from "../../src/components/Avatar";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useChatThread } from "../../src/hooks/useChatThread";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getParcel } from "../../src/lib/parcels";
import { timeAgo } from "../../src/lib/format";
import type { ChatMessage } from "../../src/lib/chat";

export default function ChatScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const user = useAuth((s) => s.user);
  const myId = user?.id;
  const { messages, send } = useChatThread(parcelId, myId);

  // Header context: who is the counterparty?
  const { data } = useAsync(() => getParcel(parcelId), [parcelId]);
  const parcel = data?.parcel;
  const counterpartyName =
    parcel && myId === parcel.senderId
      ? parcel.matchedTrip?.traveler?.firstName
      : parcel?.sender?.firstName;

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Newest first for the inverted list.
  const ordered = [...messages].reverse();

  async function onSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setDraft("");
    try {
      await send(draft);
    } finally {
      setSending(false);
    }
  }

  // Scroll to bottom (index 0 of the inverted list) when a new message lands.
  useEffect(() => {
    if (ordered.length > 0) {
      listRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
    }
  }, [ordered.length]);

  // Chat is party-only — guests get the login wall (after all hooks).
  if (!user) {
    return <AuthWall headerTitle={t("chat.title")} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScreenHeader
          title={counterpartyName ?? t("chat.title")}
          subtitle={parcel?.description}
        />

        <FlatList
          ref={listRef}
          data={ordered}
          keyExtractor={(m) => m.id}
          inverted
          onScrollToIndexFailed={() => {}}
          contentContainerClassName="px-screen-edge py-card-padding"
          renderItem={({ item }) => (
            <Bubble mine={item.senderId === myId} message={item} showRead={!!myId && item.senderId === myId} />
          )}
          ItemSeparatorComponent={() => <View className="h-1" />}
          ListEmptyComponent={
            <View className="items-center py-xl">
              <Avatar name={counterpartyName} size="lg" />
              <Text className="text-text-primary font-heading font-bold mt-section-gap">
                {counterpartyName ?? t("messages.newThread")}
              </Text>
              <Text className="text-text-muted font-body text-sm mt-1 text-center max-w-[260px]">
                {t("chat.emptyBody")}
              </Text>
            </View>
          }
        />

        {/* Composer */}
        <View className="flex-row items-end gap-2 px-screen-edge py-card-padding border-t border-hairline bg-base">
          <View className="flex-1 flex-row items-center rounded-field bg-glass border border-hairline px-card-padding">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={colors.placeholder}
              className="flex-1 text-text-primary font-body text-base py-3"
              multiline
              maxLength={5000}
            />
          </View>
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            className="h-11 w-11 items-center justify-center rounded-full bg-accent active:opacity-80"
            style={{ opacity: draft.trim() && !sending ? 1 : 0.4 }}
          >
            <Ionicons name="send" size={18} color={colors.accentOn} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  mine,
  message,
  showRead,
}: {
  mine: boolean;
  message: ChatMessage;
  showRead: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className={mine ? "items-end" : "items-start"}>
      <View
        className={
          "max-w-[78%] rounded-card px-card-padding py-2 " +
          (mine ? "bg-accent" : "bg-glass border border-hairline")
        }
      >
        <Text className={mine ? "text-accent-on font-body text-sm" : "text-text-oncard font-body text-sm"}>
          {message.body}
        </Text>
      </View>
      <Text className="text-text-muted text-[10px] font-body mt-0.5 mr-1">
        {timeAgo(message.createdAt)}
        {showRead && message.readAt ? " · " + t("chat.read") : ""}
      </Text>
    </View>
  );
}
