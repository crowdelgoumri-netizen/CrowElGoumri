/**
 * Escrow API — Stripe Connect money flow over /escrow.
 *
 * Mirrors packages/api/src/routes/escrow.ts. The funded amount is locked in
 * escrow until delivery, then released to the traveler (Scenario A, EUR).
 *
 * v1 mobile note: `/fund` returns a Stripe PaymentIntent `clientSecret`. The
 * final card-confirmation needs @stripe/stripe-react-native (a dev build, not
 * Expo Go) — so the mobile checkout screen shows the breakdown and receives
 * the clientSecret, but the actual "Pay" confirmation is gated until dev
 * builds are adopted.
 */
import { apiFetch } from "./api";
import type { EscrowStatus } from "./types";

/** EUR-money breakdown — all fields are present (insuranceFee is 0 in v1). */
export interface PayoutBreakdown {
  totalAmount: number;
  platformFee: number;
  insuranceFee: number;
  travelerPayout: number;
  discountPct: number;
}

export interface Escrow {
  id: string;
  parcelId: string;
  senderId: string;
  travelerId: string;
  status: EscrowStatus;
  totalAmount: number;
  currency: string;
  platformFee: number;
  insuranceFee: number | null;
  travelerPayout: number;
  fundingMethod?: string;
  fundedAt?: string | null;
  lockedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
}

export interface FundResponse {
  escrowId: string;
  clientSecret: string | null;
  status: EscrowStatus;
  breakdown: PayoutBreakdown;
}

/** Sender funds the escrow → creates/reuses a Stripe PaymentIntent. */
export function fund(parcelId: string): Promise<FundResponse> {
  return apiFetch(`/escrow/${parcelId}/fund`, { method: "POST", noQueue: true });
}

/** Either party reads the escrow state + breakdown. */
export function getEscrow(parcelId: string): Promise<{ escrow: Escrow }> {
  return apiFetch(`/escrow/${parcelId}`);
}

// ── Traveler Connect (Stripe Express payouts account) ──────────────────
export function startConnectOnboarding(): Promise<{ url: string; accountId: string }> {
  return apiFetch("/escrow/connect/onboarding", { method: "POST", noQueue: true });
}

export interface ConnectStatus {
  accountId?: string;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirements?: string[];
}

export function getConnectStatus(): Promise<ConnectStatus> {
  return apiFetch("/escrow/connect/status");
}

/** Sender cancels pre-transit → refund to their card (before IN_TRANSIT). */
export function refund(parcelId: string): Promise<{ escrow: Escrow }> {
  return apiFetch(`/escrow/${parcelId}/refund`, { method: "POST", noQueue: true });
}

/** Manual release / retry (auto-release normally fires on DELIVERED). */
export function release(parcelId: string): Promise<{ escrow: Escrow }> {
  return apiFetch(`/escrow/${parcelId}/release`, { method: "POST", noQueue: true });
}
