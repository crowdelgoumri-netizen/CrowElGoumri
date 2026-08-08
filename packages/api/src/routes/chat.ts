/**
 * Chat routes — REST persistence + history for parcel-threaded chat.
 *
 * The Socket.IO plugin (realtime.ts) does live delivery; this module owns
 * the durable record: history pagination, send (which also broadcasts),
 * read-state, and the inbox view. Both transports share one access rule
 * via assertParcelParticipant, so a user can't read or write a thread they
 * aren't a party to.
 *
 * Endpoints:
 *   GET    /chat/threads              caller's inbox (last msg + unread)
 *   GET    /chat/:parcelId            paginated history (cursor on createdAt)
 *   POST   /chat/:parcelId            send a message (broadcasts to room)
 *   POST   /chat/:parcelId/read       mark thread read by caller
 *
 * Messages are append-only in v1 (no edit/delete); bodies are plaintext
 * at rest (E2E encryption is a dedicated future phase per the blueprint's
 * Layer 3 security).
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";
import {
  assertParcelParticipant,
  HttpError,
} from "../lib/chat-access.js";

// ── Validation ───────────────────────────────────────────────────────
const historyQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachments: z.array(z.string().url()).max(5).default([]),
});

// Map an HttpError to a Fastify reply. Keeps the per-route try/catch tiny.
function sendHttpError(reply: import("fastify").FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.message });
  }
  reply.code(500).send({ error: "Internal error" });
}

const ISO = (d: Date) => d.toISOString();

// ── Routes ───────────────────────────────────────────────────────────
// NOTE: GET /chat/threads is registered before GET /chat/:parcelId so the
// static path wins over the param route. Fastify matches in registration
// order for overlapping static/dynamic patterns.
export const chatRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /chat/threads — inbox ───────────────────────────────────────
  app.get(
    "/threads",
    { preHandler: [app.authenticate] },
    async (req) => {
      const userId = req.user.sub;

      // A thread exists for a parcel if (a) the user is its sender, or
      // (b) the user is the traveler of its matched trip. We resolve both
      // sides in two queries and merge — cheap at v1 scale, and keeps the
      // SQL simple vs. a union over a self-join on Parcel.
      const [sentParcels, traveledParcels] = await Promise.all([
        prisma.parcel.findMany({
          where: { senderId: userId, matchedTripId: { not: null } },
          select: parcelThreadSelect,
        }),
        prisma.parcel.findMany({
          where: { matchedTrip: { travelerId: userId } },
          select: parcelThreadSelect,
        }),
      ]);

      // Dedup: a BOTH user sending to their own trip would appear in both.
      const byId = new Map(sentParcels.concat(traveledParcels).map((p) => [p.id, p]));

      const threads = await Promise.all(
        [...byId.values()].map(async (p) => {
          // Last message + unread count in one pass. At v1 scale (threads
          // carry tens of messages) this is fine; denormalize into a
          // Parcel.lastMessageAt column if it ever shows up in profiles.
          const [last, unread] = await Promise.all([
            prisma.chatMessage.findFirst({
              where: { parcelId: p.id },
              orderBy: { createdAt: "desc" },
            }),
            prisma.chatMessage.count({
              where: {
                parcelId: p.id,
                senderId: { not: userId },
                readAt: null,
              },
            }),
          ]);
          // Counterparty = the other party on the thread. We pulled both
          // sides; pick whichever isn't the caller. (For the rare BOTH-user
          // case where they're both sender and traveler, prefer the sender.)
          // Both queries guarantee a matched trip exists, so non-null.
          const counterparty =
            userId === p.sender.id
              ? p.matchedTrip!.traveler
              : p.sender;
          return {
            parcelId: p.id,
            description: p.description,
            status: p.status,
            counterparty: {
              id: counterparty.id,
              firstName: counterparty.firstName,
              trustBadge: counterparty.trustBadge,
            },
            lastMessage: last
              ? { body: last.body, createdAt: ISO(last.createdAt) }
              : null,
            unreadCount: unread,
          };
        }),
      );

      // Newest thread (by last message) first; threads with no messages
      // sink to the bottom ordered by parcel creation.
      threads.sort((a, b) => {
        const at = a.lastMessage?.createdAt ?? "";
        const bt = b.lastMessage?.createdAt ?? "";
        return bt.localeCompare(at);
      });

      return { threads };
    },
  );

  // ── GET /chat/:parcelId — paginated history ─────────────────────────
  app.get(
    "/:parcelId",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      const parsed = historyQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { before, limit } = parsed.data;

      try {
        await assertParcelParticipant(parcelId, req.user.sub);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      // Cursor pagination on createdAt: client passes the oldest already-
      // loaded message's timestamp as `before` to fetch the next page.
      const messages = await prisma.chatMessage.findMany({
        where: {
          parcelId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      // Reverse for display order (oldest first) client-side; we expose
      // oldest-first so consumers can prepend directly.
      return {
        messages: messages.reverse().map((m) => ({
          id: m.id,
          parcelId: m.parcelId,
          senderId: m.senderId,
          body: m.body,
          attachments: m.attachments,
          createdAt: ISO(m.createdAt),
          readAt: m.readAt ? ISO(m.readAt) : null,
        })),
        cursor: messages.length === limit
          ? messages[messages.length - 1].createdAt.toISOString()
          : null, // null when exhausted
      };
    },
  );

  // ── POST /chat/:parcelId — send a message ───────────────────────────
  app.post(
    "/:parcelId",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      try {
        await assertParcelParticipant(parcelId, req.user.sub);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const message = await prisma.chatMessage.create({
        data: {
          parcelId,
          senderId: req.user.sub,
          body: parsed.data.body,
          attachments: parsed.data.attachments,
        },
      });

      const payload = {
        id: message.id,
        parcelId: message.parcelId,
        senderId: message.senderId,
        body: message.body,
        attachments: message.attachments,
        createdAt: ISO(message.createdAt),
      };

      // Broadcast to every connected participant (including, optionally,
      // the sender's other devices). Both REST and a hypothetical socket-
      // emit send path funnel through here for persistence, so the room
      // always sees a consistent event shape.
      app.broadcastToParcel(parcelId, "chat:message", payload);

      return reply.code(201).send({ message: { ...payload, readAt: null } });
    },
  );

  // ── POST /chat/:parcelId/read — mark thread read by caller ──────────
  app.post(
    "/:parcelId/read",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      try {
        await assertParcelParticipant(parcelId, req.user.sub);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const now = new Date();
      // Stamp readAt on every *inbound* message (not sent by the caller)
      // that's still unread. UpdateMany so it's one round-trip.
      const result = await prisma.chatMessage.updateMany({
        where: {
          parcelId,
          senderId: { not: req.user.sub },
          readAt: null,
        },
        data: { readAt: now },
      });

      app.broadcastToParcel(parcelId, "chat:read", {
        parcelId,
        userId: req.user.sub,
        at: ISO(now),
      });

      return { markedRead: result.count };
    },
  );
};

// Shared projection for the inbox query: the parcel + both parties. The
// caller's counterparty is resolved in JS (we don't know sender vs
// traveler until we know which side the caller is on), so we pull both
// the sender and the matched trip's traveler up front.
const parcelThreadSelect = {
  id: true,
  description: true,
  status: true,
  createdAt: true,
  senderId: true,
  sender: {
    select: { id: true, firstName: true, trustBadge: true },
  },
  matchedTrip: {
    select: {
      traveler: {
        select: { id: true, firstName: true, trustBadge: true },
      },
    },
  },
} satisfies Prisma.ParcelSelect;
