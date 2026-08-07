/**
 * Trust score computation — blueprint §1.5, the 8-factor weighted model.
 *
 * Returns a 0–100 score and the badge tier (BRONZE/SILVER/GOLD/PLATINUM).
 * Called when a user's trust needs recomputing (after KYC upgrade, after
 * a completed delivery, after a rating, after a ban).
 *
 * Factor weights (sum to 1.00):
 *   KYC level              20%
 *   Completed trips        15%
 *   Success rate           20%
 *   Average rating         15%
 *   Account age (>6mo)      5%
 *   Phone verified          5%
 *   Active insurance       10%
 *   Verified badge          5%
 *   Banned              -100 (override)
 */
import type { User } from "@crowdshipping/db";

export interface TrustInputs {
  kycLevel: "NONE" | "BASIC" | "ENHANCED" | "FULL";
  completedTrips: number;
  completedDeliveries: number;
  successRate: number; // 0.0–1.0
  averageRating: number; // 0.0–5.0
  createdAt: Date;
  hasActiveInsurance: boolean;
  hasVerifiedBadge: boolean;
  isBanned: boolean;
}

export interface TrustResult {
  score: number; // 0–100
  badge: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  factors: Record<string, number>; // per-factor breakdown for debugging/UI
}

const FACTOR_WEIGHTS = {
  kyc: 0.20,
  trips: 0.15,
  successRate: 0.20,
  rating: 0.15,
  accountAge: 0.05,
  phoneVerified: 0.05,
  insurance: 0.10,
  verifiedBadge: 0.05,
} as const;

const KYC_SCORES: Record<TrustInputs["kycLevel"], number> = {
  NONE: 0,
  BASIC: 0.33, // phone+email verified
  ENHANCED: 0.66, // ID + selfie
  FULL: 1.0,
};

export function computeTrustScore(input: TrustInputs): TrustResult {
  // Banned users are instantly 0, no matter their history.
  if (input.isBanned) {
    return { score: 0, badge: "BRONZE", factors: { banned: -100 } };
  }

  const isPhoneVerified = input.kycLevel !== "NONE";
  const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
  const isOldEnough = input.createdAt.getTime() < sixMonthsAgo;

  // Each factor normalized to 0–1
  const factors = {
    kyc: KYC_SCORES[input.kycLevel],
    trips: Math.min(1, input.completedTrips / 20), // caps at 20 trips
    successRate: input.successRate,
    rating: input.averageRating / 5, // 0–5 → 0–1
    accountAge: isOldEnough ? 1 : 0,
    phoneVerified: isPhoneVerified ? 1 : 0,
    insurance: input.hasActiveInsurance ? 1 : 0,
    verifiedBadge: input.hasVerifiedBadge ? 1 : 0,
  };

  const score = Math.round(
    100 *
      (FACTOR_WEIGHTS.kyc * factors.kyc +
        FACTOR_WEIGHTS.trips * factors.trips +
        FACTOR_WEIGHTS.successRate * factors.successRate +
        FACTOR_WEIGHTS.rating * factors.rating +
        FACTOR_WEIGHTS.accountAge * factors.accountAge +
        FACTOR_WEIGHTS.phoneVerified * factors.phoneVerified +
        FACTOR_WEIGHTS.insurance * factors.insurance +
        FACTOR_WEIGHTS.verifiedBadge * factors.verifiedBadge),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    badge: scoreToBadge(score),
    factors,
  };
}

export function scoreToBadge(score: number): TrustResult["badge"] {
  if (score >= 90) return "PLATINUM";
  if (score >= 70) return "GOLD";
  if (score >= 40) return "SILVER";
  return "BRONZE";
}

/**
 * Convenience: build TrustInputs from a Prisma User row.
 */
export function trustInputsFromUser(user: Pick<
  User,
  "kycLevel" | "completedTrips" | "completedDeliveries" |
  "successRate" | "averageRating" | "createdAt" | "isBanned"
>): TrustInputs {
  return {
    kycLevel: user.kycLevel,
    completedTrips: user.completedTrips,
    completedDeliveries: user.completedDeliveries,
    successRate: user.successRate,
    averageRating: user.averageRating,
    createdAt: user.createdAt,
    hasActiveInsurance: false, // insurance product deferred — always false in v1
    hasVerifiedBadge: false, // manual admin badge — always false in v1
    isBanned: user.isBanned,
  };
}
