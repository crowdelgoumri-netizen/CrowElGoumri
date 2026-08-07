/**
 * @crowdshipping/db — shared Prisma client + domain types
 *
 * Single PrismaClient instance (avoid connection exhaustion in dev hot-reload).
 * Domain types (CrowdShippingAddress) live here so every package speaks the
 * same shape for the Algeria fallback addressing system (blueprint §1.3).
 */
import { PrismaClient, type AddressLevel } from "@prisma/client";

// ── Singleton client (prevents N+1 clients in dev hot-reload) ─────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-export Prisma types for ergonomic imports across packages
export type {
  User,
  Trip,
  TripCheckpoint,
  Parcel,
  EscrowLedger,
  Dispute,
  CustomsClearanceLog,
  Rating,
  Notification,
  ChatMessage,
  UserRole,
  KYCLevel,
  TripMode,
  TripStatus,
  ParcelStatus,
  EscrowStatus,
  DisputeStatus,
  DisputeReason,
  Currency,
  PaymentMethod,
  AddressLevel,
} from "@prisma/client";

export { Prisma } from "@prisma/client";

// ── Algeria fallback addressing system (blueprint §1.3) ──────────────
/**
 * Algeria has no reliable postal-address system. This union encodes the
 * 5-level fallback ladder used across the app and stored as Json in
 * Parcel/Trip route columns. Match this shape in the mobile address picker.
 */
export interface CrowdShippingAddressBase {
  level: AddressLevel;
  label: string; // human-readable, shown in UI
  city?: string;
  wilaya?: string; // Algerian province (1-58)
  country: string; // ISO-3166 alpha-2, e.g. "DZ", "FR"
}

export interface GeocodedAddress extends CrowdShippingAddressBase {
  level: "OFFICIAL_GEOCODE";
  lat: number;
  lng: number;
  street?: string;
  postalCode?: string;
}

export interface PinDropAddress extends CrowdShippingAddressBase {
  level: "PIN_DROP";
  lat: number;
  lng: number;
  accuracyMeters: number;
}

export interface PoiAddress extends CrowdShippingAddressBase {
  level: "POI_BASED";
  poiName: string; // "Mosquée El Feth", "Stade 5 Juillet"
  poiType?: string; // "mosque" | "stadium" | "market" | "station"
  lat?: number;
  lng?: number;
}

export interface LiveLocationAddress extends CrowdShippingAddressBase {
  level: "LIVE_LOCATION";
  shareUrl: string; // WhatsApp/live location link
  expiresAt?: string; // ISO datetime
}

export interface HumanRelayAddress extends CrowdShippingAddressBase {
  level: "HUMAN_RELAY";
  relayName: string; // trusted contact who hands off the parcel
  relayPhone: string; // +213...
  instructions: string; // "Ask for uncle Mohand at the bakery"
}

export type CrowdShippingAddress =
  | GeocodedAddress
  | PinDropAddress
  | PoiAddress
  | LiveLocationAddress
  | HumanRelayAddress;

// ── Dimensions helper ─────────────────────────────────────────────────
export interface ParcelDimensions {
  length: number; // cm
  width: number; // cm
  height: number; // cm
}
