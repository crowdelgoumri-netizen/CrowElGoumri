/**
 * Escrow routes — Stripe Connect money flow (blueprint §3.3, Scenario A).
 *
 * State machine:
 *   FUNDED → LOCKED → RELEASED        (happy path: paid → delivered)
 *   FUNDED → REFUNDED_SENDER          (sender cancels before funding clears)
 *   LOCKED → REFUNDED_SENDER          (cancel before pickup / dispute)
 *
 * Endpoints:
 *   POST   /escrow/:parcelId/fund              sender creates PaymentIntent
 *   GET    /escrow/:parcelId                   escrow state + breakdown
 *   POST   /escrow/webhook                     Stripe → state machine (public)
 *   POST   /escrow/connect/onboarding          traveler Connect Express link
 *   GET    /escrow/connect/status              traveler payouts-enabled check
 *   POST   /escrow/:parcelId/release           transfer payout on delivery
 *   POST   /escrow/:parcelId/refund            refund to sender (pre-transit)
 *
 * Dev webhook testing:
 *   stripe listen --forward-to localhost:4000/escrow/webhook
 *   (put the printed whsec_... in STRIPE_WEBHOOK_SECRET)
 *   stripe trigger payment_intent.succeeded   → drives FUNDED → LOCKED
 *
 * v1 scope: EUR only on the Stripe path. DZD/COD (Scenario C) and LemonWay
 * escrow wallets are deferred — the schema columns stay reserved.
 */
import type { FastifyPluginAsync } from "fastify";
import type Stripe from "stripe";
import { prisma, Prisma } from "@crowdshipping/db";
import { env } from "../env.js";
import {
  getStripe,
  toCents,
  computePayoutBreakdown,
} from "../lib/stripe.js";
import { releaseEscrowForParcel } from "../lib/escrow-service.js";
import { notify } from "../lib/notifications.js";

// ── Escrow state machine ─────────────────────────────────────────────
type EscrowStatus =
  | "FUNDED"
  | "LOCKED"
  | "PARTIAL_RELEASE"
  | "RELEASED"
  | "REFUNDED_SENDER"
  | "REFUNDED_INSURANCE";

// Allowed forward transitions. Anything else is a 409.
const TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  FUNDED: ["LOCKED", "REFUNDED_SENDER"],
  LOCKED: ["RELEASED", "PARTIAL_RELEASE", "REFUNDED_SENDER"],
  PARTIAL_RELEASE: ["RELEASED"],
  RELEASED: [],
  REFUNDED_SENDER: [],
  REFUNDED_INSURANCE: [],
};

function assertTransition(from: EscrowStatus, to: EscrowStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Shared lookup: escrow + parcel + parties in one shot ─────────────
async function loadEscrowContext(parcelId: string) {
  return prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      id: true,
      senderId: true,
      status: true,
      priceCurrency: true,
      offeredPrice: true,
      weightKg: true,
      matchedTripId: true,
      matchedTrip: {
        select: {
          travelerId: true,
          pricePerKg: true,
          maxWeightKg: true,
          currentWeightKg: true,
        },
      },
      escrow: true,
    },
  });
}

/**
 * Resolve the traveler price for this parcel. Uses the sender's offeredPrice
 * when set (a flat fee the traveler implicitly accepted by matching); falls
 * back to pricePerKg × weight otherwise. Throws if neither yields a value.
 */
function resolveTravelerPrice(parcel: {
  offeredPrice: Prisma.Decimal | null;
  weightKg: number;
  matchedTrip: { pricePerKg: number | null } | null;
}): number {
  if (parcel.offeredPrice) return Number(parcel.offeredPrice);
  const perKg = parcel.matchedTrip?.pricePerKg;
  if (perKg != null) return perKg * parcel.weightKg;
  throw new Error("Parcel has neither offeredPrice nor trip pricePerKg");
}

// ── Routes ───────────────────────────────────────────────────────────
export const escrowRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /escrow/:parcelId/fund — sender funds the escrow ──────────
  app.post(
    "/:parcelId/fund",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      const ctx = await loadEscrowContext(parcelId);

      if (!ctx) return reply.code(404).send({ error: "Parcel not found" });
      if (ctx.senderId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your parcel" });
      }
      if (ctx.status !== "MATCHED") {
        return reply.code(409).send({
          error: `Parcel must be MATCHED to fund (is ${ctx.status})`,
        });
      }
      if (ctx.priceCurrency !== "EUR") {
        // v1: Stripe path is EUR-only. DZD/COD is a separate phase.
        return reply.code(400).send({
          error: `Currency ${ctx.priceCurrency} not supported by Stripe escrow in v1 (EUR only)`,
        });
      }

      const travelerPrice = resolveTravelerPrice(ctx);
      const breakdown = computePayoutBreakdown(travelerPrice);

      // Idempotent: if an escrow + PaymentIntent already exists, return its
      // client_secret instead of creating a second charge.
      if (ctx.escrow?.stripePaymentIntentId) {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(
          ctx.escrow.stripePaymentIntentId,
        );
        // Only return a usable secret while the intent is still confirmable.
        if (!["succeeded", "canceled"].includes(intent.status)) {
          return {
            escrowId: ctx.escrow.id,
            clientSecret: intent.client_secret,
            status: ctx.escrow.status,
            breakdown,
          };
        }
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: toCents(breakdown.totalAmount),
        currency: "eur",
        // 3D-Secure / SCA: Stripe handles the redirect flow automatically
        // based on the card's regulation; the mobile SDK surfaces any
        // authentication step via the returned client_secret.
        automatic_payment_methods: { enabled: true },
        metadata: {
          parcelId,
          senderId: ctx.senderId,
          travelerId: ctx.matchedTrip?.travelerId ?? "",
        },
      });

      // Upsert the ledger row. Status starts at FUNDED; the webhook flips
      // it to LOCKED once payment_intent.succeeded arrives.
      const escrow = await prisma.escrowLedger.upsert({
        where: { parcelId },
        create: {
          parcelId,
          senderId: ctx.senderId,
          travelerId: ctx.matchedTrip!.travelerId,
          status: "FUNDED",
          totalAmount: breakdown.totalAmount,
          currency: "EUR",
          platformFee: breakdown.platformFee,
          insuranceFee: breakdown.insuranceFee || null,
          travelerPayout: breakdown.travelerPayout,
          fundingMethod: "CREDIT_CARD_STRIPE",
          fundedAt: new Date(),
          stripePaymentIntentId: intent.id,
        },
        update: {
          // Re-funding after a canceled intent: attach the new intent + reset.
          status: "FUNDED",
          totalAmount: breakdown.totalAmount,
          platformFee: breakdown.platformFee,
          insuranceFee: breakdown.insuranceFee || null,
          travelerPayout: breakdown.travelerPayout,
          stripePaymentIntentId: intent.id,
          stripeTransferId: null,
          fundedAt: new Date(),
          lockedAt: null,
          releasedAt: null,
          refundedAt: null,
        },
      });

      return reply.code(201).send({
        escrowId: escrow.id,
        clientSecret: intent.client_secret,
        status: escrow.status,
        breakdown,
      });
    },
  );

  // ── GET /escrow/:parcelId — escrow state ───────────────────────────
  app.get(
    "/:parcelId",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      const escrow = await prisma.escrowLedger.findUnique({
        where: { parcelId },
        include: { parcel: { select: { senderId: true, matchedTrip: { select: { travelerId: true } } } } },
      });
      if (!escrow) return reply.code(404).send({ error: "No escrow for this parcel" });

      // Only the two parties may view the money details.
      const travelerId = escrow.parcel.matchedTrip?.travelerId;
      if (req.user.sub !== escrow.senderId && req.user.sub !== travelerId) {
        return reply.code(403).send({ error: "Not a party to this escrow" });
      }
      return {
        escrow: {
          ...escrow,
          totalAmount: Number(escrow.totalAmount),
          platformFee: Number(escrow.platformFee),
          insuranceFee: escrow.insuranceFee ? Number(escrow.insuranceFee) : null,
          travelerPayout: Number(escrow.travelerPayout),
        },
      };
    },
  );

  // ── POST /escrow/webhook — Stripe → state machine (PUBLIC) ─────────
  // Registered BEFORE the authed routes below; rawBody is populated by the
  // fastify-raw-body plugin registered in server.ts (scoped to this path).
  app.post("/webhook", async (req, reply) => {
    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      return reply.code(400).send({ error: "Missing stripe-signature header" });
    }
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!raw) {
      // Misconfiguration — raw-body plugin didn't capture this route.
      req.log.error("escrow webhook: rawBody missing");
      return reply.code(500).send({ error: "Webhook misconfigured" });
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        raw,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "stripe webhook signature mismatch");
      return reply.code(400).send({ error: "Invalid signature" });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const parcelId = pi.metadata?.parcelId;
        if (!parcelId) break;
        // Idempotent: only advance FUNDED → LOCKED; ignore replays.
        await prisma.escrowLedger.updateMany({
          where: { parcelId, status: "FUNDED" },
          data: { status: "LOCKED", lockedAt: new Date() },
        });
        // Notify the sender their payment is secured. Best-effort — the
        // webhook must return 200 fast regardless of notification outcome.
        // notify() swallows provider errors internally, so this won't throw.
        const escrow = await prisma.escrowLedger.findUnique({
          where: { parcelId },
          select: { senderId: true, totalAmount: true, currency: true },
        });
        if (escrow) {
          notify(escrow.senderId, "ESCROW_FUNDED", {
            parcelId,
            amount: Number(escrow.totalAmount),
            currency: escrow.currency,
          }).catch((e) => req.log.warn({ err: String(e) }, "ESCROW_FUNDED notify failed"));
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = charge.payment_intent as string;
        await prisma.escrowLedger.updateMany({
          where: { stripePaymentIntentId: piId, status: { in: ["FUNDED", "LOCKED"] } },
          data: { status: "REFUNDED_SENDER", refundedAt: new Date() },
        });
        break;
      }
      default:
        // Unhandled event — acknowledge so Stripe doesn't retry, but log
        // for observability.
        req.log.debug({ type: event.type }, "stripe webhook: unhandled event");
    }

    // Always 200: returning non-2xx makes Stripe retry the event.
    return reply.send({ received: true });
  });

  // ── POST /escrow/connect/onboarding — traveler Connect Express ─────
  app.post(
    "/connect/onboarding",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = req.user.sub;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeAccountId: true, email: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const stripe = getStripe();
      let accountId = user.stripeAccountId;

      // Create a Connect Express account once; reuse on subsequent calls.
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          email: user.email,
          metadata: { userId },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { stripeAccountId: account.id },
        });
        accountId = account.id;
      }

      // Account Links are single-use and expire (~10 min); generate fresh
      // each time the traveler re-enters the onboarding flow.
      const origin = req.headers.origin ?? `http://${env.API_HOST}:${env.API_PORT}`;
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/escrow/connect/refresh`,
        return_url: `${origin}/escrow/connect/return`,
        type: "account_onboarding",
      });

      return { url: link.url, accountId };
    },
  );

  // ── GET /escrow/connect/status — payouts-enabled check ────────────
  app.get(
    "/connect/status",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { stripeAccountId: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!user.stripeAccountId) {
        return { onboardingComplete: false, payoutsEnabled: false };
      }

      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(user.stripeAccountId);
      const payoutsEnabled = account.payouts_enabled;

      // Keep the cached flag fresh so the release guard can trust it
      // without an extra Stripe round-trip per release.
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { stripePayoutsEnabled: payoutsEnabled },
      });

      return {
        accountId: user.stripeAccountId,
        onboardingComplete: account.details_submitted,
        payoutsEnabled,
        requirements: account.requirements?.currently_due ?? [],
      };
    },
  );

  // ── POST /escrow/:parcelId/release — pay out the traveler ──────────
  // Manual release (admin/traveler). Automatic release on DELIVERED is
  // driven by the delivery route, which calls releaseEscrowForParcel
  // directly — this endpoint is the manual override + retry path.
  app.post(
    "/:parcelId/release",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };

      // Authorization check first: only the matched traveler or an admin
      // may trigger a release. The helper below is auth-agnostic so it can
      // be reused by the delivery flow.
      const escrow = await prisma.escrowLedger.findUnique({
        where: { parcelId },
        include: {
          parcel: { select: { matchedTrip: { select: { travelerId: true } } } },
        },
      });
      if (!escrow) return reply.code(404).send({ error: "No escrow for this parcel" });
      const travelerId = escrow.parcel.matchedTrip?.travelerId;
      if (req.user.sub !== travelerId && req.user.role !== "ADMIN") {
        return reply.code(403).send({ error: "Not authorized to release" });
      }

      const result = await releaseEscrowForParcel(parcelId);
      switch (result.kind) {
        case "released":
          return { escrow: result.escrow };
        case "no-escrow":
          return reply.code(404).send({ error: "No escrow for this parcel" });
        case "not-delivered":
          return reply.code(409).send({
            error: `Parcel must be DELIVERED to release (is ${result.parcelStatus})`,
          });
        case "bad-state":
          return reply.code(409).send({
            error: `Escrow ${result.escrowStatus} cannot transition to RELEASED`,
          });
        case "not-ready":
          return reply.code(409).send({ error: result.reason });
        case "transfer-failed":
          // The Stripe transfer failed, but the parcel is delivered. Surface
          // a retryable error rather than masking it as success.
          req.log.error(
            { parcelId, err: result.error },
            "escrow release: Stripe transfer failed",
          );
          return reply.code(502).send({
            error: "Payout transfer failed; parcel is delivered, retry release",
          });
      }
    },
  );

  // ── POST /escrow/:parcelId/refund — sender cancels pre-transit ─────
  app.post(
    "/:parcelId/refund",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      const escrow = await prisma.escrowLedger.findUnique({
        where: { parcelId },
        include: { parcel: { select: { senderId: true, status: true } } },
      });
      if (!escrow) return reply.code(404).send({ error: "No escrow for this parcel" });
      if (escrow.parcel.senderId !== req.user.sub) {
        return reply.code(403).send({ error: "Only the sender can refund" });
      }
      // Refunds only make sense before the parcel is physically moving.
      if (["IN_TRANSIT", "AWAITING_DELIVERY", "DELIVERED"].includes(escrow.parcel.status)) {
        return reply.code(409).send({
          error: `Cannot refund a parcel already ${escrow.parcel.status}`,
        });
      }
      const from = escrow.status as EscrowStatus;
      if (!assertTransition(from, "REFUNDED_SENDER")) {
        return reply.code(409).send({ error: `Escrow ${from} cannot be refunded` });
      }
      if (!escrow.stripePaymentIntentId) {
        return reply.code(409).send({ error: "No payment to refund" });
      }

      const stripe = getStripe();
      // Refund the latest charge on the intent. Stripe collapses multiple
      // refunds; refunding an already-refunded charge returns the existing one.
      const charge = await stripe.charges.list({
        payment_intent: escrow.stripePaymentIntentId,
        limit: 1,
      });
      if (charge.data.length === 0) {
        return reply.code(409).send({ error: "Payment has not settled yet" });
      }
      await stripe.refunds.create({
        charge: charge.data[0].id,
        metadata: { parcelId, escrowId: escrow.id },
      });

      // The webhook's charge.refunded handler will also no-op this update;
      // doing it here makes the API response immediately consistent.
      const updated = await prisma.escrowLedger.update({
        where: { parcelId },
        data: { status: "REFUNDED_SENDER", refundedAt: new Date() },
      });

      // Sender initiated this refund; let them know it landed.
      await notify(escrow.senderId, "ESCROW_REFUNDED", {
        parcelId,
        amount: Number(updated.totalAmount),
        currency: updated.currency,
      });

      return { escrow: updated };
    },
  );
};
