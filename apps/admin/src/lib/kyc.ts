import { apiFetch } from "./api";

export interface KycSubmissionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  documentType:
    | "PASSPORT"
    | "NATIONAL_ID"
    | "DRIVERS_LICENSE"
    | "RESIDENCY_PERMIT";
  documentUrl: string;
  documentBackUrl: string | null;
  selfieUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  targetLevel: "ENHANCED" | "FULL";
  createdAt: string;
  user: KycSubmissionUser;
}

export interface PendingResponse {
  submissions: KycSubmission[];
  total: number;
  limit: number;
  offset: number;
}

export function listPending(
  limit: number,
  offset: number,
): Promise<PendingResponse> {
  return apiFetch<PendingResponse>(
    `/kyc/admin/pending?limit=${limit}&offset=${offset}`,
  );
}

export function reviewSubmission(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
): Promise<{ submission: KycSubmission }> {
  return apiFetch<{ submission: KycSubmission }>(`/kyc/admin/${id}/review`, {
    method: "POST",
    body: note ? { decision, note } : { decision },
  });
}
