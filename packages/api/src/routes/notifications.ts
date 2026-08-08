/**
 * Notification routes — the /notifications REST group.
 *
 * The notify() helper (lib/notifications.ts) creates rows whenever a
 * lifecycle event fires; these routes are the read/management surface for
 * the bell-icon UI:
 *
 *   GET    /notifications              paginated list (cursor on createdAt)
 *   POST   /notifications/read         mark all or one as read
 *   POST   /notifications/device-token register a push token (on app open)
 *   DELETE /notifications/device-token unregister (on logout)
 *
 * Device-token registration is what makes push actually work: the mobile
 * client calls getExpoPushTokenAsync() on startup and POSTs the result here.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";
import { isValidExpoToken } from "../lib/notifications.js";

const listQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
});

const markReadSchema = z.object({
  id: z.string().uuid().optional(), // omit → mark all read
});

const tokenSchema = z.object({
  token: z.string().refine(isValidExpoToken, {
    message: "token must match ExponentPushToken[...]",
  }),
});

const ISO = (d: Date) => d.toISOString();

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /notifications — paginated list ─────────────────────────────
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { unreadOnly, limit, before } = parsed.data;
      const userId = req.user.sub;

      const where = {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      };

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      return {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          isRead: n.isRead,
          createdAt: ISO(n.createdAt),
        })),
        unreadCount,
        cursor: notifications.length === limit
          ? notifications[notifications.length - 1].createdAt.toISOString()
          : null,
      };
    },
  );

  // ── POST /notifications/read — mark all or one read ─────────────────
  app.post(
    "/read",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = markReadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const userId = req.user.sub;

      const result = await prisma.notification.updateMany({
        where: { userId, ...(parsed.data.id ? { id: parsed.data.id } : {}) },
        data: { isRead: true },
      });
      return { markedRead: result.count };
    },
  );

  // ── POST /notifications/device-token — register for push ────────────
  app.post(
    "/device-token",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = tokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const userId = req.user.sub;
      const token = parsed.data.token;

      // Dedup: only push the token if the user doesn't already have it.
      // Prisma has no atomic "set-union" on String[], so read-then-update
      // in a transaction to avoid races between concurrent registrations.
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { deviceTokens: true },
        });
        if (!user) return;
        if (user.deviceTokens.includes(token)) return;
        await tx.user.update({
          where: { id: userId },
          data: { deviceTokens: { push: token } },
        });
      });

      return { registered: true };
    },
  );

  // ── DELETE /notifications/device-token — unregister ─────────────────
  app.delete(
    "/device-token",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = tokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const userId = req.user.sub;
      const token = parsed.data.token;

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { deviceTokens: true },
        });
        if (!user) return;
        const kept = user.deviceTokens.filter((t) => t !== token);
        if (kept.length === user.deviceTokens.length) return;
        await tx.user.update({
          where: { id: userId },
          data: { deviceTokens: { set: kept } },
        });
      });

      return { unregistered: true };
    },
  );
};
