import { apiFetch } from "./api";
import type { TransportMode } from "./types";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface CampaignTraveler {
  id: string;
  firstName: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  trustScore?: number;
  trustBadge?: string | null;
  completedDeliveries?: number;
  averageRating?: number;
}

export interface Campaign {
  id: string;
  travelerId: string;
  traveler: CampaignTraveler;
  title: string;
  description?: string | null;
  originCity: string;
  originCountry: string;
  destWilayas: string[];
  departureDate: string;
  returnDate?: string | null;
  mode: TransportMode;
  capacityKg: number;
  pricePerKg: number;
  status: CampaignStatus;
  featured: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

export async function listCampaigns(params?: {
  originCountry?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CampaignListResponse> {
  const qs = new URLSearchParams();
  if (params?.originCountry) qs.set("originCountry", params.originCountry);
  if (params?.featured != null) qs.set("featured", String(params.featured));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch(`/campaigns${query ? `?${query}` : ""}`);
}

export async function getCampaign(id: string): Promise<{ campaign: Campaign }> {
  return apiFetch(`/campaigns/${id}`);
}

export async function createCampaign(data: {
  title: string;
  description?: string;
  originCity: string;
  originCountry: string;
  destWilayas: string[];
  departureDate: string;
  returnDate?: string;
  mode: TransportMode;
  capacityKg: number;
  pricePerKg: number;
  expiresAt?: string;
}): Promise<{ campaign: Campaign }> {
  return apiFetch("/campaigns", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCampaign(
  id: string,
  data: Partial<Parameters<typeof createCampaign>[0]> & { status?: CampaignStatus },
): Promise<{ campaign: Campaign }> {
  return apiFetch(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
