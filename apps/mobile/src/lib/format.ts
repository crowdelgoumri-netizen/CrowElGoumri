/**
 * Formatting + domain label/color maps.
 *
 * Money/date formatters (EUR/DZD) and the status→(i18n key, tone) lookups
 * every list/detail screen and StatusPill use. Label maps hold i18n keys
 * ("status.parcel.DRAFT") — render them through t() (useTranslation in
 * components, i18n.t in this lib). Tones map to literal NativeWind class
 * strings in StatusPill (kept static so the JIT sees them).
 */
import i18n from "./i18n";
import type {
  DisputeReason,
  DisputeStatus,
  EscrowStatus,
  KycLevel,
  ParcelCategory,
  TransportMode,
  TripStatus,
  UrgencyLevel,
} from "./types";

export type Tone = "accent" | "success" | "violet" | "muted" | "danger";

export function eur(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function dzd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function money(n: number | null | undefined, currency = "EUR"): string {
  return currency === "DZD" ? dzd(n) : eur(n);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dates follow the UI language; money stays fr-FR (EUR convention). */
function locale(): string {
  return i18n.language?.startsWith("en") ? "en-GB" : "fr-FR";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return i18n.t("time.justNow");
  if (min < 60) return i18n.t("time.minAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t("time.hourAgo", { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return i18n.t("time.dayAgo", { n: d });
  return formatDate(iso);
}

// ── Status labels (i18n keys — render via t()) ────────────────────────
export const PARCEL_STATUS: Record<string, { key: string; tone: Tone }> = {
  DRAFT: { key: "status.parcel.DRAFT", tone: "muted" },
  PENDING_MATCH: { key: "status.parcel.PENDING_MATCH", tone: "accent" },
  MATCHED: { key: "status.parcel.MATCHED", tone: "violet" },
  AWAITING_PICKUP: { key: "status.parcel.AWAITING_PICKUP", tone: "violet" },
  IN_TRANSIT: { key: "status.parcel.IN_TRANSIT", tone: "accent" },
  AWAITING_DELIVERY: { key: "status.parcel.AWAITING_DELIVERY", tone: "accent" },
  DELIVERED: { key: "status.parcel.DELIVERED", tone: "success" },
  DISPUTED: { key: "status.parcel.DISPUTED", tone: "danger" },
  CANCELLED: { key: "status.parcel.CANCELLED", tone: "muted" },
  SEIZED: { key: "status.parcel.SEIZED", tone: "danger" },
};

export const TRIP_STATUS: Record<TripStatus, { key: string; tone: Tone }> = {
  DRAFT: { key: "status.trip.DRAFT", tone: "muted" },
  PUBLISHED: { key: "status.trip.PUBLISHED", tone: "accent" },
  MATCHING: { key: "status.trip.MATCHING", tone: "violet" },
  IN_PROGRESS: { key: "status.trip.IN_PROGRESS", tone: "accent" },
  COMPLETED: { key: "status.trip.COMPLETED", tone: "success" },
  CANCELLED: { key: "status.trip.CANCELLED", tone: "muted" },
};

export const ESCROW_STATUS: Record<EscrowStatus, { key: string; tone: Tone }> = {
  FUNDED: { key: "status.escrow.FUNDED", tone: "accent" },
  LOCKED: { key: "status.escrow.LOCKED", tone: "violet" },
  PARTIAL_RELEASE: { key: "status.escrow.PARTIAL_RELEASE", tone: "violet" },
  RELEASED: { key: "status.escrow.RELEASED", tone: "success" },
  REFUNDED_SENDER: { key: "status.escrow.REFUNDED_SENDER", tone: "muted" },
  REFUNDED_INSURANCE: { key: "status.escrow.REFUNDED_INSURANCE", tone: "muted" },
};

export const KYC_LEVEL: Record<KycLevel, { key: string; tone: Tone }> = {
  NONE: { key: "status.kyc.NONE", tone: "muted" },
  BASIC: { key: "status.kyc.BASIC", tone: "muted" },
  ENHANCED: { key: "status.kyc.ENHANCED", tone: "violet" },
  FULL: { key: "status.kyc.FULL", tone: "success" },
};

export const DISPUTE_REASON_KEY: Record<DisputeReason, string> = {
  PARCEL_NOT_DELIVERED: "disputeReason.PARCEL_NOT_DELIVERED",
  PARCEL_DAMAGED: "disputeReason.PARCEL_DAMAGED",
  PARCEL_STOLEN: "disputeReason.PARCEL_STOLEN",
  CUSTOMS_SEIZURE: "disputeReason.CUSTOMS_SEIZURE",
  TRAVELER_NO_SHOW: "disputeReason.TRAVELER_NO_SHOW",
  SENDER_NO_SHOW: "disputeReason.SENDER_NO_SHOW",
  FRAUD_ATTEMPT: "disputeReason.FRAUD_ATTEMPT",
  OTHER: "disputeReason.OTHER",
};

export const DISPUTE_STATUS: Record<DisputeStatus, { key: string; tone: Tone }> = {
  OPENED: { key: "status.dispute.OPENED", tone: "danger" },
  MEDIATING: { key: "status.dispute.MEDIATING", tone: "accent" },
  ESCALATED: { key: "status.dispute.ESCALATED", tone: "danger" },
  RESOLVED: { key: "status.dispute.RESOLVED", tone: "success" },
  CLOSED: { key: "status.dispute.CLOSED", tone: "muted" },
};

export const MODE_KEY: Record<TransportMode, string> = {
  FLIGHT: "mode.FLIGHT",
  FERRY: "mode.FERRY",
  BUS: "mode.BUS",
  CAR: "mode.CAR",
  TRUCK: "mode.TRUCK",
  TRAIN: "mode.TRAIN",
};

/** Ionicons name per transport mode (used by @expo/vector-icons). */
export const MODE_ICON: Record<TransportMode, string> = {
  FLIGHT: "airplane",
  FERRY: "boat",
  BUS: "bus",
  CAR: "car",
  TRUCK: "truck",
  TRAIN: "train",
};

export const CATEGORY_KEY: Record<ParcelCategory, string> = {
  Electronics: "category.Electronics",
  Clothing: "category.Clothing",
  Medicine: "category.Medicine",
  Documents: "category.Documents",
  Food: "category.Food",
  Cosmetics: "category.Cosmetics",
  Other: "category.Other",
};

export const URGENCY_KEY: Record<UrgencyLevel, string> = {
  LOW: "urgency.LOW",
  MEDIUM: "urgency.MEDIUM",
  HIGH: "urgency.HIGH",
  CRITICAL: "urgency.CRITICAL",
};

/** Best short label for an address (city > wilaya > label > country). */
export function cityOf(
  addr?:
    | { city?: string; wilaya?: string; label?: string; country?: string }
    | null,
): string {
  if (!addr) return "—";
  return addr.city || addr.wilaya || addr.label || addr.country || "—";
}

/** Two-letter initials for the Avatar fallback. */
export function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
