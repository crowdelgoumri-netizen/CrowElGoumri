/**
 * Referral code generation — 8-char uppercase alphanumeric, excluding
 * 0/O/1/I so a code read aloud or handwritten is never ambiguous.
 *
 * Uses crypto.randomInt (not Math.random) — cheap to do right, and a
 * referral code is a bearer credential of sorts (whoever holds it can
 * attribute a signup to a referrer), so it shouldn't be predictable.
 *
 * Collision handling lives at the call site (auth.ts retries on the
 * unique-constraint violation), not here — this function has no DB access.
 */
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
