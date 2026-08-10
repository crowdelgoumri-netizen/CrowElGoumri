/**
 * Formatting + domain label/color maps.
 *
 * Money/date formatters (fr-FR, EUR) and the status→(French label, tone)
 * lookups every list/detail screen and StatusPill use. Tones map to literal
 * NativeWind class strings in StatusPill (kept static so the JIT sees them).
 */
import type {
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
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDate(iso);
}

// ── Status labels (French) ─────────────────────────────────────────────
export const PARCEL_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "muted" },
  PENDING_MATCH: { label: "En attente", tone: "accent" },
  MATCHED: { label: "Matché", tone: "violet" },
  AWAITING_PICKUP: { label: "Ramassage", tone: "violet" },
  IN_TRANSIT: { label: "En transit", tone: "accent" },
  AWAITING_DELIVERY: { label: "À livrer", tone: "accent" },
  DELIVERED: { label: "Livré", tone: "success" },
  DISPUTED: { label: "Litige", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "muted" },
  SEIZED: { label: "Saisi", tone: "danger" },
};

export const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "muted" },
  PUBLISHED: { label: "Publié", tone: "accent" },
  MATCHING: { label: "Matchs en cours", tone: "violet" },
  IN_PROGRESS: { label: "En cours", tone: "accent" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "muted" },
};

export const ESCROW_STATUS: Record<EscrowStatus, { label: string; tone: Tone }> = {
  FUNDED: { label: "Financé", tone: "accent" },
  LOCKED: { label: "Séquestré", tone: "violet" },
  PARTIAL_RELEASE: { label: "Libération partielle", tone: "violet" },
  RELEASED: { label: "Libéré", tone: "success" },
  REFUNDED_SENDER: { label: "Remboursé", tone: "muted" },
  REFUNDED_INSURANCE: { label: "Remb. assurance", tone: "muted" },
};

export const KYC_LEVEL: Record<KycLevel, { label: string; tone: Tone }> = {
  NONE: { label: "Non vérifié", tone: "muted" },
  BASIC: { label: "Basique", tone: "muted" },
  ENHANCED: { label: "Vérifié", tone: "violet" },
  FULL: { label: "Premium", tone: "success" },
};

export const MODE_LABEL: Record<TransportMode, string> = {
  FLIGHT: "Avion",
  FERRY: "Ferry",
  BUS: "Bus",
  CAR: "Voiture",
  TRUCK: "Camion",
  TRAIN: "Train",
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

export const CATEGORY_LABEL: Record<ParcelCategory, string> = {
  Electronics: "Électronique",
  Clothing: "Vêtements",
  Medicine: "Médicaments",
  Documents: "Documents",
  Food: "Nourriture",
  Cosmetics: "Cosmétiques",
  Other: "Autre",
};

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  LOW: "Normal",
  MEDIUM: "Modéré",
  HIGH: "Urgent",
  CRITICAL: "Critique",
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
