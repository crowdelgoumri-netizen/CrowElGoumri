/**
 * Disputes — sender/traveler-initiated reports on a parcel.
 *
 * One dispute per parcel (Dispute.parcelId is unique in the schema).
 * Opening a dispute moves the parcel to DISPUTED and notifies the other
 * party. v1 scope is open + read only — an admin moderation queue (mirroring
 * kyc.ts's /admin/pending pattern) is a separate future phase, and no other
 * route currently guards against acting on a DISPUTED parcel (escrow release,
 * delivery confirmation, etc. still work normally). That's a known, explicit
 * gap — not an oversight.
 *
 * Endpoints:
 *   POST /disputes            open a dispute (authenticated, participant only)
 *   GET  /disputes/:parcelId  read the dispute for a parcel (participants only)
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";
import { assertParcelParticipant, counterpartyOf, HttpError } from "../lib/chat-access.js";
import { assertParcelTransition } from "../lib/lifecycle.js";
import { notify } from "../lib/notifications.js";

const DISPUTE_REASONS = [
  "PARCEL_NOT_DELIVERED",
  "PARCEL_DAMAGED",
  "PARCEL_STOLEN",
  "CUSTOMS_SEIZURE",
  "TRAVELER_NO_SHOW",
  "SENDER_NO_SHOW",
  "FRAUD_ATTEMPT",
  "OTHER",
] as const;

/** French label per reason, used only for the notification text sent to the counterparty. */
const DISPUTE_REASON_LABEL_FR: Record<(typeof DISPUTE_REASONS)[number], string> = {
  PARCEL_NOT_DELIVERED: "Colis non livré",
  PARCEL_DAMAGED: "Colis endommagé",
  PARCEL_STOLEN: "Colis volé",
  CUSTOMS_SEIZURE: "Saisie en douane",
  TRAVELER_NO_SHOW: "Le voyageur n'est jamais venu",
  SENDER_NO_SHOW: "L'expéditeur n'est jamais venu",
  FRAUD_ATTEMPT: "Tentative de fraude",
  OTHER: "Autre",
};

const openSchema = z.object({
  parcelId: z.string().min(1),
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().min(1).max(2000),
});

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

function sendHttpError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.message });
  }
  reply.code(500).send({ error: "Internal error" });
}

export const disputeRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /disputes — open a dispute ─────────────────────────────────
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = openSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { parcelId, reason, description } = parsed.data;
      const userId = req.user.sub;

      let participant;
      try {
        participant = await assertParcelParticipant(parcelId, userId);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
        select: { status: true },
      });
      if (!parcel) {
        return reply.code(404).send({ error: "Parcel not found" });
      }
      if (!assertParcelTransition(parcel.status, "DISPUTED")) {
        return reply.code(409).send({
          error: `Parcel cannot transition ${parcel.status} → DISPUTED`,
        });
      }

      const existing = await prisma.dispute.findUnique({
        where: { parcelId },
        select: { id: true },
      });
      if (existing) {
        return reply.code(409).send({
          error: "A dispute already exists for this parcel",
          disputeId: existing.id,
        });
      }

      const now = new Date();
      let dispute;
      try {
        [dispute] = await prisma.$transaction([
          prisma.dispute.create({
            data: {
              parcelId,
              openedById: userId,
              reason,
              description,
              status: "OPENED",
              mustResolveBy: new Date(now.getTime() + SEVENTY_TWO_HOURS_MS),
            },
          }),
          prisma.parcel.update({
            where: { id: parcelId },
            data: { status: "DISPUTED" },
          }),
        ]);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return reply.code(409).send({
            error: "A dispute already exists for this parcel",
          });
        }
        throw err;
      }

      const counterpartyId = counterpartyOf(participant);
      if (counterpartyId) {
        notify(counterpartyId, "DISPUTE_OPENED", {
          parcelId,
          disputeReason: DISPUTE_REASON_LABEL_FR[reason],
        }).catch(() => { /* provider errors logged inside notify() */ });
      }

      app.log.info(
        { disputeId: dispute.id, parcelId, openedById: userId, reason },
        "Dispute opened",
      );

      return reply.code(201).send({ dispute });
    },
  );

  // ── GET /disputes/:parcelId — read the dispute for a parcel ────────
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

      const dispute = await prisma.dispute.findUnique({ where: { parcelId } });
      return { dispute };
    },
  );
};
