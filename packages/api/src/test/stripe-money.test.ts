/**
 * Money-math smoke test for the escrow fee/payout breakdown.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * Pure unit test — no Stripe SDK calls, no network. The breakdown is the
 * one piece of escrow logic where a rounding bug would leak real money, so
 * it gets its own test; the Stripe-integrated endpoints are exercised via
 * the dev webhook flow documented in escrow.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePayoutBreakdown, toCents, fromCents } from "../lib/stripe.js";

describe("toCents / fromCents", () => {
  it("round-trips EUR amounts through cents", () => {
    assert.strictEqual(toCents(30), 3000);
    assert.strictEqual(toCents(27.5), 2750);
    assert.strictEqual(fromCents(3000), 30);
    assert.strictEqual(fromCents(2750), 27.5);
  });

  it("rounds half-cent values to the nearest cent", () => {
    // 19.995 EUR → 1999.5 cents → rounds to 2000
    assert.strictEqual(toCents(19.995), 2000);
  });
});

describe("computePayoutBreakdown", () => {
  it("applies the default 10% platform fee on the traveler price", () => {
    // Surcharge model (approved plan): fee is added on top of the price;
    // the traveler receives their full asked price, platform keeps the fee.
    //   30 EUR price → 3 EUR fee → 33 EUR charged → 30 EUR paid out.
    const b = computePayoutBreakdown(30);
    assert.strictEqual(b.platformFee, 3);
    assert.strictEqual(b.travelerPayout, 30);
    assert.strictEqual(b.totalAmount, 33); // sender pays price + fee
    assert.strictEqual(b.insuranceFee, 0);
  });

  it("keeps insurance as a pass-through, not platform revenue", () => {
    // 30 EUR price + 36 EUR insurance (3% of a 1200 EUR declared value).
    //   total = 30 + 3 (fee) + 36 (ins) = 69, matches blueprint ÉTAPE 5.
    //   payout = total − fee − insurance = 30 (the full price).
    const b = computePayoutBreakdown(30, 1000, 36);
    assert.strictEqual(b.platformFee, 3); // fee still on the price only
    assert.strictEqual(b.insuranceFee, 36);
    assert.strictEqual(b.totalAmount, 69);
    assert.strictEqual(b.travelerPayout, 30);
  });

  it("supports a custom fee in basis points", () => {
    // Cross-currency scenario B uses 15% (1500 bps) per blueprint §3.4.
    const b = computePayoutBreakdown(100, 1500);
    assert.strictEqual(b.platformFee, 15);
    assert.strictEqual(b.travelerPayout, 100); // full price
    assert.strictEqual(b.totalAmount, 115); // price + fee
  });

  it("handles zero-fee configuration", () => {
    const b = computePayoutBreakdown(50, 0);
    assert.strictEqual(b.platformFee, 0);
    assert.strictEqual(b.travelerPayout, 50);
    assert.strictEqual(b.totalAmount, 50);
  });

  it("never produces a negative payout", () => {
    // Pathological: 100% fee. Payout = total − fee − insurance = 0, not negative.
    const b = computePayoutBreakdown(40, 10000);
    assert.ok(b.travelerPayout >= 0, `expected >= 0, got ${b.travelerPayout}`);
    assert.strictEqual(b.platformFee, 40);
  });

  it("rounds the total to the cent to avoid float drift", () => {
    // 19.99 × 10% = 1.999 → rounds to 2.00 fee; total = 21.99
    const b = computePayoutBreakdown(19.99);
    assert.strictEqual(b.platformFee, 2);
    assert.strictEqual(b.totalAmount, 21.99);
  });

  it("applies a referral discount to the platform fee without touching the traveler payout", () => {
    // 30 EUR price → 3 EUR raw fee. 50% discount → 1.5 EUR off → fee = 1.5.
    const b = computePayoutBreakdown(30, 1000, 0, 50);
    assert.strictEqual(b.platformFee, 1.5);
    assert.strictEqual(b.travelerPayout, 30, "traveler must still receive the full price");
    assert.strictEqual(b.totalAmount, 31.5); // price + discounted fee
  });

  it("a 100% discount waives the platform fee entirely", () => {
    const b = computePayoutBreakdown(30, 1000, 0, 100);
    assert.strictEqual(b.platformFee, 0);
    assert.strictEqual(b.totalAmount, 30);
    assert.strictEqual(b.travelerPayout, 30);
  });

  it("defaults to no discount when the 4th param is omitted", () => {
    const withDefault = computePayoutBreakdown(30);
    const explicitZero = computePayoutBreakdown(30, 1000, 0, 0);
    assert.deepStrictEqual(withDefault, explicitZero);
  });

  it("echoes the applied discountPct back in the breakdown for the client to display", () => {
    const b = computePayoutBreakdown(30, 1000, 0, 50);
    assert.strictEqual(b.discountPct, 50);
    assert.strictEqual(computePayoutBreakdown(30).discountPct, 0);
  });

  it("rounds the discount amount to avoid floating-point drift (e.g., 33% discount)", () => {
    // 70 EUR price → 7 EUR raw fee. 33% discount → 7 × 0.33 = 2.31 → fee = 4.69 (clean).
    // Without rounding, platformFee could be 4.6899999999999995 (dirty float).
    const b = computePayoutBreakdown(70, 1000, 0, 33);
    assert.strictEqual(b.platformFee, 4.69);
    assert.strictEqual(b.travelerPayout, 70, "traveler must still receive the full price");
    assert.strictEqual(b.totalAmount, 74.69); // 70 + 4.69 discounted fee
  });
});

// node:test auto-runs on import; print a marker for the npm script output.
console.log("stripe-money tests: done");
