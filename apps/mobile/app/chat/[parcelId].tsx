/**
 * Chat thread (board 08 detail) — the live, parcel-scoped conversation.
 *
 * useChatThread merges the REST history with realtime Socket.IO delivery, so a
 * message from the counterparty appears instantly. Bubbles: mine on the right
 * (accent), theirs on the left (glass). The thread is marked read on mount.
 */
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  Alert,
  FlatList,
  Image,
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
import { Avatar } from "../../src/components/Avatar";
import { AuthWall } from "../../src/components/AuthWall";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import { useChatThread } from "../../src/hooks/useChatThread";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { getParcel } from "../../src/lib/parcels";
import { timeAgo } from "../../src/lib/format";
import { pickAndUploadImage } from "../../src/lib/uploads";
import { ApiError } from "../../src/lib/api";
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
  const [picking, setPicking] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ localUri: string; objectUrl: string } | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Newest first for the inverted list.
  const ordered = [...messages].reverse();

  async function onPickImage() {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickAndUploadImage("chat-attachment");
      if (picked) setPendingImage(picked);
    } catch (e) {
      Alert.alert(
        t("chat.attachErrorTitle"),
        e instanceof ApiError ? e.message : t("common.retryLater"),
      );
    } finally {
      setPicking(false);
    }
  }

  async function onSend() {
    if ((!draft.trim() && !pendingImage) || sending) return;
    setSending(true);
    const body = draft;
    const attachments = pendingImage ? [pendingImage.objectUrl] : [];
    setDraft("");
    setPendingImage(null);
    try {
      await send(body, attachments);
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
        {/* Thread header — back + avatar + counterparty + parcel context */}
        <View className="flex-row items-center gap-3 px-screen-edge py-2.5 border-b border-hairline bg-base">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-glass border border-hairline"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Avatar name={counterpartyName} size="md" />
          <View className="flex-1">
            <Text className="text-text-primary font-heading font-bold text-base" numberOfLines={1}>
              {counterpartyName ?? t("chat.title")}
            </Text>
            <View className="flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-success" />
              <Text className="text-text-muted font-body text-xs" numberOfLines={1}>
                {parcel?.description ?? t("chat.online")}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => parcel && router.push(`/tracking/${parcel.id}`)}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-glass border border-hairline"
          >
            <Ionicons name="cube-outline" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>

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
        <View className="border-t border-hairline bg-base">
          {pendingImage ? (
            <View className="flex-row items-center gap-2 px-screen-edge pt-2.5">
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: pendingImage.localUri }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <Pressable
                  onPress={() => setPendingImage(null)}
                  hitSlop={8}
                  className="h-5 w-5 items-center justify-center rounded-full bg-base border border-hairline"
                  style={{ position: "absolute", top: -6, right: -6 }}
                >
                  <Ionicons name="close" size={12} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          ) : null}
          <View className="flex-row items-center gap-2.5 px-screen-edge py-card-padding">
            <Pressable
              onPress={onPickImage}
              disabled={picking}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-full bg-glass border border-hairline"
              style={{ opacity: picking ? 0.5 : 1 }}
            >
              <Ionicons name="image-outline" size={19} color={colors.textPrimary} />
            </Pressable>
            <View className="flex-1 flex-row items-center rounded-full bg-glass border border-hairline px-lg">
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
              disabled={(!draft.trim() && !pendingImage) || sending}
              className="h-12 w-12 items-center justify-center rounded-full bg-accent active:opacity-80"
              style={{ opacity: (draft.trim() || pendingImage) && !sending ? 1 : 0.4 }}
            >
              <Ionicons name="send" size={19} color={colors.accentOn} />
            </Pressable>
          </View>
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
          "max-w-[78%] " +
          (message.attachments && message.attachments.length > 0 ? "gap-1.5 " : "px-card-padding py-2.5 ") +
          (mine
            ? "bg-accent rounded-card rounded-tr-md"
            : "bg-glass border border-hairline rounded-card rounded-tl-md")
        }
        style={message.attachments && message.attachments.length > 0 ? { padding: 5 } : undefined}
      >
        {message.attachments?.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width: 200, height: 200, borderRadius: 14 }}
            resizeMode="cover"
          />
        ))}
        {message.body ? (
          <Text
            className={
              (message.attachments && message.attachments.length > 0 ? "px-2 pb-1 pt-0.5 " : "") +
              (mine
                ? "text-accent-on font-body text-[15px] leading-5"
                : "text-text-oncard font-body text-[15px] leading-5")
            }
          >
            {message.body}
          </Text>
        ) : null}
      </View>
      <Text className="text-text-muted text-[10px] font-body mt-0.5 mr-1">
        {timeAgo(message.createdAt)}
        {showRead && message.readAt ? " · " + t("chat.read") : ""}
      </Text>
    </View>
  );
}
