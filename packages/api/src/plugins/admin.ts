/**
 * Admin guard — a preHandler decorator that rejects non-admin requests.
 *
 * Usage:
 *   app.get("/admin/...", { preHandler: [app.authenticate, app.requireAdmin] }, handler)
 *
 * Stacks after app.authenticate: authenticate populates req.user, then
 * requireAdmin checks req.user.role === "ADMIN". Admins are provisioned,
 * not self-served — there is no admin signup endpoint. To create one in
 * dev/seed, set a user's role to ADMIN via prisma studio or:
 *   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
 */
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    requireAdmin: (
      req: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>;
  }
}

export const adminPlugin = fp(async (app) => {
  app.decorate("requireAdmin", async (req, reply) => {
    // authenticate runs first in the preHandler chain; if it failed the
    // request never reaches here. So req.user is populated.
    if (req.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }
  });
}, {
  name: "@crowdshipping/admin",
  fastify: "5.x",
});
