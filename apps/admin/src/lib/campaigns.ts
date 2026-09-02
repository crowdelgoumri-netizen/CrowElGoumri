import { apiFetch } from "./api";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface AdminCampaign {
  id: string;
  title: string;
  originCity: string;
  originCountry: string;
  destWilayas: string[];
  departureDate: string;
  returnDate?: string | null;
  mode: string;
  capacityKg: number;
  pricePerKg: number;
  status: CampaignStatus;
  featured: boolean;
  createdAt: string;
  traveler: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export async function listAdminCampaigns(params?: {
  status?: CampaignStatus;
  limit?: number;
  offset?: number;
}): Promise<{ campaigns: AdminCampaign[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return apiFetch(`/admin/campaigns${q ? `?${q}` : ""}`);
}

export async function patchAdminCampaign(
  id: string,
  data: { featured?: boolean; status?: CampaignStatus },
): Promise<{ campaign: AdminCampaign }> {
  return apiFetch(`/admin/campaigns/${id}`, { method: "PATCH", body: data });
}
