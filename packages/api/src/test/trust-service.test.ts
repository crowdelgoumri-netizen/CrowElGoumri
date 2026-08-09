/**
 * Trust-service ordering tests.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * recomputeTrustForUser() is a thin DB read/persist wrapper around
 * trustInputsFromUser() + computeTrustScore() (see ../lib/trust-service.ts).
 * Consistent with every other test file here, we don't stand up a DB or
 * mock the prisma singleton — we exercise the same pure building blocks
 * the service composes, against user-shaped fixtures. That's what actually
 * proves the KYC→trust coupling this phase fixes: a higher kycLevel must
 * yield a higher score, all else equal.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTrustScore, trustInputsFromUser } from "@crowdshipping/matching";

function makeUser(kycLevel: "NONE" | "BASIC" | "ENHANCED" | "FULL") {
  return {
    kycLevel,
    completedTrips: 3,
    completedDeliveries: 3,
    successRate: 0.9,
    averageRating: 4.5,
    createdAt: new Date("2025-01-01"),
    isBanned: false,
  };
}

describe("trust score increases with kycLevel", () => {
  it("orders NONE < BASIC < ENHANCED < FULL, all else equal", () => {
    const scores = (["NONE", "BASIC", "ENHANCED", "FULL"] as const).map(
      (level) => computeTrustScore(trustInputsFromUser(makeUser(level))).score,
    );
    assert.ok(scores[0] < scores[1], `NONE (${scores[0]}) should be < BASIC (${scores[1]})`);
    assert.ok(scores[1] < scores[2], `BASIC (${scores[1]}) should be < ENHANCED (${scores[2]})`);
    assert.ok(scores[2] < scores[3], `ENHANCED (${scores[2]}) should be < FULL (${scores[3]})`);
  });

  it("a phone-verified (BASIC) user scores above the NONE floor even with no history", () => {
    const fresh = {
      kycLevel: "NONE" as const,
      completedTrips: 0,
      completedDeliveries: 0,
      successRate: 0,
      averageRating: 0,
      createdAt: new Date(),
      isBanned: false,
    };
    const verified = { ...fresh, kycLevel: "BASIC" as const };
    const scoreNone = computeTrustScore(trustInputsFromUser(fresh)).score;
    const scoreBasic = computeTrustScore(trustInputsFromUser(verified)).score;
    assert.ok(
      scoreBasic > scoreNone,
      `verify-phone (${scoreBasic}) should raise trust above unverified (${scoreNone})`,
    );
  });

  it("a banned user always scores 0 regardless of kycLevel", () => {
    const banned = { ...makeUser("FULL"), isBanned: true };
    assert.strictEqual(computeTrustScore(trustInputsFromUser(banned)).score, 0);
  });
});

console.log("trust-service tests: done");
