/**
 * Escrow release service — the money-out half of escrow, extracted from the
 * /escrow/:parcelId/release route so the delivery flow can trigger it on
 * DELIVERED without duplicating the Stripe-transfer logic.
 *
 * Splitting concerns:
 *   - The route does auth + HTTP response shaping.
 *   - This helper does the work: escrow lookup, traveler-account readiness
 *     check, Stripe Transfer, LOCKED → RELEASED transition.
 *
 * The Stripe Transfer is an external side effect and is deliberately NOT
 * wrapped in a transaction with the parcel-status commit. Order:
 *   1. Parcel status committed to DELIVERED (caller's job).
 *   2. This helper runs; if the transfer fails, the escrow stays LOCKED and
 *      is retryable — the state-machine guard makes release idempotent.
 * This avoids rolling back a real Stripe charge on a DB blip, or vice versa.
 *
 * Result is a discriminated union so callers can choose the right response:
 *   - "no-escrow" / "not-delivered" / "bad-state" → soft preconditions
 *   - "not-ready"      → traveler Connect account not onboarded for payouts
 *   - "transfer-failed"→ Stripe rejected; deliver anyway, payout retries
 *   - "released"       → full success
 */
import type { EscrowLedger } from "@crowdshipping/db";
import { prisma } from "@crowdshipping/db";
import { getStripe, toCents } from "./stripe.js";

type EscrowStatus = EscrowLedger["status"];

// Mirror the escrow route's transition map locally. We don't import it from
// routes/escrow.ts to avoid a routes ↔ lib cycle; the legal forward edges
// for RELEASED are stable and small.
const RELEASEABLE_FROM: EscrowStatus[] = ["LOCKED", "PARTIAL_RELEASE"];

export type ReleaseResult =
  | { kind: "released"; escrow: EscrowLedger; transferId: string }
  | { kind: "no-escrow" }
  | { kind: "not-delivered"; parcelStatus: string }
  | { kind: "bad-state"; escrowStatus: EscrowStatus }
  | { kind: "not-ready"; reason: string }
  | { kind: "transfer-failed"; error: string; escrow: EscrowLedger };

/**
 * Release the escrow for a parcel: transfer the net payout to the traveler's
 * Stripe Connect account and flip status to RELEASED. Safe to retry — if the
 * escrow is already RELEASED the state check short-circuits.
 */
export async function releaseEscrowForParcel(
  parcelId: string,
): Promise<ReleaseResult> {
  const escrow = await prisma.escrowLedger.findUnique({
    where: { parcelId },
    include: {
      parcel: {
        select: { status: true, matchedTrip: { select: { travelerId: true } } },
      },
    },
  });
  if (!escrow) return { kind: "no-escrow" };
  if (escrow.parcel.status !== "DELIVERED") {
    return { kind: "not-delivered", parcelStatus: escrow.parcel.status };
  }
  if (!RELEASEABLE_FROM.includes(escrow.status)) {
    return { kind: "bad-state", escrowStatus: escrow.status };
  }

  const travelerId = escrow.parcel.matchedTrip?.travelerId;
  if (!travelerId) return { kind: "not-ready", reason: "No matched traveler" };

  const traveler = await prisma.user.findUnique({
    where: { id: travelerId },
    select: { stripeAccountId: true, stripePayoutsEnabled: true },
  });
  if (!traveler?.stripeAccountId) {
    return { kind: "not-ready", reason: "Traveler has not started Connect onboarding" };
  }
  if (!traveler.stripePayoutsEnabled) {
    return { kind: "not-ready", reason: "Traveler Connect payouts not enabled" };
  }

  const stripe = getStripe();
  let transferId: string;
  try {
    const transfer = await stripe.transfers.create({
      amount: toCents(escrow.travelerPayout),
      currency: "eur",
      destination: traveler.stripeAccountId,
      // Separate charges & transfers: the sender was charged the full total
      // on funding; only the net travels to the traveler now, the fee stays
      // on the platform balance.
      metadata: { parcelId, escrowId: escrow.id },
    });
    transferId = transfer.id;
  } catch (err) {
    // Transfer rejected (e.g. traveler account restricted). Don't throw —
    // the parcel is delivered; surface to the caller so it can 200-with-
    // warning. The escrow stays LOCKED and the release can be retried.
    return {
      kind: "transfer-failed",
      error: (err as Error).message,
      escrow,
    };
  }

  const updated = await prisma.escrowLedger.update({
    where: { parcelId },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      stripeTransferId: transferId,
      payoutMethod: "LEMONWAY_WALLET", // placeholder until a CONNECT payout enum value exists
    },
  });

  return { kind: "released", escrow: updated, transferId };
}
