/**
 * Idempotency plugin — deduplicates POST requests carrying an
 * Idempotency-Key header.
 *
 * Uses an in-memory Map with a 24 h TTL. On duplicate key the stored
 * response is replayed without re-running the route handler. Only
 * successful responses (status < 400) are cached — errors are never
 * replayed so the client can safely retry.
 *
 * SECURITY: the cache key is scoped to {userId}:{route}:{body hash}:{client
 * key}, never the client-supplied key alone. This hook is global (fp()) and
 * therefore runs BEFORE each route's own `{ preHandler: [app.authenticate] }`
 * — Fastify always runs instance-level hooks ahead of route-level ones — so
 * without scoping, any client could reuse or guess another user's
 * Idempotency-Key and have their cached (authenticated) response replayed
 * back, e.g. someone else's parcel/KYC data. We therefore verify the JWT
 * ourselves here to get the principal before touching the cache; requests
 * that fail verification skip idempotency entirely and fall through to the
 * route's own auth guard. The body hash additionally stops two distinct
 * requests that reuse the same client key by mistake from being conflated.
 *
 * No new dependencies — uses Node.js built-in crypto.
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
import { createHash } from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface CachedResponse {
  status: number;
  body: string;
  createdAt: number;
  inFlight: boolean;
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

function bodyHash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex").slice(0, 16);
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

    const clientKey = req.headers["idempotency-key"];
    if (typeof clientKey !== "string" || !clientKey) return;

    // Verify the principal ourselves — this hook runs before the route's own
    // auth guard. Unauthenticated requests skip idempotency entirely and
    // fall through to that guard, which will reject them normally.
    let userId: string;
    try {
      const decoded = await req.jwtVerify<{ sub: string }>();
      userId = decoded.sub;
    } catch {
      return;
    }

    const scopedKey = `${userId}:${req.routeOptions.url ?? req.url}:${bodyHash(req.body)}:${clientKey}`;

    const cached = cache.get(scopedKey);
    if (cached) {
      if (cached.inFlight) {
        // A duplicate arrived while the original is still being handled.
        reply.status(409).send({ error: "A request with this Idempotency-Key is already in progress" });
        return;
      }
      // Replay the stored response.
      reply
        .status(cached.status)
        .header("content-type", "application/json")
        .send(cached.body);
      return;
    }

    // Reserve the key so a concurrent duplicate gets 409, not a bypass.
    cache.set(scopedKey, { status: 0, body: "", createdAt: Date.now(), inFlight: true });
    req.idempotencyKey = scopedKey;
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
        inFlight: false,
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
