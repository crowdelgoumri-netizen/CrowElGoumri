/**
 * Ratings — bidirectional post-delivery feedback (sender ↔ traveler).
 *
 * One rating per (fromUserId, toUserId, parcelId) — enforced by the Prisma
 * schema's unique constraint. toUserId is never taken from the client: it's
 * resolved server-side via counterpartyOf, so a caller can't rate themselves
 * or target the wrong participant. Every successful rating recomputes the
 * rated user's averageRating and refreshes their cached trust score —
 * lib/trust-service.ts's own doc comment has asked for this call ("after a
 * new rating") since it was written; nothing wired it until now.
 *
 * Endpoints:
 *   POST /ratings            rate the counterparty on a delivered parcel
 *   GET  /ratings/:parcelId  read both ratings for a parcel (participants only)
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";
import { assertParcelParticipant, counterpartyOf, HttpError } from "../lib/chat-access.js";
import { recomputeTrustForUser } from "../lib/trust-service.js";

const rateSchema = z.object({
  parcelId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

function sendHttpError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.message });
  }
  reply.code(500).send({ error: "Internal error" });
}

/** Recompute a user's averageRating from all ratings they've received, then refresh trust. */
async function recomputeAverageRating(userId: string): Promise<void> {
  const { _avg } = await prisma.rating.aggregate({
    where: { toUserId: userId },
    _avg: { score: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { averageRating: _avg.score ?? 0 },
  });
  await recomputeTrustForUser(userId);
}

export const ratingRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /ratings — rate the counterparty on a delivered parcel ────
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = rateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { parcelId, score, comment } = parsed.data;
      const userId = req.user.sub;

      let participant;
      try {
        participant = await assertParcelParticipant(parcelId, userId);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const toUserId = counterpartyOf(participant);
      if (!toUserId) {
        return reply.code(409).send({ error: "No counterparty to rate on this parcel" });
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
        select: { status: true },
      });
      if (!parcel) {
        return reply.code(404).send({ error: "Parcel not found" });
      }
      if (parcel.status !== "DELIVERED") {
        return reply.code(409).send({ error: "Parcel not yet delivered" });
      }

      let rating;
      try {
        rating = await prisma.rating.create({
          data: { parcelId, fromUserId: userId, toUserId, score, comment },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return reply.code(409).send({ error: "You already rated this parcel" });
        }
        throw err;
      }

      await recomputeAverageRating(toUserId);

      return reply.code(201).send({ rating });
    },
  );

  // ── GET /ratings/:parcelId — both ratings for a parcel ──────────────
  app.get(
    "/:parcelId",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      try {
        await assertParcelParticipant(parcelId, req.user.sub);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const ratings = await prisma.rating.findMany({ where: { parcelId } });
      return { ratings };
    },
  );
};
