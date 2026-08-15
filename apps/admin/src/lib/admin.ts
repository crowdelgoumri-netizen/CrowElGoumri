import { apiFetch } from "./api";

// ── Dashboard ──────────────────────────────────────────────────────────

export interface DashboardStats {
  users: { total: number; newThisWeek: number };
  parcels: Record<string, number>;
  trips: Record<string, number>;
  financials: {
    gmv: number;
    platformFees: number;
    travelerPayouts: number;
  };
  openDisputes: number;
  pendingKyc: number;
}

export function getDashboard(): Promise<DashboardStats> {
  return apiFetch("/admin/dashboard");
}

// ── Users ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  kycLevel: string;
  isBanned: boolean;
  trustScore: number;
  createdAt: string;
  _count: {
    sentParcels: number;
    travelerTrips: number;
    ratingsReceived: number;
  };
}

interface UserListResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserDetail {
  user: AdminUser & {
    kycVerifiedAt: string | null;
    stripeAccountId: string | null;
    stripePayoutsEnabled: boolean;
    _count: AdminUser["_count"] & {
      ratingsGiven: number;
    };
  };
  escrowSummary: {
    totalAsSender: number;
    totalReceived: number;
  };
}

interface UserListParams {
  limit?: number;
  offset?: number;
  search?: string;
  role?: string;
  kycLevel?: string;
  banned?: string;
}

export function listUsers(params: UserListParams = {}): Promise<UserListResponse> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.search) qs.set("search", params.search);
  if (params.role) qs.set("role", params.role);
  if (params.kycLevel) qs.set("kycLevel", params.kycLevel);
  if (params.banned) qs.set("banned", params.banned);
  const q = qs.toString();
  return apiFetch(`/admin/users${q ? `?${q}` : ""}`);
}

export function getUser(id: string): Promise<UserDetail> {
  return apiFetch(`/admin/users/${id}`);
}

export function updateUser(
  id: string,
  data: { role?: string; isBanned?: boolean },
): Promise<{ user: { id: string; role: string; isBanned: boolean; kycLevel: string } }> {
  return apiFetch(`/admin/users/${id}`, { method: "PATCH", body: data });
}

// ── Parcels ────────────────────────────────────────────────────────────

export interface AdminParcel {
  id: string;
  description: string;
  weightKg: number;
  status: string;
  category: string | null;
  offeredPrice: number | null;
  currency: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
  matchedTrip: {
    id: string;
    traveler: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

interface ParcelListResponse {
  parcels: AdminParcel[];
  total: number;
  limit: number;
  offset: number;
}

interface ParcelListParams {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
  search?: string;
}

export function listParcels(params: ParcelListParams = {}): Promise<ParcelListResponse> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  const q = qs.toString();
  return apiFetch(`/admin/parcels${q ? `?${q}` : ""}`);
}
