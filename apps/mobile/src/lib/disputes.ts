/**
 * Disputes API — typed wrappers over /disputes.
 *
 * Mirrors packages/api/src/routes/disputes.ts. One dispute per parcel: once
 * GET returns non-null, the report screen shows a read-only view instead of
 * the form.
 */
import { apiFetch } from "./api";
import type { DisputeReason, DisputeStatus } from "./types";

export interface Dispute {
  id: string;
  parcelId: string;
  openedById: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  mustResolveBy: string;
  createdAt: string;
}

export interface OpenDisputeInput {
  parcelId: string;
  reason: DisputeReason;
  description: string;
}

export function openDispute(input: OpenDisputeInput): Promise<{ dispute: Dispute }> {
  return apiFetch("/disputes", { method: "POST", body: input });
}

export function getDispute(parcelId: string): Promise<{ dispute: Dispute | null }> {
  return apiFetch(`/disputes/${parcelId}`);
}
