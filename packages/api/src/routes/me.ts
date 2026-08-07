/**
 * /me — protected route returning the authenticated user's profile.
 * Used to verify the JWT auth loop works end-to-end.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@crowdshipping/db";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          displayName: true,
          role: true,
          kycLevel: true,
          trustScore: true,
          trustBadge: true,
          completedTrips: true,
          completedDeliveries: true,
          averageRating: true,
          createdAt: true,
        },
      });
      if (!user) {
        throw new Error("Authenticated user not found in DB");
      }
      return { user };
    },
  );
};
