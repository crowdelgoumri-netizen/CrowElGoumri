/**
 * Matching API — the scoring engine over /matching.
 *
 * Mirrors packages/api/src/routes/matching.ts.
 *   GET /matching/parcels/:id  → top trips for a parcel (sender's view)
 *   GET /matching/trips/:id    → top parcels for a trip (traveler's view)
 *   POST /matching/accept      → traveler accepts a parcel onto their trip
 */
import { apiFetch } from "./api";

export interface Match {
  /** Sender view (matches for a parcel): the candidate trip. */
  tripId: string;
  /** Traveler view (matches for a trip): the candidate parcel (attached in route). */
  parcelId?: string;
  travelerId: string;
  /** 0–100 (engine already scales; MIN_RECOMMENDATION_SCORE = 30). */
  score: number;
  detourKm: number;
  estimatedPrice: number | null;
  estimatedArrival: string | null;
  /** Per-subscore breakdown for badges/debug. */
  factors: Record<string, number>;
  /** Human-readable badges: "Trusted traveler", "Arrives on time", … */
  reasons: string[];
}

export interface MatchesResponse {
  parcelId?: string;
  tripId?: string;
  totalCandidates: number;
  geoFiltered?: number;
  matches: Match[];
}

/** Sender: find the best traveler trips for a parcel (parcel must be PENDING_MATCH). */
export function getMatchesForParcel(parcelId: string): Promise<MatchesResponse> {
  return apiFetch(`/matching/parcels/${parcelId}`);
}

/** Traveler: find the best parcels for a trip (trip must be PUBLISHED/MATCHING). */
export function getMatchesForTrip(tripId: string): Promise<MatchesResponse> {
  return apiFetch(`/matching/trips/${tripId}`);
}

/** Traveler: accept a parcel onto their trip (atomic: parcel→MATCHED, trip capacity++). */
export function acceptParcel(
  tripId: string,
  parcelId: string,
): Promise<{ parcel: unknown }> {
  return apiFetch("/matching/accept", { method: "POST", body: { tripId, parcelId } });
}
