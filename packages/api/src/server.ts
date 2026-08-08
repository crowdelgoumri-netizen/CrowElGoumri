/**
 * CrowdShipping API — Fastify modular monolith entry point.
 *
 * v1 keeps every domain (auth, parcels, trips, matching, escrow, chat)
 * in a single process. Routes are grouped by plugin; we extract to
 * separate services only where real operational pain appears.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { parcelRoutes } from "./routes/parcels.js";
import { tripRoutes } from "./routes/trips.js";
import { matchingRoutes } from "./routes/matching.js";
import { escrowRoutes } from "./routes/escrow.js";

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

  // ── Plugins (auth must register before routes that use it) ───────
  await app.register(authPlugin);

  // Raw body capture, scoped to the Stripe webhook route only — every
  // other route pays nothing. Stripe's constructEvent needs the verbatim
  // request buffer to verify the signature.
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: null,
    runFirst: true,
    routes: ["/escrow/webhook", "/escrow/webhook/*"],
  });

  // ── Routes ───────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(meRoutes, { prefix: "/me" });
  await app.register(parcelRoutes, { prefix: "/parcels" });
  await app.register(tripRoutes, { prefix: "/trips" });
  await app.register(matchingRoutes, { prefix: "/matching" });
  await app.register(escrowRoutes, { prefix: "/escrow" });

  // Route groups to be registered as phases progress:
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
