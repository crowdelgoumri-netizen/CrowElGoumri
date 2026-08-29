/**
 * Referral reward granting + credit ledger — the DB-touching half of the
 * referral feature (code generation is the pure half, lib/referral-code.ts).
 *
 * grantReferralReward() is called from two places that each know a user
 * just reached their first RELEASED escrow (escrow-service.ts, for sender
 * and traveler independently) — see the design spec's "Déclenchement de la
 * récompense" section for why the count check lives at the call site.
 */
import { prisma, Prisma } from "@crowdshipping/db";
import { notify } from "./notifications.js";

const REFERRAL_DISCOUNT_PCT = 50;

/** Oldest unconsumed credit for a user, or null. FIFO — see design spec. */
export async function findReferralCredit(
  userId: string,
): Promise<{ id: string; discountPct: Prisma.Decimal } | null> {
  return prisma.referralCredit.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, discountPct: true },
  });
}

/**
 * Marks a credit consumed against a specific escrow. Not reversible.
 *
 * Guarded on `consumedAt: null` so this is safe under concurrency: two
 * requests racing to consume the same credit (e.g. a sender funding two
 * different parcels in quick succession) will have exactly one `updateMany`
 * match and return `true`; the loser matches zero rows and returns `false`.
 * Callers MUST check the return value and treat `false` as "this credit was
 * already spent" rather than proceeding as if the discount is backed.
 *
 * Accepts an optional transaction client so callers can make this atomic
 * with the write that creates/updates the escrow row it references (e.g.
 * escrow.ts wraps the EscrowLedger upsert + this call in one
 * `prisma.$transaction`, so a mid-flight failure never leaves a funded,
 * discounted escrow with its backing credit still unconsumed). Defaults to
 * the shared client for callers that don't need transactional scoping.
 */
export async function consumeReferralCredit(
  creditId: string,
  escrowId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  const { count } = await db.referralCredit.updateMany({
    where: { id: creditId, consumedAt: null },
    data: { consumedAt: new Date(), consumedEscrowId: escrowId },
  });
  return count === 1;
}

/**
 * Grants the referral reward for a referee's first completed shipment.
 * Idempotent: the PENDING → REWARDED transition is filtered on `status:
 * PENDING`, so a second call (or a race between sender/traveler-side
 * triggers) is a guaranteed no-op past the first successful grant.
 * Safe to call for a user with no referrer — silently does nothing.
 */
export async function grantReferralReward(refereeId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== "PENDING") return;

  const updated = await prisma.referral.updateMany({
    where: { refereeId, status: "PENDING" },
    data: { status: "REWARDED", rewardedAt: new Date() },
  });
  if (updated.count === 0) return; // lost the race to a concurrent call

  await prisma.referralCredit.createMany({
    data: [
      { userId: referral.referrerId, discountPct: REFERRAL_DISCOUNT_PCT },
      { userId: referral.refereeId, discountPct: REFERRAL_DISCOUNT_PCT },
    ],
  });

  await Promise.all([
    notify(referral.referrerId, "REFERRAL_REWARDED_REFERRER", { discountPct: REFERRAL_DISCOUNT_PCT }),
    notify(referral.refereeId, "REFERRAL_REWARDED_REFEREE", { discountPct: REFERRAL_DISCOUNT_PCT }),
  ]);
}

/**
 * Fires the referral reward for a user's first-ever RELEASED escrow (as
 * either sender or traveler). Called from escrow-service.ts's
 * releaseEscrowForParcel() for both parties independently on every release —
 * grantReferralReward() itself no-ops for a user with no PENDING referral,
 * so it's cheap and safe to attempt unconditionally once the release count
 * is confirmed to be exactly 1.
 *
 * Extracted out of escrow-service.ts so the "first RELEASED escrow" trigger
 * is testable by seeding EscrowLedger rows directly via Prisma, without
 * crossing the Stripe boundary.
 *
 * Fire-and-forget by design (the release response must not block on this
 * side effect): errors are logged, never thrown.
 */
export async function maybeGrantFirstReleaseReward(userId: string): Promise<void> {
  try {
    const releasedCount = await prisma.escrowLedger.count({
      where: {
        status: "RELEASED",
        OR: [{ senderId: userId }, { travelerId: userId }],
      },
    });
    if (releasedCount === 1) await grantReferralReward(userId);
  } catch (err) {
    console.error(`referral reward check failed for user ${userId}:`, err);
  }
}
