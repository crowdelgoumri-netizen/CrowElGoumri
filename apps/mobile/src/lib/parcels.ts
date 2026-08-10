/**
 * Parcels API — typed wrappers over /parcels.
 *
 * Mirrors packages/api/src/routes/parcels.ts. The lifecycle methods
 * (pickup → in-transit → awaiting-delivery, delivery-pin, deliver) drive a
 * matched parcel through to DELIVERED, which fires escrow release server-side.
 */
import { apiFetch } from "./api";
import type {
  Address,
  Currency,
  Dimensions,
  ParcelCategory,
  ParcelStatus,
  TrustBadge,
  UrgencyLevel,
} from "./types";

export interface ParcelSender {
  id: string;
  firstName: string;
  lastName?: string;
  trustScore?: number;
  trustBadge?: TrustBadge | null;
  averageRating?: number;
  completedDeliveries?: number;
}

export interface MatchedTripLite {
  id: string;
  departureTime?: string;
  mode?: string;
  traveler?: { id: string; firstName: string; trustScore?: number };
}

export interface Parcel {
  id: string;
  description: string;
  category: ParcelCategory;
  subCategory?: string;
  weightKg: number;
  dimensionsCm?: Dimensions;
  estimatedValue?: number;
  valueCurrency?: Currency;
  photoUrls?: string[];
  invoiceUrl?: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupNotes?: string;
  deliveryNotes?: string;
  urgencyLevel: UrgencyLevel;
  urgencyDeadline?: string | null;
  offeredPrice?: number | null;
  priceCurrency: Currency;
  recipientName?: string;
  recipientPhone?: string;
  status: ParcelStatus;
  createdAt: string;
  senderId?: string;
  sender: ParcelSender;
  matchedTripId?: string | null;
  matchedTrip?: MatchedTripLite | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

export interface CreateParcelInput {
  description: string;
  category: ParcelCategory;
  subCategory?: string;
  weightKg: number;
  dimensionsCm: Dimensions;
  estimatedValue: number;
  valueCurrency?: Currency;
  photoUrls?: string[];
  invoiceUrl?: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupNotes?: string;
  deliveryNotes?: string;
  urgencyLevel: UrgencyLevel;
  urgencyDeadline?: string;
  offeredPrice?: number;
  priceCurrency?: Currency;
  recipientName?: string;
  recipientPhone?: string;
  isDraft?: boolean;
}

export interface ListParcelsParams {
  status?: ParcelStatus;
  category?: ParcelCategory;
  limit?: number;
  offset?: number;
}

export interface ListParcelsResponse {
  parcels: Parcel[];
  total: number;
  limit: number;
  offset: number;
}

/** PENDING_MATCH → the public marketplace feed a traveler browses. */
export function listMarketplace(params: ListParcelsParams = {}): Promise<ListParcelsResponse> {
  return apiFetch(`/parcels?${qs({ status: "PENDING_MATCH", ...params })}`);
}

/** The sender's own parcels (optionally filtered by status). */
export function listMine(params: ListParcelsParams = {}): Promise<ListParcelsResponse> {
  return apiFetch(`/parcels?${qs(params)}`);
}

export function getParcel(id: string): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}`);
}

export function createParcel(input: CreateParcelInput): Promise<{ parcel: Parcel }> {
  return apiFetch("/parcels", { method: "POST", body: input });
}

export function updateParcel(
  id: string,
  input: Partial<CreateParcelInput>,
): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}`, { method: "PATCH", body: input });
}

export function cancelParcel(id: string): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}`, { method: "DELETE" });
}

// ── Traveler-driven lifecycle ──────────────────────────────────────────
export function markPickedUp(id: string): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}/pickup`, { method: "POST" });
}

export function markInTransit(id: string): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}/in-transit`, { method: "POST" });
}

export function markAwaitingDelivery(id: string): Promise<{ parcel: Parcel }> {
  return apiFetch(`/parcels/${id}/awaiting-delivery`, { method: "POST" });
}

/** Sender generates the 6-digit PIN (returned once, plaintext). */
export function generateDeliveryPin(
  id: string,
): Promise<{ pin: string; hint: string }> {
  return apiFetch(`/parcels/${id}/delivery-pin`, { method: "POST" });
}

/** Traveler submits the PIN to confirm delivery (fires escrow release). */
export function deliverParcel(
  id: string,
  pin: string,
): Promise<{ parcel: Parcel; payout: Record<string, unknown> }> {
  return apiFetch(`/parcels/${id}/deliver`, { method: "POST", body: { pin } });
}

// ── Query string helper (shared by all list endpoints) ─────────────────
function qs<T extends object>(params: T): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}
