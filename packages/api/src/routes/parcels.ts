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
};
