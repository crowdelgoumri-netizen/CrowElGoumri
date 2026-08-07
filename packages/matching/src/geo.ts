/**
 * Geo helpers — haversine distance + bounding box.
 *
 * Neon's free tier doesn't support PostGIS extensions, so we do geo
 * filtering in application code. At v1 scale (hundreds of trips) this
 * is negligible; we upgrade to PostGIS only if query latency demands it.
 *
 * All distances in kilometers. Coordinates in [lat, lng] (degrees).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const R_EARTH_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points (haversine formula).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * A rough detour estimate: how much *extra* distance a traveler incurs
 * by picking up at `pickup` and dropping off at `delivery` along their
 * origin→destination route.
 *
 * Exact routing would call a map API (Mapbox/OSRM); for scoring we only
 * need a *relative* measure to rank candidates, so the triangle-inequality
 * approximation is good enough:
 *
 *   detour ≈ (origin→pickup + pickup→delivery + delivery→dest) − (origin→dest)
 *
 * The result is clamped to ≥ 0 (a perfectly on-route parcel shows ~0 detour).
 */
export function estimateDetourKm(
  origin: LatLng,
  destination: LatLng,
  pickup: LatLng,
  delivery: LatLng,
): number {
  const direct = haversineKm(origin, destination);
  const viaParcel =
    haversineKm(origin, pickup) +
    haversineKm(pickup, delivery) +
    haversineKm(delivery, destination);
  return Math.max(0, viaParcel - direct);
}

/**
 * Bounding box for cheap pre-filtering: "is pickup within maxDetourKm of
 * the trip's origin corridor?" We expand a box around the origin by the
 * detour tolerance, which lets us reject obviously-far candidates without
 * computing haversine for every pair.
 *
 * 1 degree of latitude ≈ 111 km. Longitude shrinks with cos(lat).
 */
export function isWithinBox(
  point: LatLng,
  center: LatLng,
  radiusKm: number,
): boolean {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(center.lat)));
  return (
    Math.abs(point.lat - center.lat) <= latDelta &&
    Math.abs(point.lng - center.lng) <= lngDelta
  );
}
