/**
 * Admin routes — platform-wide management endpoints.
 *
 * All routes require authenticate + requireAdmin (provisioned via DB, no
 * signup). Returns aggregated stats, user/parcel listings scoped to the
 * full platform (not filtered to the requesting user).
 *
 * Endpoints:
 *   GET  /admin/dashboard          aggregated platform stats
 *   GET  /admin/users              list all users (paginated, filterable)
 *   GET  /admin/users/:id          single user detail
 *   PATCH /admin/users/:id         ban/unban, change role
 *   GET  /admin/parcels            list all parcels (paginated, filterable)
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";
import { recomputeTrustForUser } from "../lib/trust-service.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const admin = { preHandler: [app.authenticate, app.requireAdmin] };

  // ── Dashboard ──────────────────────────────────────────────────────────

  app.get("/dashboard", admin, async (_req, _reply) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      userCount,
      newUsersWeek,
      parcelByStatus,
      tripByStatus,
      financials,
      openDisputes,
      pendingKyc,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { not: "ADMIN" } } }),
      prisma.user.count({
        where: { role: { not: "ADMIN" }, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.parcel.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.trip.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.escrowLedger.aggregate({
        _sum: {
          totalAmount: true,
          platformFee: true,
          travelerPayout: true,
        },
        where: { status: { in: ["LOCKED", "RELEASED"] } },
      }),
      prisma.dispute.count({
        where: { status: { in: ["OPENED", "MEDIATING", "ESCALATED"] } },
      }),
      prisma.kycSubmission.count({ where: { status: "PENDING" } }),
    ]);

    return {
      users: { total: userCount, newThisWeek: newUsersWeek },
      parcels: Object.fromEntries(
        parcelByStatus.map((r) => [r.status, r._count]),
      ),
      trips: Object.fromEntries(
        tripByStatus.map((r) => [r.status, r._count]),
      ),
      financials: {
        gmv: financials._sum.totalAmount ?? 0,
        platformFees: financials._sum.platformFee ?? 0,
        travelerPayouts: financials._sum.travelerPayout ?? 0,
      },
      openDisputes,
      pendingKyc,
    };
  });

  // ── Users ────────────────────────────────────────────────────────────

  const usersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    role: z.enum(["SENDER", "TRAVELER", "BOTH", "ADMIN", "AGENT"]).optional(),
    kycLevel: z.enum(["NONE", "BASIC", "ENHANCED", "FULL"]).optional(),
    banned: z.enum(["true", "false"]).optional(),
  });

  app.get("/users", admin, async (req, reply) => {
    const parsed = usersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { limit, offset, search, role, kycLevel, banned } = parsed.data;

    const where: Record<string, unknown> = {
      role: { not: "ADMIN" },
      ...(role && { role }),
      ...(kycLevel && { kycLevel }),
      ...(banned === "true"
        ? { isBanned: true }
        : banned === "false"
          ? { isBanned: false }
          : {}),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          kycLevel: true,
          isBanned: true,
          trustScore: true,
          createdAt: true,
          _count: {
            select: {
              sentParcels: true,
              travelerTrips: true,
              ratingsReceived: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, limit, offset };
  });

  app.get("/users/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        kycLevel: true,
        kycVerifiedAt: true,
        isBanned: true,
        trustScore: true,
        stripeAccountId: true,
        stripePayoutsEnabled: true,
        createdAt: true,
        _count: {
          select: {
            sentParcels: true,
            travelerTrips: true,
            ratingsReceived: true,
            ratingsGiven: true,
          },
        },
      },
    });

    if (!user) return reply.code(404).send({ error: "User not found" });

    const escrowSummary = await prisma.escrowLedger.aggregate({
      _sum: { totalAmount: true, travelerPayout: true },
      where: {
        OR: [{ senderId: id }, { travelerId: id }],
        status: "RELEASED",
      },
    });

    return {
      user,
      escrowSummary: {
        totalAsSender: escrowSummary._sum.totalAmount ?? 0,
        totalReceived: escrowSummary._sum.travelerPayout ?? 0,
      },
    };
  });

  const updateUserSchema = z.object({
    role: z.enum(["SENDER", "TRAVELER", "BOTH", "AGENT"]).optional(),
    isBanned: z.boolean().optional(),
  });

  app.patch("/users/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: "User not found" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.role && { role: parsed.data.role }),
        ...(parsed.data.isBanned !== undefined && { isBanned: parsed.data.isBanned }),
      },
      select: { id: true, role: true, isBanned: true, kycLevel: true },
    });

    if (parsed.data.role) {
      await recomputeTrustForUser(id);
    }

    return { user: updated };
  });

  // ── Parcels ──────────────────────────────────────────────────────────

  const parcelsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.string().optional(),
    category: z.string().optional(),
    search: z.string().optional(),
  });

  app.get("/parcels", admin, async (req, reply) => {
    const parsed = parcelsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { limit, offset, status, category, search } = parsed.data;

    const where: Record<string, unknown> = {
      ...(status && { status }),
      ...(category && { category }),
      ...(search && {
        description: { contains: search, mode: "insensitive" },
      }),
    };

    const [parcels, total] = await Promise.all([
      prisma.parcel.findMany({
        where,
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          matchedTrip: {
            include: {
              traveler: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.parcel.count({ where }),
    ]);

    return { parcels, total, limit, offset };
  });

  // GET /admin/campaigns — all campaigns regardless of status
  app.get("/campaigns", admin, async (req, reply) => {
    const q = z.object({
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    const { status, limit, offset } = q.data;

    const where = status ? { status } : {};
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          traveler: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);
    return { campaigns, total, limit, offset };
  });

  // PATCH /admin/campaigns/:id — feature or change status
  app.patch("/campaigns/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({
      featured: z.boolean().optional(),
      status:   z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });

    const updated = await prisma.campaign.update({ where: { id }, data: parsed.data });
    return { campaign: updated };
  });
};
