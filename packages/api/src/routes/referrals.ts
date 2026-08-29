/**
 * Referral read endpoint — a user's own code + the referrals they've made.
 * Writing (signup-time code assignment + Referral creation) lives in
 * auth.ts; this route is read-only.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@crowdshipping/db";

export const referralRoutes: FastifyPluginAsync = async (app) => {
  // GET /referrals/me — the caller's referral code + everyone they've referred.
  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const [user, referrals] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: req.user.sub },
        select: { referralCode: true },
      }),
      prisma.referral.findMany({
        where: { referrerId: req.user.sub },
        orderBy: { createdAt: "desc" },
        include: { referee: { select: { firstName: true } } },
      }),
    ]);

    return {
      referralCode: user.referralCode,
      referrals: referrals.map((r) => ({
        refereeFirstName: r.referee.firstName,
        status: r.status,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    };
  });
};
