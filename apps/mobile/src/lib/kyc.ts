/**
 * KYC API — manual-review identity verification over /kyc.
 *
 * Mirrors packages/api/src/routes/kyc.ts. The user submits an ID + selfie
 * (as URLs — photo upload itself is a cross-cutting concern; in dev a
 * placeholder URL works, image-picker uploads land with the storage phase),
 * an admin approves/rejects, and on approval kycLevel bumps + trust recomputes.
 */
import { apiFetch } from "./api";
import type { KycLevel } from "./types";

export type DocumentType =
  | "PASSPORT"
  | "NATIONAL_ID"
  | "DRIVERS_LICENSE"
  | "RESIDENCY_PERMIT";

export type KycSubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface KycSubmission {
  id: string;
  userId: string;
  documentType: DocumentType;
  documentUrl: string;
  documentBackUrl?: string | null;
  selfieUrl: string;
  targetLevel: "ENHANCED" | "FULL";
  status: KycSubmissionStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface KycStatusResponse {
  kycLevel: KycLevel;
  kycVerifiedAt: string | null;
  latestSubmission: KycSubmission | null;
}

export interface SubmitKycInput {
  documentType: DocumentType;
  documentUrl: string;
  documentBackUrl?: string;
  selfieUrl: string;
  targetLevel: "ENHANCED" | "FULL";
}

export function submitKyc(input: SubmitKycInput): Promise<{ submission: KycSubmission }> {
  return apiFetch("/kyc/submit", { method: "POST", body: input });
}

export function getKycStatus(): Promise<KycStatusResponse> {
  return apiFetch("/kyc/status");
}
