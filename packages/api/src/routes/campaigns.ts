import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";

const MODES = ["FLIGHT", "FERRY", "BUS", "CAR", "TRUCK", "TRAIN"] as const;

const createSchema = z.object({
  title:         z.string().min(5).max(120),
  description:   z.string().max(2000).optional(),
  originCity:    z.string().min(2).max(100),
  originCountry: z.string().min(2).max(100),
  destWilayas:   z.array(z.string().min(1)).min(1),
  departureDate: z.string().datetime(),
  returnDate:    z.string().datetime().optional(),
  mode:          z.enum(MODES),
  capacityKg:    z.number().positive().max(1000),
  pricePerKg:    z.number().nonnegative(),
  expiresAt:     z.string().datetime().optional(),
});

const updateSchema = createSchema.partial().extend({
  status:   z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
});

const listSchema = z.object({
  originCountry: z.string().optional(),
  featured:      z.enum(["true", "false"]).optional(),
  limit:         z.coerce.number().min(1).max(50).default(20),
  offset:        z.coerce.number().min(0).default(0),
});

const travelerSelect = {
  id: true, firstName: true, displayName: true,
  avatarUrl: true, trustScore: true, trustBadge: true,
  completedDeliveries: true, averageRating: true,
} as const;

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  // GET /campaigns — public list of ACTIVE campaigns
  app.get("/", async (req, reply) => {
    const q = listSchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    const { originCountry, featured, limit, offset } = q.data;

    const where = {
      status: "ACTIVE" as const,
      ...(originCountry ? { originCountry: { contains: originCountry, mode: "insensitive" as const } } : {}),
      ...(featured === "true" ? { featured: true } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: [{ featured: "desc" }, { departureDate: "asc" }],
        skip: offset,
        take: limit,
        include: { traveler: { select: travelerSelect } },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { campaigns, total, limit, offset };
  });

  // POST /campaigns — create (authenticated)
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    const campaign = await prisma.campaign.create({
      data: {
        travelerId:    req.user.sub,
        title:         data.title,
        description:   data.description,
        originCity:    data.originCity,
        originCountry: data.originCountry,
        destWilayas:   data.destWilayas,
        departureDate: new Date(data.departureDate),
        returnDate:    data.returnDate ? new Date(data.returnDate) : null,
        mode:          data.mode,
        capacityKg:    data.capacityKg,
        pricePerKg:    data.pricePerKg,
        expiresAt:     data.expiresAt ? new Date(data.expiresAt) : null,
        status:        "ACTIVE",
      },
      include: { traveler: { select: travelerSelect } },
    });

    return reply.code(201).send({ campaign });
  });

  // GET /campaigns/:id — public detail
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { traveler: { select: travelerSelect } },
    });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });
    return { campaign };
  });

  // PATCH /campaigns/:id — owner updates, or admin can feature/archive
  app.patch("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.campaign.findUnique({ where: { id }, select: { travelerId: true } });
    if (!existing) return reply.code(404).send({ error: "Campaign not found" });

    const isOwner = existing.travelerId === req.user.sub;
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "AGENT";
    if (!isOwner && !isAdmin) return reply.code(403).send({ error: "Forbidden" });

    // Non-admins cannot change featured flag
    const data = { ...parsed.data };
    if (!isAdmin) delete data.featured;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        departureDate: data.departureDate ? new Date(data.departureDate) : undefined,
        returnDate:    data.returnDate    ? new Date(data.returnDate)    : undefined,
        expiresAt:     data.expiresAt     ? new Date(data.expiresAt)     : undefined,
      },
      include: { traveler: { select: travelerSelect } },
    });

    return { campaign };
  });

  // DELETE /campaigns/:id — owner archives
  app.delete("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.campaign.findUnique({ where: { id }, select: { travelerId: true } });
    if (!existing) return reply.code(404).send({ error: "Campaign not found" });
    if (existing.travelerId !== req.user.sub && req.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    await prisma.campaign.update({ where: { id }, data: { status: "ARCHIVED" } });
    return reply.code(204).send();
  });
};
