/**
 * Matching routes — expose the scoring engine over the API.
 *
 *   GET /matching/parcels/:id  → top 5 trips for a parcel (sender's view)
 *   GET /matching/trips/:id    → top 5 parcels for a trip (traveler's view)
 *
 * The engine is in @crowdshipping/matching; this route is the glue that
 * loads candidates from Postgres, shapes them into Matchable* types,
 * scores them, and returns ranked results with human-readable reasons.
 *
 * PostGIS isn't available on Neon free tier, so geo pre-filtering is
 * done in application code (bounding box + haversine) via the matching
 * package's geo helpers.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@crowdshipping/db";
import {
  computeMatchScore,
  trustInputsFromUser,
  computeTrustScore,
  isWithinBox,
  type MatchableParcel,
  type MatchableTrip,
  type LatLng,
} from "@crowdshipping/matching";
import { notify } from "../lib/notifications.js";

// ── Helpers: extract LatLng from a CrowdShippingAddress JSON ─────────
function addrToLatLng(addr: unknown): LatLng | null {
  if (typeof addr !== "object" || addr === null) return null;
  const a = addr as Partial<{ lat: number; lng: number }>;
  if (typeof a.lat === "number" && typeof a.lng === "number") {
    return { lat: a.lat, lng: a.lng };
  }
  return null; // HUMAN_RELAY / LIVE_LOCATION without coords
}

// ── Routes ───────────────────────────────────────────────────────────
export const matchingRoutes: FastifyPluginAsync = async (app) => {
  // GET /matching/parcels/:id — find best trips for this parcel
  app.get(
    "/parcels/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const parcel = await prisma.parcel.findUnique({
        where: { id },
        include: { sender: { select: { id: true } } },
      });
      if (!parcel) return reply.code(404).send({ error: "Parcel not found" });
      if (parcel.status !== "PENDING_MATCH") {
        return reply.code(409).send({
          error: `Parcel is in status ${parcel.status}, must be PENDING_MATCH to match`,
        });
      }

      const parcelPickup = addrToLatLng(parcel.pickupAddress);
      const parcelDelivery = addrToLatLng(parcel.deliveryAddress);
      const matchableParcel: MatchableParcel = {
        id: parcel.id,
        weightKg: parcel.weightKg,
        category: parcel.category,
        urgencyLevel: parcel.urgencyLevel as MatchableParcel["urgencyLevel"],
        urgencyDeadline: parcel.urgencyDeadline,
        offeredPrice: parcel.offeredPrice ? Number(parcel.offeredPrice) : null,
        pickup: parcelPickup,
        delivery: parcelDelivery,
      };

      // Load candidate trips: PUBLISHED, departing after now, not full
      const candidateTrips = await prisma.trip.findMany({
        where: {
          status: "PUBLISHED",
          departureTime: { gt: new Date() },
          traveler: { isBanned: false },
        },
        include: {
          traveler: {
            select: {
              id: true,
              kycLevel: true,
              completedTrips: true,
              completedDeliveries: true,
              successRate: true,
              averageRating: true,
              createdAt: true,
              isBanned: true,
              blockedCategories: true,
            },
          },
        },
        take: 200, // candidate pool cap (blueprint spec)
      });

      // Geo pre-filter: if parcel has coords, skip trips whose origin/dest
      // are obviously outside the parcel's corridor (bounding box).
      const filtered = parcelPickup && parcelDelivery
        ? candidateTrips.filter((t) => {
            const origin = addrToLatLng(t.origin);
            const dest = addrToLatLng(t.destination);
            // If trip has no coords, keep it (can't pre-filter)
            if (!origin || !dest) return true;
            return (
              isWithinBox(parcelPickup, origin, t.maxDetourKm) ||
              isWithinBox(parcelPickup, dest, 100) || // pickup near either end
              isWithinBox(parcelDelivery, dest, t.maxDetourKm)
            );
          })
        : candidateTrips;

      // Shape into MatchableTrip and score
      const matchableTrips: MatchableTrip[] = filtered.map((t) => {
        const trust = computeTrustScore(trustInputsFromUser(t.traveler));
        return {
          id: t.id,
          travelerId: t.travelerId,
          origin: addrToLatLng(t.origin),
          destination: addrToLatLng(t.destination),
          departureTime: t.departureTime,
          estimatedArrival: t.estimatedArrival,
          maxWeightKg: t.maxWeightKg,
          currentWeightKg: t.currentWeightKg,
          maxDetourKm: t.maxDetourKm,
          pricePerKg: t.pricePerKg,
          blockedCategories: t.traveler.blockedCategories,
          trust,
          completedTrips: t.traveler.completedTrips,
          completedDeliveries: t.traveler.completedDeliveries,
          successRate: t.traveler.successRate,
          fraudRiskScore: 0, // stubbed in v1
        };
      });

      const results = matchableTrips
        .map((t) => computeMatchScore(matchableParcel, t))
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        parcelId: parcel.id,
        totalCandidates: candidateTrips.length,
        geoFiltered: filtered.length,
        matches: results,
      };
    },
  );

  // GET /matching/trips/:id — find best parcels for this trip (traveler view)
  app.get(
    "/trips/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const trip = await prisma.trip.findUnique({
        where: { id },
        include: {
          traveler: {
            select: {
              id: true, kycLevel: true, completedTrips: true,
              completedDeliveries: true, successRate: true,
              averageRating: true, createdAt: true, isBanned: true,
              blockedCategories: true,
            },
          },
        },
      });
      if (!trip) return reply.code(404).send({ error: "Trip not found" });
      if (trip.travelerId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your trip" });
      }
      if (!["PUBLISHED", "MATCHING"].includes(trip.status)) {
        return reply.code(409).send({
          error: `Trip is in status ${trip.status}, must be PUBLISHED`,
        });
      }

      const trust = computeTrustScore(trustInputsFromUser(trip.traveler));
      const matchableTrip: MatchableTrip = {
        id: trip.id,
        travelerId: trip.travelerId,
        origin: addrToLatLng(trip.origin),
        destination: addrToLatLng(trip.destination),
        departureTime: trip.departureTime,
        estimatedArrival: trip.estimatedArrival,
        maxWeightKg: trip.maxWeightKg,
        currentWeightKg: trip.currentWeightKg,
        maxDetourKm: trip.maxDetourKm,
        pricePerKg: trip.pricePerKg,
        blockedCategories: trip.traveler.blockedCategories,
        trust,
        completedTrips: trip.traveler.completedTrips,
        completedDeliveries: trip.traveler.completedDeliveries,
        successRate: trip.traveler.successRate,
        fraudRiskScore: 0,
      };

      const candidateParcels = await prisma.parcel.findMany({
        where: { status: "PENDING_MATCH" },
        take: 200,
      });

      const results = candidateParcels
        .map((p) => {
          const matchableParcel: MatchableParcel = {
            id: p.id,
            weightKg: p.weightKg,
            category: p.category,
            urgencyLevel: p.urgencyLevel as MatchableParcel["urgencyLevel"],
            urgencyDeadline: p.urgencyDeadline,
            offeredPrice: p.offeredPrice ? Number(p.offeredPrice) : null,
            pickup: addrToLatLng(p.pickupAddress),
            delivery: addrToLatLng(p.deliveryAddress),
          };
          // The engine scores against the single trip and returns tripId/
          // travelerId only; attach the parcelId here so the traveler knows
          // which parcel each ranked result refers to (POST /matching/accept).
          const m = computeMatchScore(matchableParcel, matchableTrip);
          return m ? { ...m, parcelId: p.id } : null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        tripId: trip.id,
        totalCandidates: candidateParcels.length,
        matches: results,
      };
    },
  );

  // POST /matching/accept — traveler accepts a parcel onto their trip
  app.post(
    "/accept",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { tripId, parcelId } = req.body as { tripId: string; parcelId: string };

      // Verify the traveler owns the trip
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          travelerId: true, status: true,
          maxWeightKg: true, currentWeightKg: true,
        },
      });
      if (!trip) return reply.code(404).send({ error: "Trip not found" });
      if (trip.travelerId !== req.user.sub) {
        return reply.code(403).send({ error: "Not your trip" });
      }
      if (!["PUBLISHED", "MATCHING"].includes(trip.status)) {
        return reply.code(409).send({ error: `Trip status ${trip.status}` });
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
        select: {
          id: true,
          weightKg: true,
          status: true,
          matchedTripId: true,
          senderId: true,
          sender: { select: { firstName: true } },
        },
      });
      if (!parcel) return reply.code(404).send({ error: "Parcel not found" });
      if (parcel.status !== "PENDING_MATCH") {
        return reply.code(409).send({ error: `Parcel already ${parcel.status}` });
      }
      // Capacity check
      if (trip.currentWeightKg + parcel.weightKg > trip.maxWeightKg) {
        return reply.code(409).send({ error: "Insufficient remaining capacity" });
      }

      // Match atomically: update parcel + trip capacity in one transaction
      const [updatedParcel] = await prisma.$transaction([
        prisma.parcel.update({
          where: { id: parcelId },
          data: {
            matchedTripId: tripId,
            matchedAt: new Date(),
            status: "MATCHED",
          },
        }),
        prisma.trip.update({
          where: { id: tripId },
          data: {
            currentWeightKg: { increment: parcel.weightKg },
            status: "MATCHING",
          },
        }),
      ]);

      // Notify both parties. Fire-and-forget semantics inside notify();
      // a push outage never rolls back the match. The sender learns their
      // parcel was accepted; the traveler gets a receipt of what they took.
      const traveler = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { firstName: true },
      });
      await Promise.all([
        notify(parcel.senderId, "MATCH_FOUND", {
          parcelId,
          travelerName: traveler?.firstName,
        }),
        notify(req.user.sub, "MATCH_FOUND", {
          parcelId,
          senderName: parcel.sender.firstName,
        }),
      ]);

      return { parcel: updatedParcel };
    },
  );
};
