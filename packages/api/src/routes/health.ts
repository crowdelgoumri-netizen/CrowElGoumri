/**
 * Health check routes.
 *   GET /health        — liveness (is the process up?)
 *   GET /health/ready  — readiness (is the DB reachable?)
 *
 * Deploy platforms (Fly.io, Railway) probe these to decide routing/rollbacks.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@crowdshipping/db";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness — process is up. No DB call (cheap, frequent probes).
  app.get("/", async () => ({
    status: "ok",
    service: "crowdshipping-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Readiness — can we serve real traffic? Checks DB connectivity.
  app.get("/ready", async (_req, reply) => {
    try {
      // Cheap round-trip query; works on Postgres/Neon with PostGIS.
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "reachable",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      app.log.error({ err }, "DB readiness check failed");
      reply.status(503);
      return {
        status: "degraded",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      };
    }
  });
};
