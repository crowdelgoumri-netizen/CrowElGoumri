/**
 * Referrals API — typed wrapper over GET /referrals/me.
 * Mirrors packages/api/src/routes/referrals.ts.
 */
import { apiFetch } from "./api";

export interface ReferralEntry {
  refereeFirstName: string;
  status: "PENDING" | "REWARDED";
  createdAt: string;
  rewardedAt: string | null;
}

export interface MyReferrals {
  referralCode: string;
  referrals: ReferralEntry[];
}

export function getMyReferrals(): Promise<MyReferrals> {
  return apiFetch("/referrals/me");
}
