/**
 * KYC routes — manual admin-review queue (blueprint's KYC_PROVIDER=manual path).
 *
 * A user submits ID + selfie (as URLs — same photoUrls convention as
 * parcels; S3 upload itself is a dedicated cross-cutting phase), an admin
 * approves or rejects, and on approval the user's kycLevel bumps to the
 * submission's targetLevel + trust recomputes. The Sumsub automated
 * adapter slots in later behind KYC_PROVIDER=sumsub — same KycSubmission
 * shape, a different reviewer (a webhook instead of a human).
 *
 * Endpoints:
 *   POST /kyc/submit             submit ID+selfie for review (authenticated)
 *   GET  /kyc/status             current kycLevel + latest submission (authenticated)
 *   GET  /kyc/admin/pending      review queue, paginated (admin)
 *   POST /kyc/admin/:id/review   approve/reject a submission (admin)
 *
 * Admin bootstrap: no signup endpoint for admins (intentional — admins are
 * provisioned, not self-served). Set a user's role in dev/seed via
 * prisma studio or:
 *   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";
import { recomputeTrustForUser } from "../lib/trust-service.js";
import { notify } from "../lib/notifications.js";

// ── Validation ───────────────────────────────────────────────────────
const submitSchema = z.object({
  documentType: z.enum([
    "PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE", "RESIDENCY_PERMIT",
  ]),
  documentUrl: z.string().url(),
  documentBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url(),
  targetLevel: z.enum(["ENHANCED", "FULL"]),
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional(),
});

const pendingQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// KYC levels are ordered NONE < BASIC < ENHANCED < FULL — same ordering
// as packages/matching's KYC_SCORES. A submission only makes sense if its
// targetLevel is a real step up from where the user already is.
const KYC_RANK: Record<string, number> = {
  NONE: 0,
  BASIC: 1,
  ENHANCED: 2,
  FULL: 3,
};

// ── Routes ───────────────────────────────────────────────────────────
export const kycRoutes: FastifyPluginAsync = async (app) => {
  // POST /kyc/submit — user submits ID + selfie for review
  app.post(
    "/submit",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { documentType, documentUrl, documentBackUrl, selfieUrl, targetLevel } =
        parsed.data;
      const userId = req.user.sub;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { kycLevel: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      if (KYC_RANK[targetLevel] <= KYC_RANK[user.kycLevel]) {
        return reply.code(409).send({
          error: `Already at or above ${targetLevel} (current: ${user.kycLevel})`,
        });
      }

      // One submission in flight at a time — avoids a duplicate review queue.
      const existingPending = await prisma.kycSubmission.findFirst({
        where: { userId, status: "PENDING" },
        select: { id: true },
      });
      if (existingPending) {
        return reply.code(409).send({
          error: "A submission is already pending review",
          submissionId: existingPending.id,
        });
      }

      const submission = await prisma.kycSubmission.create({
        data: {
          userId,
          documentType,
          documentUrl,
          documentBackUrl,
          selfieUrl,
          targetLevel,
          status: "PENDING",
        },
      });

      // No admin-users list yet (v1) — log for ops visibility. Swap for a
      // real admin-alert notification once admins are queryable.
      app.log.info(
        { submissionId: submission.id, userId, targetLevel },
        "KYC submission pending review",
      );

      return reply.code(201).send({ submission });
    },
  );

  // GET /kyc/status — current level + latest submission
  app.get(
    "/status",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { kycLevel: true, kycVerifiedAt: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const latestSubmission = await prisma.kycSubmission.findFirst({
        where: { userId: req.user.sub },
        orderBy: { createdAt: "desc" },
      });

      return {
        kycLevel: user.kycLevel,
        kycVerifiedAt: user.kycVerifiedAt,
        latestSubmission,
      };
    },
  );

  // GET /kyc/admin/pending — the review queue (paginated)
  app.get(
    "/admin/pending",
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (req, reply) => {
      const parsed = pendingQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { limit, offset } = parsed.data;

      const [submissions, total] = await Promise.all([
        prisma.kycSubmission.findMany({
          where: { status: "PENDING" },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: "asc" }, // oldest first — FIFO queue
          take: limit,
          skip: offset,
        }),
        prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      ]);

      return { submissions, total, limit, offset };
    },
  );

  // POST /kyc/admin/:id/review — approve or reject a submission
  app.post(
    "/admin/:id/review",
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = reviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { decision, note } = parsed.data;

      const submission = await prisma.kycSubmission.findUnique({
        where: { id },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
      }
      if (submission.status !== "PENDING") {
        return reply.code(409).send({
          error: `Submission already ${submission.status}`,
        });
      }

      const reviewed = await prisma.kycSubmission.update({
        where: { id },
        data: {
          status: decision,
          reviewerId: req.user.sub,
          reviewNote: note ?? null,
          reviewedAt: new Date(),
        },
      });

      if (decision === "APPROVED") {
        await prisma.user.update({
          where: { id: submission.userId },
          data: {
            kycLevel: submission.targetLevel as "ENHANCED" | "FULL",
            kycVerifiedAt: new Date(),
          },
        });
        // Trust weighs kycLevel directly — this is the moment it should move.
        await recomputeTrustForUser(submission.userId);
        await notify(submission.userId, "KYC_APPROVED", {
          kycLevel: submission.targetLevel,
        });
      } else {
        await notify(submission.userId, "KYC_REJECTED", {
          reviewNote: note,
        });
      }

      return { submission: reviewed };
    },
  );
};
