/**
 * Stripe client + money helpers — blueprint §3.3 escrow.
 *
 * Two concerns live here:
 *   1. A singleton Stripe SDK instance (lazy so the SDK only loads in the
 *      API process, not in packages/matching which imports neither Stripe
 *      nor this file).
 *   2. The EUR ↔ cents conversion + fee/payout breakdown. Prisma stores
 *      amounts as Decimal EUR; Stripe's API takes integer minor units
 *      (cents). All conversions are funneled through toCents/fromCents so
 *      no float arithmetic ever reaches Stripe.
 *
 * Money model (Scenario A, EUR→EUR):
 *   totalAmount  = travelerPrice + insuranceFee + platformFee
 *   platformFee  = round(travelerPrice × feeBps / 10000)   // 10% default
 *   travelerPayout = totalAmount − platformFee − insuranceFee
 *
 * The fee is computed on the *traveler price* (the thing being remunerated),
 * not on the total — matching the blueprint's "Fee plateforme 10% du tarif
 * voyageur". Insurance is a pass-through to the insurer, not platform revenue.
 *
 * v1 supports EUR only on the Stripe path; DZD/COD (Scenario C) is a later
 * phase that needs BaridiMob/agent reconciliation.
 */
import Stripe from "stripe";
import { Prisma } from "@crowdshipping/db";
import { env } from "../env.js";

// ── Singleton Stripe client ──────────────────────────────────────────
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    // No explicit apiVersion: the SDK pins its own default (2025-02-24.acacia
    // at stripe@17.x), which keeps webhook event shapes stable. Bump the SDK
    // deliberately and re-test the webhook handler when upgrading.
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

// ── Money conversion ─────────────────────────────────────────────────
// Decimal → number is safe here: escrow amounts are well within Number's
// safe-integer range when expressed in cents (max ~9e10 cents = 900M EUR).

/** Convert a Prisma Decimal EUR value to integer cents for Stripe. */
export function toCents(amount: Prisma.Decimal | number | string): number {
  // Number() on a Decimal gives the full-precision float; we then round
  // to kill any sub-cent noise from prior float ops before ×100.
  return Math.round(Number(amount) * 100);
}

/** Convert Stripe integer cents back to a plain EUR number. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

// ── Fee / payout breakdown ───────────────────────────────────────────
export interface PayoutBreakdown {
  /** Amount charged to the sender (traveler price + insurance + fee). */
  totalAmount: number;
  /** Platform commission (10% default), charged on top of the price. */
  platformFee: number;
  /** Insurance premium, pass-through to the insurer (0 in v1). */
  insuranceFee: number;
  /** Net amount transferred to the traveler on release. */
  travelerPayout: number;
  /** Referral discount % actually applied to the fee, 0 if none. */
  discountPct: number;
}

/**
 * Compute the full money breakdown for an escrow.
 *
 * @param travelerPrice  What the traveler asked for (parcel price × kg, or
 *                       a flat offered price accepted by the traveler).
 * @param feeBps         Platform fee in basis points (env default 1000 = 10%).
 * @param insuranceFee   Optional premium (0 in v1 — insurance product deferred).
 * @param discountPct    Optional referral discount on the platform fee (0–100%).
 */
export function computePayoutBreakdown(
  travelerPrice: Prisma.Decimal | number | string,
  feeBps: number = env.STRIPE_PLATFORM_FEE_BPS,
  insuranceFee: Prisma.Decimal | number | string = 0,
  discountPct: Prisma.Decimal | number | string = 0,
): PayoutBreakdown {
  const price = Number(travelerPrice);
  const insurance = Number(insuranceFee);
  const discount = Number(discountPct);

  // Fee is charged on the traveler price, rounded to the cent. Rounding
  // half-up avoids the platform absorbing sub-cent drift over thousands of
  // transactions.
  const rawPlatformFee = Math.round((price * feeBps) / 10000);

  // Referral discount reduces the fee itself, not totalAmount directly —
  // travelerPayout is derived as (totalAmount - platformFee - insurance),
  // so discounting the fee (which totalAmount includes) leaves the
  // traveler's payout untouched. Discounting totalAmount alone would
  // silently cut the traveler's payout instead of the platform's cut.
  const discountAmount = rawPlatformFee * (discount / 100);
  const platformFee = Math.round((rawPlatformFee - discountAmount) * 100) / 100;

  const totalAmount = Math.round((price + insurance + platformFee) * 100) / 100;
  const travelerPayout =
    Math.round((totalAmount - platformFee - insurance) * 100) / 100;

  return { totalAmount, platformFee, insuranceFee: insurance, travelerPayout, discountPct: discount };
}
