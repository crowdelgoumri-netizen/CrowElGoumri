/**
 * Smoke test for the matching engine.
 * Run with: pnpm --filter @crowdshipping/matching test
 *
 * Not a full test suite — just verifies the algorithm produces sane
 * relative scores (good pair >> bad pair, hard constraints eliminate).
 */
import { computeMatchScore, computeTrustScore, rankMatches } from "./index.js";
import type { MatchableParcel, MatchableTrip } from "./index.js";

const trustHigh = computeTrustScore({
  kycLevel: "ENHANCED",
  completedTrips: 25,
  completedDeliveries: 24,
  successRate: 0.96,
  averageRating: 4.8,
  createdAt: new Date("2024-01-01"),
  hasActiveInsurance: false,
  hasVerifiedBadge: true,
  isBanned: false,
});

const trustLow = computeTrustScore({
  kycLevel: "BASIC",
  completedTrips: 0,
  completedDeliveries: 0,
  successRate: 0,
  averageRating: 0,
  createdAt: new Date(),
  hasActiveInsurance: false,
  hasVerifiedBadge: false,
  isBanned: false,
});

console.log("Trust scores:");
console.log("  high-trust traveler:", trustHigh.score, trustHigh.badge);
console.log("  new traveler      :", trustLow.score, trustLow.badge);

// Paris → Alger parcel
const parcel: MatchableParcel = {
  id: "p1",
  weightKg: 3,
  category: "Electronics",
  urgencyLevel: "HIGH",
  urgencyDeadline: new Date("2026-08-25T00:00:00Z"),
  offeredPrice: 30,
  pickup: { lat: 48.85, lng: 2.35 }, // Paris
  delivery: { lat: 36.75, lng: 3.06 }, // Alger
};

// Trip A: perfect match — same route, high trust, capacity, fair price
const tripGood: MatchableTrip = {
  id: "t1",
  travelerId: "u1",
  origin: { lat: 48.87, lng: 2.33 }, // Paris CDG
  destination: { lat: 36.69, lng: 3.21 }, // Alger airport
  departureTime: new Date("2026-08-18T08:00:00Z"),
  estimatedArrival: new Date("2026-08-18T11:00:00Z"),
  maxWeightKg: 25,
  currentWeightKg: 5,
  maxDetourKm: 50,
  pricePerKg: 9,
  blockedCategories: [],
  trust: trustHigh,
  completedTrips: 25,
  completedDeliveries: 24,
  successRate: 0.96,
  fraudRiskScore: 0,
};

// Trip B: bad match — wrong city, low trust, barely any capacity
const tripBad: MatchableTrip = {
  id: "t2",
  travelerId: "u2",
  origin: { lat: 43.30, lng: 5.37 }, // Marseille (far from Paris pickup)
  destination: { lat: 35.70, lng: -0.63 }, // Oran (not Alger)
  departureTime: new Date("2026-08-24T20:00:00Z"), // very close to deadline
  estimatedArrival: new Date("2026-08-25T22:00:00Z"), // arrives AFTER deadline
  maxWeightKg: 5,
  currentWeightKg: 3, // only 2kg left for a 3kg parcel
  maxDetourKm: 30,
  pricePerKg: 20,
  blockedCategories: [],
  trust: trustLow,
  completedTrips: 0,
  completedDeliveries: 0,
  successRate: 0,
  fraudRiskScore: 0.3,
};

const scoreGood = computeMatchScore(parcel, tripGood);
const scoreBad = computeMatchScore(parcel, tripBad);

console.log("\nMatch scores:");
console.log("  good trip:", scoreGood?.score, scoreGood?.reasons);
console.log("  bad trip :", scoreBad?.score ?? "ELIMINATED (hard constraint)");

// Ranking
const ranked = rankMatches(parcel, [tripGood, tripBad]);
console.log("\nRanked top matches:", ranked.map((m) => m.score));

// Assertions
const pass = scoreGood && scoreGood.score > 50 && scoreBad === null;
console.log("\n" + (pass ? "✓ PASS" : "✗ FAIL"));
if (!pass) process.exit(1);
