/**
 * Trip routes — the "I'm traveling and have bag space" side.
 *
 * Lifecycle: DRAFT → PUBLISHED → MATCHING → IN_PROGRESS → COMPLETED
 *             (or CANCELLED)
 *
 * A trip is created as PUBLISHED (visible to senders) unless saved as DRAFT.
 * currentWeightKg tracks how much capacity is consumed by matched parcels
 * and is updated whenever a parcel is matched/unmatched against this trip.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";

const asJson = (addr: unknown) => addr as Prisma.InputJsonValue;

// ── Validation ───────────────────────────────────────────────────────
const addressSchema = z.object({
  level: z.enum([
    "OFFICIAL_GEOCODE", "PIN_DROP", "POI_BASED",
    "LIVE_LOCATION", "HUMAN_RELAY",
  ]),
  label: z.string().min(3).max(200),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  country: z.string().length(2),
}).passthrough();

const createTripSchema = z.object({
  origin: addressSchema,
  destination: addressSchema,
  totalDistanceKm: z.number().positive(),
  estimatedDurationHours: z.number().positive().optional(),
  departureTime: z.string().datetime(),
  estimatedArrival: z.string().datetime().optional(),
  mode: z.enum(["FLIGHT", "FERRY", "BUS", "CAR", "TRUCK", "TRAIN"]),
  isFlexPlus12h: z.boolean().default(false),
  vehicleType: z.string().max(50).optional(),
  maxWeightKg: z.number().positive().max(500),
  maxVolumeM3: z.number().positive().optional(),
  maxDetourKm: z.number().int().min(0).max(500).default(50),
  pricePerKg: z.number().nonnegative().optional(),
  priceCurrency: z.enum(["EUR", "DZD", "USD", "CAD", "GBP"]).default("EUR"),
  isNegotiable: z.boolean().default(true),
  minPricePerKg: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  hasCooler: z.boolean().default(false),
  acceptsFragile: z.boolean().default(false),
  isDraft: z.boolean().default(false),
});

const updateTripSchema = createTripSchema.partial();

const listQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "MATCHING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  mode: z.enum(["FLIGHT", "FERRY", "BUS", "CAR", "TRUCK", "TRAIN"]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// ── Routes ───────────────────────────────────────────────────────────
export const tripRoutes: FastifyPluginAsync = async (app) => {
  // POST /trips — create a trip (traveler, authenticated)
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = createTripSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const input = parsed.data;
      const travelerId = req.user.sub;

      // Don't allow publishing a trip in the past
      const departure = new Date(input.departureTime);
      if (departure <= new Date() && !input.isDraft) {
        return reply.code(400).send({
          error: "Departure time must be in the future",
        });
      }

      const trip = await prisma.trip.create({
        data: {
          travelerId,
          origin: asJson(input.origin),
          destination: asJson(input.destination),
          totalDistanceKm: input.totalDistanceKm,
          estimatedDurationHours: input.estimatedDurationHours,
          departureTime: departure,
          estimatedArrival: input.estimatedArrival
            ? new Date(input.estimatedArrival)
            : undefined,
          mode: input.mode,
          isFlexPlus12h: input.isFlexPlus12h,
          vehicleType: input.vehicleType,
          maxWeightKg: input.maxWeightKg,
          maxVolumeM3: input.maxVolumeM3,
          maxDetourKm: input.maxDetourKm,
          pricePerKg: input.pricePerKg,
          priceCurrency: input.priceCurrency,
          isNegotiable: input.isNegotiable,
          minPricePerKg: input.minPricePerKg,
          notes: input.notes,
          hasCooler: input.hasCooler,
          acceptsFragile: input.acceptsFragile,
          status: input.isDraft ? "DRAFT" : "PUBLISHED",
          publishedAt: input.isDraft ? undefined : new Date(),
        },
      });

      return reply.code(201).send({ trip });
    },
  );

  // GET /trips — list (traveler sees own; senders see PUBLISHED)
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return { error: parsed.error.flatten() };
      }
      const { status, mode, limit, offset } = parsed.data;
      const travelerId = req.user.sub;

      const where =
        status === "PUBLISHED" || status === "MATCHING"
          ? {
              status: status as "PUBLISHED" | "MATCHING",
              ...(mode ? { mode } : {}),
            }
          : {
              travelerId,
              ...(status ? { status } : {}),
              ...(mode ? { mode } : {}),
            };

      const [trips, total] = await Promise.all([
        prisma.trip.findMany({
          where,
          orderBy: { departureTime: "asc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            origin: true,
            destination: true,
            departureTime: true,
            mode: true,
            maxWeightKg: true,
            currentWeightKg: true,
            pricePerKg: true,
            priceCurrency: true,
            status: true,
            traveler: {
              select: {
                id: true,
                firstName: true,
                trustScore: true,
                trustBadge: true,
                completedTrips: true,
              },
            },
          },
        }),
        prisma.trip.count({ where }),
      ]);

      return { trips, total, limit, offset };
    },
  );

  // GET /trips/:id — single trip detail
  app.get(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const trip = await prisma.trip.findUnique({
        where: { id },
        include: {
          traveler: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              trustScore: true,
              trustBadge: true,
              averageRating: true,
              completedTrips: true,
            },
          },
          parcels: {
            select: {
              id: true,
              description: true,
              weightKg: true,
              category: true,
              status: true,
            },
          },
        },
      });

      if (!trip) {
        return reply.code(404).send({ error: "Trip not found" });
      }
      if (trip.travelerId !== req.user.sub && trip.status === "DRAFT") {
        return reply.code(404).send({ error: "Trip not found" });
      }

      return { trip };
    },
  );

  // PATCH /trips/:id — update (traveler only, only if DRAFT or PUBLISHED)
  app.patch(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateTripSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const existing = await prisma.trip.findUnique({
        where: { id },
        select: { travelerId: true, status: true },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Trip not found" });
      }
      if (existing.travelerId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your trip" });
      }
      if (!["DRAFT", "PUBLISHED"].includes(existing.status)) {
        return reply.code(409).send({
          error: `Cannot edit a trip in status ${existing.status}`,
        });
      }

      const input = parsed.data;
      const trip = await prisma.trip.update({
        where: { id },
        data: {
          ...(input.origin && { origin: asJson(input.origin) }),
          ...(input.destination && {
            destination: asJson(input.destination),
          }),
          ...(input.departureTime && {
            departureTime: new Date(input.departureTime),
          }),
          ...(input.mode && { mode: input.mode }),
          ...(input.maxWeightKg && { maxWeightKg: input.maxWeightKg }),
          ...(input.pricePerKg !== undefined && { pricePerKg: input.pricePerKg }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.isDraft === false && {
            status: "PUBLISHED",
            publishedAt: new Date(),
          }),
        },
      });

      return { trip };
    },
  );

  // DELETE /trips/:id — cancel (traveler only, soft-delete to CANCELLED)
  app.delete(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.trip.findUnique({
        where: { id },
        select: { travelerId: true, status: true, currentWeightKg: true },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Trip not found" });
      }
      if (existing.travelerId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your trip" });
      }
      if (existing.status === "IN_PROGRESS") {
        return reply.code(409).send({
          error: "Cannot cancel a trip already in progress",
        });
      }
      // If parcels are matched, warn — they'll need to be re-matched
      if (existing.currentWeightKg > 0) {
        return reply.code(409).send({
          error: "Cannot cancel: parcels are matched to this trip. Unmatch them first.",
        });
      }

      const trip = await prisma.trip.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { trip };
    },
  );
};
