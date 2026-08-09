/**
 * Trust service — persists the computed trust score + badge onto the User.
 *
 * The matching package computes trust on the fly from raw signals (KYC,
 * trips, ratings…). Those signals change over time, but the cached
 * User.trustScore / User.trustBadge columns — shown in parcel & trip
 * listings — only stay accurate if someone recomputes them after each
 * signal changes. This is that someone.
 *
 * Call recomputeTrustForUser(userId) after:
 *   - KYC level change (phone verify, admin approval)
 *   - a completed delivery / trip
 *   - a new rating
 *   - a ban / unban
 *
 * Before this existed, those columns stayed at 0/BRONZE forever even for
 * phone-verified users — the matching engine saw the right score (it
 * computes from raw signals) but every listing showed "0 🥉".
 */
import { prisma } from "@crowdshipping/db";
import {
  computeTrustScore,
  trustInputsFromUser,
  type TrustResult,
} from "@crowdshipping/matching";

/**
 * Recompute and persist a user's trust score + badge.
 * Returns the new TrustResult (or null if the user doesn't exist).
 */
export async function recomputeTrustForUser(
  userId: string,
): Promise<TrustResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      kycLevel: true,
      completedTrips: true,
      completedDeliveries: true,
      successRate: true,
      averageRating: true,
      createdAt: true,
      isBanned: true,
    },
  });
  if (!user) return null;

  const result = computeTrustScore(trustInputsFromUser(user));

  await prisma.user.update({
    where: { id: userId },
    data: {
      trustScore: result.score,
      trustBadge: result.badge,
    },
  });

  return result;
}
