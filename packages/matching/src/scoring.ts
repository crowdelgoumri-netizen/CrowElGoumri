/**
 * Matching engine — blueprint §1.4, the 8-factor weighted scoring function.
 *
 * Score(p, t) = w1·S_route + w2·S_capacity + w3·S_trust + w4·S_urgency
 *             + w5·S_compatibility + w6·S_price + w7·S_history + w8·S_risk
 *
 * Each sub-score normalized to [0, 1]. Final score × 100 → [0, 100].
 * Score < 30 = "not recommended" (filtered out of results).
 *
 * Hard constraints (return 0 — eliminated):
 *   - traveler not at least BASIC KYC
 *   - insufficient remaining capacity
 *   - departure after urgency deadline
 *   - parcel category in traveler's blocked categories
 *   - pickup/delivery not within traveler's maxDetourKm of their route
 */
import type { LatLng } from "./geo.js";
import { estimateDetourKm } from "./geo.js";
import type { TrustResult } from "./trust.js";

// ── Types ────────────────────────────────────────────────────────────
/** Minimal shape we need from a Parcel to score it. */
export interface MatchableParcel {
  id: string;
  weightKg: number;
  category: string;
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgencyDeadline: Date | null;
  offeredPrice: number | null;
  pickup: LatLng | null; // null if address has no coords (HUMAN_RELAY)
  delivery: LatLng | null;
}

/** Minimal shape we need from a Trip+Traveler to score against. */
export interface MatchableTrip {
  id: string;
  travelerId: string;
  origin: LatLng | null;
  destination: LatLng | null;
  departureTime: Date;
  estimatedArrival: Date | null;
  maxWeightKg: number;
  currentWeightKg: number;
  maxDetourKm: number;
  pricePerKg: number | null;
  blockedCategories: string[];
  trust: TrustResult;
  completedTrips: number;
  completedDeliveries: number;
  successRate: number; // 0–1
  fraudRiskScore: number; // 0–1 (0 = safe); stubbed 0 in v1
}

export interface MatchScore {
  tripId: string;
  travelerId: string;
  score: number; // 0–100
  detourKm: number;
  estimatedPrice: number | null;
  estimatedArrival: Date | null;
  factors: Record<string, number>; // per-subscore breakdown for UI badges
  reasons: string[]; // human-readable badges: "Trusted traveler", "Arrives on time"
}

// ── Weights (sum to 1.00) — blueprint §1.4 ───────────────────────────
const WEIGHTS = {
  route: 0.20,
  capacity: 0.15,
  trust: 0.20,
  urgency: 0.10,
  compatibility: 0.08,
  price: 0.12,
  history: 0.10,
  risk: 0.05,
} as const;

const MIN_RECOMMENDATION_SCORE = 30;
const URGENCY_BUFFER_HOURS = 6;

// ── Core scoring function ────────────────────────────────────────────
export function computeMatchScore(
  parcel: MatchableParcel,
  trip: MatchableTrip,
): MatchScore | null {
  const reasons: string[] = [];

  // ── HARD CONSTRAINTS (elimination) ───────────────────────────────
  if (trip.trust.score === 0 || trip.trust.badge === "BRONZE" && trip.trust.score < 10) {
    return null; // unverified or near-banned traveler
  }
  const remainingCapacity = trip.maxWeightKg - trip.currentWeightKg;
  if (remainingCapacity < parcel.weightKg) return null;

  if (
    parcel.urgencyDeadline &&
    trip.departureTime > parcel.urgencyDeadline
  ) {
    return null; // leaves too late
  }
  if (trip.blockedCategories.includes(parcel.category)) return null;

  // Route compatibility — need coords on both sides. If either is
  // coordinate-less (HUMAN_RELAY address), we can't score detour, so we
  // skip the hard filter and degrade S_route to neutral (0.5).
  let detourKm = 0;
  let canScoreRoute = false;
  if (
    trip.origin && trip.destination &&
    parcel.pickup && parcel.delivery
  ) {
    canScoreRoute = true;
    detourKm = estimateDetourKm(
      trip.origin, trip.destination, parcel.pickup, parcel.delivery,
    );
    if (detourKm > trip.maxDetourKm) return null; // too far off-route
  }

  // ── SOFT SCORING ────────────────────────────────────────────────

  // S_route: detour penalty (0 = max detour, 1 = perfectly on route)
  const S_route = canScoreRoute
    ? Math.max(0, 1 - detourKm / Math.max(1, trip.maxDetourKm))
    : 0.5; // neutral when we can't measure
  if (S_route > 0.8) reasons.push("On your route");

  // S_capacity: how much room is left after this parcel
  const S_capacity = (remainingCapacity - parcel.weightKg) / remainingCapacity;

  // S_trust: the traveler's composite trust score
  const S_trust = trip.trust.score / 100;
  if (S_trust > 0.7) reasons.push("Trusted traveler");
  if (trip.trust.badge === "PLATINUM") reasons.push("Ambassador");

  // S_urgency: does the traveler arrive in time?
  let S_urgency = 0.5;
  if (trip.estimatedArrival && parcel.urgencyDeadline) {
    const bufferMs = URGENCY_BUFFER_HOURS * 60 * 60 * 1000;
    if (trip.estimatedArrival.getTime() <= parcel.urgencyDeadline.getTime() - bufferMs) {
      S_urgency = 1.0;
      reasons.push("Arrives on time");
    } else if (trip.estimatedArrival <= parcel.urgencyDeadline) {
      S_urgency = 0.5;
    } else {
      S_urgency = 0.0;
    }
  } else if (!parcel.urgencyDeadline) {
    S_urgency = 0.7; // no deadline = relaxed
  }

  // S_compatibility: has the traveler moved this category before?
  // With no history (new traveler), neutral 0.5. With history, weighted.
  const S_compatibility =
    trip.completedDeliveries > 0
      ? 0.5 // placeholder until we track per-category counts (v1.1)
      : 0.5;

  // S_price: how close is the traveler's price to the sender's offer?
  let S_price = 0.5;
  let estimatedPrice: number | null = null;
  if (trip.pricePerKg !== null && parcel.offeredPrice !== null) {
    estimatedPrice = trip.pricePerKg * parcel.weightKg;
    const priceDiff = Math.abs(estimatedPrice - parcel.offeredPrice);
    S_price = parcel.offeredPrice > 0
      ? Math.max(0, 1 - priceDiff / parcel.offeredPrice)
      : 0.5;
    if (S_price > 0.85) reasons.push("Great price match");
  }

  // S_history: traveler's historical success rate
  const S_history = trip.completedTrips > 0 ? trip.successRate : 0.5;

  // S_risk: inverse fraud risk (1 = safe, 0 = risky)
  const S_risk = 1 - trip.fraudRiskScore;

  // ── WEIGHTED COMBINATION ────────────────────────────────────────
  const score = Math.round(
    100 *
      (WEIGHTS.route * S_route +
        WEIGHTS.capacity * S_capacity +
        WEIGHTS.trust * S_trust +
        WEIGHTS.urgency * S_urgency +
        WEIGHTS.compatibility * S_compatibility +
        WEIGHTS.price * S_price +
        WEIGHTS.history * S_history +
        WEIGHTS.risk * S_risk),
  );

  if (score < MIN_RECOMMENDATION_SCORE) return null;

  return {
    tripId: trip.id,
    travelerId: trip.travelerId,
    score: Math.max(0, Math.min(100, score)),
    detourKm: Math.round(detourKm),
    estimatedPrice,
    estimatedArrival: trip.estimatedArrival,
    factors: {
      route: Number(S_route.toFixed(2)),
      capacity: Number(S_capacity.toFixed(2)),
      trust: Number(S_trust.toFixed(2)),
      urgency: Number(S_urgency.toFixed(2)),
      compatibility: Number(S_compatibility.toFixed(2)),
      price: Number(S_price.toFixed(2)),
      history: Number(S_history.toFixed(2)),
      risk: Number(S_risk.toFixed(2)),
    },
    reasons,
  };
}

/**
 * Score a parcel against many candidate trips; return top N by score.
 * The caller is responsible for pre-filtering candidates (geo box, time
 * window) to keep this loop small — aim for ≤ 200 candidates.
 */
export function rankMatches(
  parcel: MatchableParcel,
  trips: MatchableTrip[],
  limit = 5,
): MatchScore[] {
  return trips
    .map((t) => computeMatchScore(parcel, t))
    .filter((m): m is MatchScore => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
