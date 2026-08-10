/**
 * Cross-cutting domain types — the status machines + enums shared by every
 * API wrapper and screen.
 *
 * Mirrors the backend's Prisma enums exactly (see packages/db schema +
 * packages/api/src/routes/*). Keep this as the single source of truth so the
 * UI's StatusPill, filters, and lifecycle guards never drift from the API.
 */

export type ParcelStatus =
  | "DRAFT"
  | "PENDING_MATCH"
  | "MATCHED"
  | "AWAITING_PICKUP"
  | "IN_TRANSIT"
  | "AWAITING_DELIVERY"
  | "DELIVERED"
  | "DISPUTED"
  | "CANCELLED"
  | "SEIZED";

export type TripStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "MATCHING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type EscrowStatus =
  | "FUNDED"
  | "LOCKED"
  | "PARTIAL_RELEASE"
  | "RELEASED"
  | "REFUNDED_SENDER"
  | "REFUNDED_INSURANCE";

export type KycLevel = "NONE" | "BASIC" | "ENHANCED" | "FULL";

export type TrustBadge = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type ParcelCategory =
  | "Electronics"
  | "Clothing"
  | "Medicine"
  | "Documents"
  | "Food"
  | "Cosmetics"
  | "Other";

export type TransportMode =
  | "FLIGHT"
  | "FERRY"
  | "BUS"
  | "CAR"
  | "TRUCK"
  | "TRAIN";

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Currency = "EUR" | "DZD" | "USD" | "CAD" | "GBP";

export type AddressLevel =
  | "OFFICIAL_GEOCODE"
  | "PIN_DROP"
  | "POI_BASED"
  | "LIVE_LOCATION"
  | "HUMAN_RELAY";

/**
 * CrowdShippingAddress — the discriminated-by-`level` address the backend
 * stores as Json. We keep it loose (passthrough) on the client: the mobile
 * pickers fill city/wilaya/country + optional coords; extra level-specific
 * fields are passed through unchanged.
 */
export interface Address {
  level: AddressLevel;
  label: string;
  city?: string;
  wilaya?: string;
  country: string; // ISO-3166 alpha-2
  lat?: number;
  lng?: number;
  [k: string]: unknown;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}
