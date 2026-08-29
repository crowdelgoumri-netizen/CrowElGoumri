/**
 * CrowdShipping API — Fastify modular monolith entry point.
 *
 * v1 keeps every domain (auth, parcels, trips, matching, escrow, chat)
 * in a single process. Routes are grouped by plugin; we extract to
 * separate services only where real operational pain appears.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import { authPlugin } from "./plugins/auth.js";
import { adminPlugin } from "./plugins/admin.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { parcelRoutes } from "./routes/parcels.js";
import { tripRoutes } from "./routes/trips.js";
import { matchingRoutes } from "./routes/matching.js";
import { escrowRoutes } from "./routes/escrow.js";
import { chatRoutes } from "./routes/chat.js";
import { notificationRoutes } from "./routes/notifications.js";
import { kycRoutes } from "./routes/kyc.js";
import { disputeRoutes } from "./routes/disputes.js";
import { ratingRoutes } from "./routes/ratings.js";
import { referralRoutes } from "./routes/referrals.js";
import { uploadRoutes } from "./routes/uploads.js";
import { adminRoutes } from "./routes/admin.js";
import { realtimePlugin } from "./plugins/realtime.js";

export async function buildServer(): Promise<FastifyInstance> {
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
  // requireAdmin builds on authenticate's req.user — register after it.
  await app.register(adminPlugin);

  // Idempotency: deduplicates POST requests with Idempotency-Key header.
  // Registered after auth so req.user is available if handlers need it.
  await app.register(idempotencyPlugin);

  // Socket.IO, attached to the same HTTP server. Registered after auth so
  // the socket handshake can verify JWTs with the shared @fastify/jwt.
  await app.register(realtimePlugin);

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
  await app.register(chatRoutes, { prefix: "/chat" });
  await app.register(notificationRoutes, { prefix: "/notifications" });
  await app.register(kycRoutes, { prefix: "/kyc" });
  await app.register(disputeRoutes, { prefix: "/disputes" });
  await app.register(ratingRoutes, { prefix: "/ratings" });
  await app.register(referralRoutes, { prefix: "/referrals" });
  await app.register(uploadRoutes, { prefix: "/uploads" });
  await app.register(adminRoutes, { prefix: "/admin" });

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

// Auto-start only when run directly (not when imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start();
}
