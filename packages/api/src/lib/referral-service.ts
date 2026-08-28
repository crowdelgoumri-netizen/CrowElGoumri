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

/** Marks a credit consumed against a specific escrow. Not reversible. */
export async function consumeReferralCredit(
  creditId: string,
  escrowId: string,
): Promise<void> {
  await prisma.referralCredit.update({
    where: { id: creditId },
    data: { consumedAt: new Date(), consumedEscrowId: escrowId },
  });
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
