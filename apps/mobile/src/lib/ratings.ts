/**
 * Ratings API — typed wrappers over /ratings.
 *
 * Mirrors packages/api/src/routes/ratings.ts. Bidirectional: after a parcel
 * is DELIVERED, both the sender and the matched traveler can each submit
 * one rating of the other. Once GET returns a row where fromUserId matches
 * the caller, the delivery screen shows a "thanks" state instead of the
 * star form.
 */
import { apiFetch } from "./api";

export interface Rating {
  id: string;
  parcelId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface SubmitRatingInput {
  parcelId: string;
  score: number;
  comment?: string;
}

export function submitRating(input: SubmitRatingInput): Promise<{ rating: Rating }> {
  return apiFetch("/ratings", { method: "POST", body: input });
}

export function getRatings(parcelId: string): Promise<{ ratings: Rating[] }> {
  return apiFetch(`/ratings/${parcelId}`);
}
