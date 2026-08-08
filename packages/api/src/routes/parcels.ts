/**
 * Parcel routes — the "I want to send something" side of the marketplace.
 *
 * Lifecycle: DRAFT → PENDING_MATCH → MATCHED → AWAITING_PICKUP → IN_TRANSIT
 *             → AWAITING_DELIVERY → DELIVERED
 *             (or DISPUTED / CANCELLED / SEIZED at various points)
 *
 * A parcel is created as PENDING_MATCH (published, visible to travelers)
 * unless the sender explicitly saves it as DRAFT.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";
import { assertParcelTransition } from "../lib/lifecycle.js";
import {
  generateDeliveryPin,
  hashDeliveryPin,
  verifyDeliveryPin,
  AttemptTracker,
} from "../lib/delivery-pin.js";
import { releaseEscrowForParcel } from "../lib/escrow-service.js";
import { notify, type NotificationType } from "../lib/notifications.js";

// One in-memory attempt tracker per process. Single-process v1; a Redis-
// backed tracker ships with the multi-instance / notifications phase.
const pinAttempts = new AttemptTracker();

// Cast typed address objects into Prisma's JSON input type (they're validated
// by zod at the API boundary; Prisma stores them as Json regardless).
const asJson = (addr: unknown) => addr as Prisma.InputJsonValue;

// ── Validation ───────────────────────────────────────────────────────
// Address is a discriminated union on the `level` field. We validate the
// shape loosely here (the 5 variants differ); the mobile picker enforces
// the strict per-level contract before sending.
const addressSchema = z.object({
  level: z.enum([
    "OFFICIAL_GEOCODE",
    "PIN_DROP",
    "POI_BASED",
    "LIVE_LOCATION",
    "HUMAN_RELAY",
  ]),
  label: z.string().min(3).max(200),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  country: z.string().length(2), // ISO-3166 alpha-2
  // level-specific fields are loose-typed here; Prisma stores as Json
}).passthrough(); // allow extra fields (lat, lng, poiName, relayPhone...)

const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const createParcelSchema = z.object({
  description: z.string().min(10).max(2000),
  category: z.enum([
    "Electronics", "Clothing", "Medicine", "Documents",
    "Food", "Cosmetics", "Other",
  ]),
  subCategory: z.string().max(100).optional(),
  weightKg: z.number().positive().max(50, "max 50kg per parcel"),
  dimensionsCm: dimensionsSchema,
  estimatedValue: z.number().nonnegative(),
  valueCurrency: z.enum(["EUR", "DZD", "USD", "CAD", "GBP"]).default("EUR"),
  photoUrls: z.array(z.string().url()).max(5).default([]),
  invoiceUrl: z.string().url().optional(),
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  pickupNotes: z.string().max(1000).optional(),
  deliveryNotes: z.string().max(1000).optional(),
  urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  urgencyDeadline: z.string().datetime().optional(),
  offeredPrice: z.number().nonnegative().optional(),
  priceCurrency: z.enum(["EUR", "DZD", "USD", "CAD", "GBP"]).default("EUR"),
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().regex(/^\+\d{6,15}$/).optional(),
  isDraft: z.boolean().default(false),
});

const updateParcelSchema = createParcelSchema.partial();

const listQuerySchema = z.object({
  status: z.enum([
    "DRAFT", "PENDING_MATCH", "MATCHED", "AWAITING_PICKUP",
    "IN_TRANSIT", "DELIVERED", "CANCELLED",
  ]).optional(),
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// ── Routes ───────────────────────────────────────────────────────────
export const parcelRoutes: FastifyPluginAsync = async (app) => {
  // POST /parcels — create a new parcel (sender only, authenticated)
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = createParcelSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const input = parsed.data;
      const senderId = req.user.sub;

      const parcel = await prisma.parcel.create({
        data: {
          senderId,
          description: input.description,
          category: input.category,
          subCategory: input.subCategory,
          weightKg: input.weightKg,
          dimensionsCm: input.dimensionsCm,
          estimatedValue: input.estimatedValue,
          valueCurrency: input.valueCurrency,
          photoUrls: input.photoUrls,
          invoiceUrl: input.invoiceUrl,
          pickupAddress: asJson(input.pickupAddress),
          deliveryAddress: asJson(input.deliveryAddress),
          pickupNotes: input.pickupNotes,
          deliveryNotes: input.deliveryNotes,
          urgencyLevel: input.urgencyLevel,
          urgencyDeadline: input.urgencyDeadline
            ? new Date(input.urgencyDeadline)
            : undefined,
          offeredPrice: input.offeredPrice,
          priceCurrency: input.priceCurrency,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          status: input.isDraft ? "DRAFT" : "PENDING_MATCH",
        },
      });

      return reply.code(201).send({ parcel });
    },
  );

  // GET /parcels — list (sender sees own; travelers see PENDING_MATCH)
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return { error: parsed.error.flatten() };
      }
      const { status, category, limit, offset } = parsed.data;
      const senderId = req.user.sub;

      // Default: show this user's parcels. If status=PENDING_MATCH,
      // show the public marketplace feed (travelers browsing for parcels).
      const where =
        status === "PENDING_MATCH"
          ? { status: "PENDING_MATCH" as const, ...(category ? { category } : {}) }
          : { senderId, ...(status ? { status } : {}) };

      const [parcels, total] = await Promise.all([
        prisma.parcel.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            description: true,
            category: true,
            weightKg: true,
            pickupAddress: true,
            deliveryAddress: true,
            urgencyLevel: true,
            urgencyDeadline: true,
            offeredPrice: true,
            priceCurrency: true,
            status: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                firstName: true,
                trustScore: true,
                trustBadge: true,
                completedDeliveries: true,
              },
            },
          },
        }),
        prisma.parcel.count({ where }),
      ]);

      return { parcels, total, limit, offset };
    },
  );

  // GET /parcels/:id — single parcel detail
  app.get(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parcel = await prisma.parcel.findUnique({
        where: { id },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              trustScore: true,
              trustBadge: true,
              averageRating: true,
            },
          },
          matchedTrip: {
            select: {
              id: true,
              departureTime: true,
              mode: true,
              traveler: {
                select: { id: true, firstName: true, trustScore: true },
              },
            },
          },
        },
      });

      if (!parcel) {
        return reply.code(404).send({ error: "Parcel not found" });
      }

      // Visibility: sender sees everything; others see only non-DRAFT
      if (parcel.senderId !== req.user.sub && parcel.status === "DRAFT") {
        return reply.code(404).send({ error: "Parcel not found" });
      }

      return { parcel };
    },
  );

  // PATCH /parcels/:id — update (sender only, only if DRAFT or PENDING_MATCH)
  app.patch(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateParcelSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const existing = await prisma.parcel.findUnique({
        where: { id },
        select: { senderId: true, status: true },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Parcel not found" });
      }
      if (existing.senderId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your parcel" });
      }
      if (!["DRAFT", "PENDING_MATCH"].includes(existing.status)) {
        return reply.code(409).send({
          error: `Cannot edit a parcel in status ${existing.status}`,
        });
      }

      const input = parsed.data;
      const parcel = await prisma.parcel.update({
        where: { id },
        data: {
          ...(input.description && { description: input.description }),
          ...(input.category && { category: input.category }),
          ...(input.weightKg && { weightKg: input.weightKg }),
          ...(input.dimensionsCm && { dimensionsCm: input.dimensionsCm }),
          ...(input.estimatedValue && { estimatedValue: input.estimatedValue }),
          ...(input.photoUrls && { photoUrls: input.photoUrls }),
          ...(input.pickupAddress && {
            pickupAddress: asJson(input.pickupAddress),
          }),
          ...(input.deliveryAddress && {
            deliveryAddress: asJson(input.deliveryAddress),
          }),
          ...(input.urgencyLevel && { urgencyLevel: input.urgencyLevel }),
          ...(input.urgencyDeadline && {
            urgencyDeadline: new Date(input.urgencyDeadline),
          }),
          ...(input.offeredPrice !== undefined && {
            offeredPrice: input.offeredPrice,
          }),
          ...(input.isDraft === false && { status: "PENDING_MATCH" }),
        },
      });

      return { parcel };
    },
  );

  // DELETE /parcels/:id — cancel (sender only, soft-delete to CANCELLED)
  app.delete(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.parcel.findUnique({
        where: { id },
        select: { senderId: true, status: true },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Parcel not found" });
      }
      if (existing.senderId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your parcel" });
      }
      if (["IN_TRANSIT", "DELIVERED"].includes(existing.status)) {
        return reply.code(409).send({
          error: "Cannot cancel a parcel already in transit or delivered",
        });
      }

      const parcel = await prisma.parcel.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { parcel };
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // DELIVERY LIFECYCLE — Phase 6
  // Drives a matched parcel through pickup → in-transit → awaiting-delivery
  // → DELIVERED, the last step firing escrow release. The traveler owns
  // these transitions; the sender only generates the delivery PIN.
  // ═══════════════════════════════════════════════════════════════════

  // Shared guard for traveler-driven lifecycle steps: load the parcel with
  // its matched trip, verify the caller is the traveler, check the
  // transition is legal. Returns the row or sends an error reply.
  async function loadForTravelerStep(
    parcelId: string,
    travelerId: string,
    targetStatus: import("@crowdshipping/db").ParcelStatus,
    reply: import("fastify").FastifyReply,
  ) {
    const parcel = await prisma.parcel.findUnique({
      where: { id: parcelId },
      select: {
        id: true,
        senderId: true,
        status: true,
        matchedTrip: { select: { travelerId: true, status: true } },
      },
    });
    if (!parcel) {
      reply.code(404).send({ error: "Parcel not found" });
      return null;
    }
    if (parcel.matchedTrip?.travelerId !== travelerId) {
      reply.code(403).send({ error: "Not the traveler for this parcel" });
      return null;
    }
    if (!assertParcelTransition(parcel.status, targetStatus)) {
      reply.code(409).send({
        error: `Parcel cannot go ${parcel.status} → ${targetStatus}`,
      });
      return null;
    }
    return parcel;
  }

  // POST /parcels/:id/pickup — traveler confirms physical pickup.
  app.post(
    "/:id/pickup",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parcel = await loadForTravelerStep(id, req.user.sub, "AWAITING_PICKUP", reply);
      if (!parcel) return;

      const updated = await prisma.parcel.update({
        where: { id },
        data: { status: "AWAITING_PICKUP", pickedUpAt: new Date() },
      });
      await notify(parcel.senderId, "PARCEL_PICKED_UP" as NotificationType, { parcelId: id });
      return { parcel: updated };
    },
  );

  // POST /parcels/:id/in-transit — traveler marks the parcel en route.
  // Requires the trip to have departed (IN_PROGRESS).
  app.post(
    "/:id/in-transit",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parcel = await loadForTravelerStep(id, req.user.sub, "IN_TRANSIT", reply);
      if (!parcel) return;
      if (parcel.matchedTrip?.status !== "IN_PROGRESS") {
        return reply.code(409).send({
          error: `Trip must be IN_PROGRESS (is ${parcel.matchedTrip?.status})`,
        });
      }

      const updated = await prisma.parcel.update({
        where: { id },
        data: { status: "IN_TRANSIT" },
      });
      await notify(parcel.senderId, "IN_TRANSIT" as NotificationType, { parcelId: id });
      return { parcel: updated };
    },
  );

  // POST /parcels/:id/awaiting-delivery — traveler arrived at destination.
  app.post(
    "/:id/awaiting-delivery",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parcel = await loadForTravelerStep(
        id,
        req.user.sub,
        "AWAITING_DELIVERY",
        reply,
      );
      if (!parcel) return;

      const updated = await prisma.parcel.update({
        where: { id },
        data: { status: "AWAITING_DELIVERY" },
      });
      await notify(parcel.senderId, "AWAITING_DELIVERY" as NotificationType, { parcelId: id });
      return { parcel: updated };
    },
  );

  // POST /parcels/:id/delivery-pin — sender generates the 6-digit PIN.
  // Returns the plaintext PIN once; it's stored hashed. Regenerating
  // overwrites the hash, invalidating any previously-shared PIN.
  app.post(
    "/:id/delivery-pin",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parcel = await prisma.parcel.findUnique({
        where: { id },
        select: { senderId: true, status: true },
      });
      if (!parcel) return reply.code(404).send({ error: "Parcel not found" });
      if (parcel.senderId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your parcel" });
      }
      // PIN only makes sense once matched and before delivery.
      if (parcel.status === "DELIVERED") {
        return reply.code(409).send({ error: "Parcel already delivered" });
      }

      const pin = generateDeliveryPin();
      const pinHash = await hashDeliveryPin(pin);
      await prisma.parcel.update({
        where: { id },
        data: { deliveryPin: pinHash },
      });
      // Reset any lockout from a prior round of bad guesses.
      pinAttempts.recordSuccess(id);

      return { pin, hint: "Share this out-of-band with the recipient (e.g. WhatsApp)" };
    },
  );

  // POST /parcels/:id/deliver — traveler submits the PIN to confirm delivery.
  // On success: flips → DELIVERED and fires escrow release. The status commit
  // happens before the (external, retryable) Stripe transfer.
  const deliverSchema = z.object({
    pin: z.string().regex(/^\d{6}$/, "PIN must be 6 digits"),
  });

  app.post(
    "/:id/deliver",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = deliverSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const parcel = await loadForTravelerStep(id, req.user.sub, "DELIVERED", reply);
      if (!parcel) return;

      // Lockout check before touching the stored hash.
      if (pinAttempts.isLocked(id)) {
        return reply.code(429).send({ error: "Too many wrong PINs, try again later" });
      }

      // Fetch the stored hash separately — loadForTravelerStep doesn't
      // select it (keeps it out of the lifecycle-step responses).
      const { deliveryPin } = await prisma.parcel.findUniqueOrThrow({
        where: { id },
        select: { deliveryPin: true },
      });
      if (!deliveryPin) {
        return reply.code(409).send({
          error: "Sender has not generated a delivery PIN yet",
        });
      }

      const ok = await verifyDeliveryPin(parsed.data.pin, deliveryPin);
      if (!ok) {
        pinAttempts.recordFailure(id);
        return reply.code(401).send({
          error: "Invalid PIN",
          remainingAttempts: pinAttempts.remainingAttempts(id),
        });
      }
      pinAttempts.recordSuccess(id);

      // 1) Commit the delivery first. If anything after this fails, the
      //    parcel is still delivered — escrow release is retryable.
      const updated = await prisma.parcel.update({
        where: { id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });

      // Notify the sender their parcel landed — the most valuable
      // notification in the product. Best-effort; never blocks the response.
      notify(parcel.senderId, "DELIVERED" as NotificationType, { parcelId: id })
        .catch(() => { /* provider errors logged inside notify() */ });

      // 2) Fire escrow release. A soft-fail (traveler not yet onboarded for
      //    payouts, or Stripe hiccup) does NOT roll back delivery; we
      //    surface it as a warning on the response so the client knows the
      //    payout is pending.
      const release = await releaseEscrowForParcel(id);
      const payout =
        release.kind === "released"
          ? { status: "RELEASED", transferId: release.transferId }
          : release.kind === "no-escrow"
            ? { status: "NO_ESCROW" }
            : release.kind === "transfer-failed"
              ? { status: "TRANSFER_FAILED", error: release.error }
              : release.kind === "not-ready"
                ? { status: "PAYOUT_PENDING", reason: release.reason }
                : { status: release.kind };

      return { parcel: updated, payout };
    },
  );
};
