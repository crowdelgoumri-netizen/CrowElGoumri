/**
 * Referral code format — pure logic, no DB (see Global Constraints: pure
 * logic gets a DB-free test, same convention as stripe-money.test.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateReferralCode } from "../lib/referral-code.js";

describe("generateReferralCode", () => {
  it("returns an 8-character string", () => {
    assert.strictEqual(generateReferralCode().length, 8);
  });

  it("only uses uppercase alphanumeric characters, excluding 0/O/1/I", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      assert.ok(/^[A-Z0-9]{8}$/.test(code), `unexpected chars in ${code}`);
      assert.ok(!/[0O1I]/.test(code), `ambiguous char in ${code}`);
    }
  });

  it("produces distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateReferralCode()));
    assert.ok(codes.size > 490, `expected near-500 unique codes, got ${codes.size}`);
  });
});

console.log("referral-code tests: done");
