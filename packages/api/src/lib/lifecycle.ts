/**
 * Parcel & trip lifecycle state machines.
 *
 * One source of truth for which status transitions are legal. Every route
 * that advances a parcel or trip calls into assertParcelTransition /
 * assertTripTransition so the lifecycle can't be subverted by a route that
 * forgot a guard. Mirrors the escrow module's TRANSITIONS pattern.
 *
 * Parcel happy path:
 *   DRAFT → PENDING_MATCH → MATCHED → AWAITING_PICKUP → IN_TRANSIT
 *         → AWAITING_DELIVERY → DELIVERED
 * Cancellation can occur from any pre-transit state. DISPUTED/SEIZED are
 * terminal-ish (resolved out-of-band by the dispute flow — future phase).
 *
 * Trip happy path:
 *   DRAFT → PUBLISHED → MATCHING → IN_PROGRESS → COMPLETED
 * Trip COMPLETED is only legal once no parcels remain undelivered; the
 * checkpoint route enforces that invariant, not this map.
 */
import type { ParcelStatus, TripStatus } from "@crowdshipping/db";

const PARCEL_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  DRAFT: ["PENDING_MATCH", "CANCELLED"],
  PENDING_MATCH: ["MATCHED", "CANCELLED"],
  MATCHED: ["AWAITING_PICKUP", "DISPUTED", "CANCELLED"],
  AWAITING_PICKUP: ["IN_TRANSIT", "MATCHED", "DISPUTED", "CANCELLED"],
  IN_TRANSIT: ["AWAITING_DELIVERY", "CUSTOMS_CHECK", "DISPUTED"],
  CUSTOMS_CHECK: ["IN_TRANSIT", "SEIZED", "DISPUTED"],
  AWAITING_DELIVERY: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["DISPUTED"], // escrow already released; a post-delivery report is still legal
  DISPUTED: ["DELIVERED", "CANCELLED"], // resolved by dispute flow
  CANCELLED: [], // terminal
  SEIZED: [], // terminal — customs seizure
};

const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["MATCHING", "CANCELLED"],
  MATCHING: ["IN_PROGRESS", "PUBLISHED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

/** True if `from → to` is a legal parcel status transition. */
export function assertParcelTransition(
  from: ParcelStatus,
  to: ParcelStatus,
): boolean {
  return PARCEL_TRANSITIONS[from]?.includes(to) ?? false;
}

/** True if `from → to` is a legal trip status transition. */
export function assertTripTransition(
  from: TripStatus,
  to: TripStatus,
): boolean {
  return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}
