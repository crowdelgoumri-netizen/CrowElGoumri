/**
 * useChatThread — the live chat experience for one parcel thread.
 *
 * Merges the REST history (durable, paginated) with realtime Socket.IO
 * delivery so a message the counterparty sends appears instantly. Also marks
 * the thread read on mount and reflects read receipts.
 *
 * Lifecycle is tied to the parcelId: joining/leaving the server room is the
 * server's gatekeeping (assertParcelParticipant), so a user only receives
 * messages for threads they're a party to.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getHistory, markRead, sendMessage, type ChatMessage } from "../lib/chat";
import { joinThread, leaveThread, onSocketEvent } from "../lib/socket";
import { useAsync } from "./useAsync";
import { OfflineQueuedError } from "../lib/api";

interface ReadEvent {
  parcelId: string;
  userId: string;
  at: string;
}

export function useChatThread(parcelId: string, myId: string | undefined) {
  const { loading, error, refresh } = useAsync(
    () => getHistory(parcelId, { limit: 50 }),
    [parcelId],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  // Hydrate from REST on (re)load.
  useEffect(() => {
    let alive = true;
    getHistory(parcelId, { limit: 50 })
      .then((res) => {
        if (alive) setMessages(res.messages);
      })
      .catch(() => {
        /* surfaced via useAsync's error */
      });
    return () => {
      alive = false;
    };
  }, [parcelId]);

  // Join the server room + subscribe to live events for this thread.
  useEffect(() => {
    joinThread(parcelId).catch(() => {
      /* not a participant / socket down — REST still works */
    });

    const offMessage = onSocketEvent<ChatMessage>("chat:message", (m) => {
      if (m.parcelId !== parcelId) return;
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
    });

    const offRead = onSocketEvent<ReadEvent>("chat:read", (r) => {
      if (r.parcelId !== parcelId || !myId) return;
      // Counterparty read our messages — stamp readAt on what we sent.
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === myId && !m.readAt ? { ...m, readAt: r.at } : m,
        ),
      );
    });

    return () => {
      offMessage();
      offRead();
      leaveThread(parcelId);
    };
  }, [parcelId, myId]);

  // Mark inbound messages read once we've mounted the thread.
  useEffect(() => {
    if (!myId) return;
    markRead(parcelId).catch(() => {});
  }, [parcelId, myId]);

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      try {
        const { message } = await sendMessage(parcelId, trimmed);
        setMessages((prev) =>
          prev.some((x) => x.id === message.id) ? prev : [...prev, message],
        );
      } catch (e) {
        if (e instanceof OfflineQueuedError && myIdRef.current) {
          // Optimistically show the message locally with a pending marker.
          const pending: ChatMessage = {
            id: `pending-${Date.now()}`,
            parcelId,
            senderId: myIdRef.current,
            body: trimmed,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, pending]);
        } else {
          throw e;
        }
      }
    },
    [parcelId],
  );

  return { messages, loading, error, send, refresh };
}
