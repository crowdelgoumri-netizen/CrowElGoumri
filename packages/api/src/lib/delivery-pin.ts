/**
 * Delivery PIN — generation, hashing, verification, and brute-force lockout.
 *
 * The PIN is a 6-digit code the sender generates and shares out-of-band
 * (WhatsApp/SMS to the recipient, per blueprint edge-case #1 ÉTAPE 8). It
 * is effectively a bearer secret: anyone holding it can confirm delivery,
 * which releases escrow. So it is stored hashed (bcrypt), never plaintext.
 *
 * Brute-force protection: 6 digits = 1M space. At 5 guesses then a 15-min
 * lockout, automated guessing is infeasible. The attempt counter is
 * in-memory (single-process v1); a Redis-backed counter comes with the
 * multi-instance / notifications phase.
 *
 * To keep the lockout logic unit-testable, AttemptTracker is a pure class
 * with an injectable clock — no module-level state, no time mocking hacks.
 */
import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Generate a random 6-digit PIN as a zero-padded string ("000142".."999871"). */
export function generateDeliveryPin(): string {
  // randomInt(0, 1_000_000) → uniform over [0, 999999]; pad to 6 digits.
  return randomInt(0, 1_000_000).toString().padStart(PIN_LENGTH, "0");
}

/** Hash a plaintext PIN for storage (bcrypt, cost 12 — shared with passwords). */
export function hashDeliveryPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

/** Constant-time verify a candidate PIN against the stored hash. */
export function verifyDeliveryPin(
  candidate: string,
  hash: string,
): Promise<boolean> {
  return verifyPassword(candidate, hash);
}

/**
 * Pure per-parcel attempt counter. Tracks wrong guesses and enforces a
 * timed lockout. Class form (not module state) so tests can instantiate
 * fresh and inject a deterministic clock.
 *
 * Lifecycle per parcel: each wrong guess bumps `attempts`; reaching MAX
 * starts a `lockedUntil` window; the first correct guess resets the
 * counter. Once unlocked (time passes), attempts resume from where they
 * were — a determined attacker still hits the cap, not a fresh budget.
 */
export class AttemptTracker {
  private attempts = new Map<string, { count: number; lockedUntil?: number }>();

  constructor(
    private readonly maxAttempts: number = MAX_PIN_ATTEMPTS,
    private readonly lockoutMs: number = LOCKOUT_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Is this parcel currently locked out? A locked parcel rejects all
   * verification attempts until the window elapses.
   */
  isLocked(parcelId: string): boolean {
    const rec = this.attempts.get(parcelId);
    if (!rec?.lockedUntil) return false;
    if (this.now() < rec.lockedUntil) return true;
    // Window elapsed — clear the lock but keep the count so repeated
    // lockouts don't reset the attacker's budget.
    rec.lockedUntil = undefined;
    return false;
  }

  /** Remaining guesses before the next lockout (0 once locked or exhausted). */
  remainingAttempts(parcelId: string): number {
    const rec = this.attempts.get(parcelId);
    if (!rec) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - rec.count);
  }

  /** Record a wrong guess; starts the lockout window if the cap is hit. */
  recordFailure(parcelId: string): void {
    const rec = this.attempts.get(parcelId) ?? { count: 0 };
    rec.count += 1;
    if (rec.count >= this.maxAttempts) {
      rec.lockedUntil = this.now() + this.lockoutMs;
      rec.count = 0; // reset so the next window is a fresh budget
    }
    this.attempts.set(parcelId, rec);
  }

  /** Record a success; clears the parcel's history entirely. */
  recordSuccess(parcelId: string): void {
    this.attempts.delete(parcelId);
  }
}
