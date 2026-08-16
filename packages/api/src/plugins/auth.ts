/**
 * Auth plugin — registers @fastify/jwt and exposes:
 *   - app.authenticate: a preHandler decorator that guards protected routes.
 *   - app.authenticateOptional: same, but proceeds as a guest when no valid
 *     token is present (public marketplace reads).
 *
 * Usage in a route:
 *   app.get("/me", { preHandler: [app.authenticate] }, handler)
 *
 * The handler then reads req.user.sub for the userId.
 */
import fp from "fastify-plugin";
import jwtPlugin from "@fastify/jwt";
import { env } from "../env.js";

// Augment Fastify types so req.user is typed after authenticate succeeds.
declare module "@fastify/jwt" {
  interface FastifyJWT {
    // role is optional — refresh tokens don't carry it
    payload: { sub: string; role?: string; type: string };
    user: { sub: string; role?: string; type: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
    /**
     * Populate req.user when a valid Bearer token is present, otherwise
     * continue as a guest (no 401). Handlers read it with
     * `(req.user as { sub?: string } | undefined)?.sub` since the JWT type
     * declares user as always-present but optional auth leaves it unset.
     */
    authenticateOptional: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  }
}

// fp() breaks encapsulation so the `authenticate` decorator is visible
// to every route plugin registered after this one, not just this scope.
export const authPlugin = fp(async (app: import("fastify").FastifyInstance) => {
  await app.register(jwtPlugin, {
    secret: env.JWT_SECRET,
  });

  // Decorator: verify the Authorization: Bearer <token> header.
  // On success, req.user is populated. On failure, 401 is sent.
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify();
      // Reject refresh tokens used as access tokens
      if (req.user.type !== "access") {
        reply.code(401).send({ error: "Invalid token type" });
      }
    } catch {
      reply.code(401).send({ error: "Missing or invalid token" });
    }
  });

  // Decorator: same verification, but a missing/invalid token is not an
  // error — the request simply proceeds unauthenticated (guest browsing).
  // A wrong token type (refresh token) is also treated as anonymous so the
  // route's own ownership checks decide, not the token kind.
  app.decorate("authenticateOptional", async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      await req.jwtVerify();
      if (req.user.type !== "access") {
        (req as { user?: unknown }).user = undefined;
      }
    } catch {
      // invalid/expired token → anonymous, not a 401
    }
  });
}, {
  name: "@crowdshipping/auth",
  fastify: "5.x",
});
