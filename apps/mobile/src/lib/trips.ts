/**
 * Trips API — typed wrappers over /trips.
 *
 * Mirrors packages/api/src/routes/trips.ts. A trip is the traveler's offer of
 * bag space; checkpoints are its physical audit trail (departure, customs,
 * arrival…), some of which advance the trip state machine.
 */
import { apiFetch } from "./api";
import type {
  Address,
  Currency,
  TransportMode,
  TripStatus,
  TrustBadge,
} from "./types";

export interface TripTraveler {
  id: string;
  firstName: string;
  lastName?: string;
  trustScore?: number;
  trustBadge?: TrustBadge | null;
  averageRating?: number;
  completedTrips?: number;
}

export interface Trip {
  id: string;
  origin: Address;
  destination: Address;
  totalDistanceKm?: number;
  estimatedDurationHours?: number;
  departureTime: string;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  mode: TransportMode;
  isFlexPlus12h?: boolean;
  vehicleType?: string;
  maxWeightKg: number;
  maxVolumeM3?: number;
  currentWeightKg: number;
  maxDetourKm?: number;
  pricePerKg?: number | null;
  priceCurrency: Currency;
  isNegotiable?: boolean;
  notes?: string;
  hasCooler?: boolean;
  acceptsFragile?: boolean;
  status: TripStatus;
  travelerId?: string;
  traveler: TripTraveler;
  parcels?: { id: string; description: string; weightKg: number; status: string }[];
}

export interface CreateTripInput {
  origin: Address;
  destination: Address;
  totalDistanceKm: number;
  estimatedDurationHours?: number;
  departureTime: string;
  estimatedArrival?: string;
  mode: TransportMode;
  isFlexPlus12h?: boolean;
  vehicleType?: string;
  maxWeightKg: number;
  maxVolumeM3?: number;
  maxDetourKm?: number;
  pricePerKg?: number;
  priceCurrency?: Currency;
  isNegotiable?: boolean;
  minPricePerKg?: number;
  notes?: string;
  hasCooler?: boolean;
  acceptsFragile?: boolean;
  isDraft?: boolean;
}

export interface ListTripsParams {
  status?: TripStatus;
  mode?: TransportMode;
  limit?: number;
  offset?: number;
}

export interface ListTripsResponse {
  trips: Trip[];
  total: number;
  limit: number;
  offset: number;
}

/** PUBLISHED/MATCHING trips — the feed a sender browses to find a traveler. */
export function listPublished(params: ListTripsParams = {}): Promise<ListTripsResponse> {
  return apiFetch(`/trips?${qs({ status: "PUBLISHED", ...params })}`);
}

/** The traveler's own trips. */
export function listMine(params: ListTripsParams = {}): Promise<ListTripsResponse> {
  return apiFetch(`/trips?${qs(params)}`);
}

export function getTrip(id: string): Promise<{ trip: Trip }> {
  return apiFetch(`/trips/${id}`);
}

export function createTrip(input: CreateTripInput): Promise<{ trip: Trip }> {
  return apiFetch("/trips", { method: "POST", body: input });
}

export function updateTrip(
  id: string,
  input: Partial<CreateTripInput>,
): Promise<{ trip: Trip }> {
  return apiFetch(`/trips/${id}`, { method: "PATCH", body: input });
}

export function cancelTrip(id: string): Promise<{ trip: Trip }> {
  return apiFetch(`/trips/${id}`, { method: "DELETE" });
}

// ── Checkpoints (audit trail; DEPARTURE/ARRIVAL also drive the state machine)
export type CheckpointType =
  | "DEPARTURE"
  | "PICKUP"
  | "TRANSIT"
  | "CUSTOMS"
  | "ARRIVAL"
  | "DELIVERY";

export interface Checkpoint {
  id: string;
  tripId: string;
  type: CheckpointType;
  location: { lat?: number; lng?: number; address?: string; [k: string]: unknown };
  notes?: string;
  photoUrl?: string;
  temperatureC?: number;
  createdAt: string;
}

export interface AddCheckpointInput {
  type: CheckpointType;
  location: { lat?: number; lng?: number; address?: string; [k: string]: unknown };
  notes?: string;
  photoUrl?: string;
  temperatureC?: number;
}

export function addCheckpoint(
  id: string,
  input: AddCheckpointInput,
): Promise<{ checkpoint: Checkpoint; tripStatus: TripStatus }> {
  return apiFetch(`/trips/${id}/checkpoint`, { method: "POST", body: input });
}

export function getCheckpoints(id: string): Promise<{ checkpoints: Checkpoint[] }> {
  return apiFetch(`/trips/${id}/checkpoints`);
}

function qs<T extends object>(params: T): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}
