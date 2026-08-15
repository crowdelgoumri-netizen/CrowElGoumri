/**
 * Idempotency plugin — deduplicates POST requests carrying an
 * Idempotency-Key header.
 *
 * Uses an in-memory Map with a 24 h TTL. On duplicate key the stored
 * response is replayed without re-running the route handler. Only
 * successful responses (status < 400) are cached — errors are never
 * replayed so the client can safely retry.
 *
 * No new dependencies — uses Node.js built-in crypto.randomUUID().
 *
 * Activation: the plugin is global (registered with fp()) but only
 * activates when the client sends an Idempotency-Key header on a POST.
 * Endpoints that should carry the key:
 *   POST /parcels, /trips, /trips/:id/checkpoint, /chat/:parcelId,
 *   /parcels/:id/delivery-pin, /parcels/:id/customs,
 *   /disputes, /ratings, /matching/accept, /kyc/submit
 *
 * Endpoints that must NOT carry the key (Stripe-touching, guarded
 * by their own idempotency): escrow/fund, /release, /refund,
 * /connect/onboarding, parcels/:id/deliver.
 */
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface CachedResponse {
  status: number;
  body: string;
  createdAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 min

const cache = new Map<string, CachedResponse>();

/** Decorator interface — makes req.idempotencyKey available in onSend. */
declare module "fastify" {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

async function idempotencyPlugin(app: FastifyInstance): Promise<void> {
  // Periodic sweep to prevent unbounded growth.
  const timer = setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    for (const [key, entry] of cache) {
      if (entry.createdAt < cutoff) cache.delete(key);
    }
  }, SWEEP_INTERVAL_MS);

  app.addHook("onClose", () => clearInterval(timer));

  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== "POST") return;

    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !key) return;

    const cached = cache.get(key);
    if (cached) {
      // Replay the stored response.
      reply
        .status(cached.status)
        .header("content-type", "application/json")
        .send(cached.body);
      return;
    }

    // Reserve the key so a concurrent duplicate doesn't bypass.
    cache.set(key, { status: 202, body: "", createdAt: Date.now() });
    req.idempotencyKey = key;
  });

  app.addHook("onSend", async (req: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    if (!req.idempotencyKey) return;

    // Only cache successful responses — let the client retry on errors.
    if (reply.statusCode < 400) {
      const body = typeof payload === "string" ? payload : JSON.stringify(payload);
      cache.set(req.idempotencyKey, {
        status: reply.statusCode,
        body,
        createdAt: Date.now(),
      });
    } else {
      // Error — remove the placeholder so the client can retry.
      cache.delete(req.idempotencyKey);
    }
  });
}

export default fp(idempotencyPlugin, {
  name: "idempotency-plugin",
});
