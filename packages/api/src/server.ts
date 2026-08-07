/**
 * CrowdShipping API — Fastify modular monolith entry point.
 *
 * v1 keeps every domain (auth, parcels, trips, matching, escrow, chat)
 * in a single process. Routes are grouped by plugin; we extract to
 * separate services only where real operational pain appears.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";

async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ──────────────────────────────────────────────────────
  await app.register(cors, {
    origin: true, // dev: any origin. Tighten in production.
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "CrowdShipping API",
        description:
          "P2P parcel transport platform — connects senders with travelers for the France↔Algeria diaspora corridor.",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  // ── Routes ───────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: "/health" });

  // Route groups to be registered as phases progress:
  //   /auth        — Phase 1
  //   /parcels     — Phase 2
  //   /trips       — Phase 2
  //   /matching    — Phase 3
  //   /escrow      — Phase 4
  //   /chat        — Phase 5

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(
      `CrowdShipping API ready → http://${env.API_HOST}:${env.API_PORT}`,
    );
    app.log.info(`API docs       → http://${env.API_HOST}:${env.API_PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
