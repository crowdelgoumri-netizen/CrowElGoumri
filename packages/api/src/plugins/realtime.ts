/**
 * Realtime plugin — Socket.IO mounted on the Fastify HTTP server.
 *
 * Blueprint (F08) names Socket.IO as the chat transport. We avoid the
 * `fastify-socket.io` wrapper (its Fastify v5 support was shaky at the
 * time) and attach `socket.io` directly to `app.server` — the raw
 * `http.Server` Fastify exposes — so Socket.IO shares the existing HTTP
 * listener (no extra port). JWT auth is reused from `@fastify/jwt`.
 *
 * Wire format:
 *   Client → server
 *     thread:join   { parcelId }   join a parcel's chat room
 *     thread:leave  { parcelId }   leave it
 *   Server → client (broadcast to the parcel room)
 *     chat:message  { id, parcelId, senderId, body, attachments, createdAt }
 *     chat:read     { parcelId, userId, at }
 *
 * Authorization model: a socket may only join `parcel:<id>` if the user is
 * a participant (sender or matched traveler). `assertParcelParticipant`
 * (shared with the REST routes) is the single chokepoint. Once joined,
 * every broadcast to that room is implicitly trusted.
 *
 * Manual smoke test (documented for ops):
 *   1. Log in, grab the access token.
 *   2. Connect: io({ auth: { token } })
 *   3. socket.emit("thread:join", { parcelId }) on two clients for the same
 *      matched parcel → POST /chat/:parcelId from one → both receive
 *      "chat:message".
 */
import fp from "fastify-plugin";
import { Server, type Socket } from "socket.io";
import type { JWT } from "@fastify/jwt";
import { assertParcelParticipant, HttpError } from "../lib/chat-access.js";

// Room name convention: one room per parcel thread.
const roomFor = (parcelId: string) => `parcel:${parcelId}`;

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
    /** Push an event to every socket currently in a parcel's thread room. */
    broadcastToParcel: (
      parcelId: string,
      event: string,
      payload: unknown,
    ) => void;
  }
}

/**
 * Verify a bearer token with the shared JWT instance. Works outside a
 * request (sockets handshake before any HTTP route), so we call
 * app.jwt.verify directly rather than using the request decorator.
 */
function verifyToken(jwt: JWT, token: unknown): { sub: string; type?: string } {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("missing token");
  }
  const payload = jwt.verify<{ sub: string; type?: string }>(token);
  if (payload.type !== "access") throw new Error("not an access token");
  return payload;
}

export const realtimePlugin = fp(async (app) => {
  // Attach to the existing HTTP server — no new port, no new listener
  // lifecycle to manage. Socket.IO handles the /socket.io upgrade route.
  const io = new Server(app.server, {
    cors: { origin: true, credentials: true }, // mirror @fastify/cors dev policy
  });

  // ── Socket auth: runs once per connection, before any event handler. ──
  io.use((socket, next) => {
    try {
      // Clients should send the token via the `auth` handshake option
      // (preferred); fall back to the Authorization header for clients
      // that only speak HTTP headers.
      const token =
        socket.handshake.auth.token ??
        (socket.handshake.headers.authorization ?? "").replace(
          /^Bearer\s+/i,
          "",
        );
      const payload = verifyToken(app.jwt, token);
      socket.data.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  // ── Connection lifecycle ─────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId: string = socket.data.userId;

    socket.on("thread:join", async (raw, ack) => {
      const parcelId = (raw as { parcelId?: string })?.parcelId;
      try {
        if (!parcelId) throw new HttpError(400, "parcelId required");
        await assertParcelParticipant(parcelId, userId);
        await socket.join(roomFor(parcelId));
        ack?.({ ok: true });
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 500;
        ack?.({ ok: false, error: (err as Error).message, status });
      }
    });

    socket.on("thread:leave", (raw) => {
      const parcelId = (raw as { parcelId?: string })?.parcelId;
      if (parcelId) socket.leave(roomFor(parcelId));
    });
  });

  // Decorators — fp() so they're visible to routes registered after this.
  app.decorate("io", io);
  app.decorate(
    "broadcastToParcel",
    (parcelId: string, event: string, payload: unknown) => {
      io.to(roomFor(parcelId)).emit(event, payload);
    },
  );

  // Tear down with Fastify — don't leave the socket server dangling.
  app.addHook("onClose", async () => {
    io.close();
  });
}, {
  name: "@crowdshipping/realtime",
  fastify: "5.x",
});
