/**
 * Trip integration tests — CRUD, checkpoints.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/setup.js";
import { signupAndGetToken } from "../helpers/auth.js";
import { ensureCleanDB } from "../helpers/db.js";

const futureDate = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
};

const SAMPLE_TRIP = {
  origin: {
    level: "PIN_DROP",
    label: "Aéroport CDG, Paris",
    city: "Paris",
    country: "FR",
    lat: 49.0097,
    lng: 2.5479,
    accuracyMeters: 50,
  },
  destination: {
    level: "POI_BASED",
    label: "Aéroport Houari Boumediene, Alger",
    city: "Alger",
    wilaya: "Alger",
    country: "DZ",
    poiName: "Aéroport d'Alger",
    poiType: "airport",
    lat: 36.6941,
    lng: 3.2154,
  },
  totalDistanceKm: 1400,
  departureTime: futureDate(7),
  mode: "FLIGHT",
  maxWeightKg: 20,
  maxDetourKm: 30,
  pricePerKg: 5,
  priceCurrency: "EUR",
};

/**
 * Creates a published trip, a sender + parcel, and accepts the match so
 * the trip enters MATCHING state (required before DEPARTURE checkpoints).
 */
async function createMatchedTrip(app: Awaited<ReturnType<typeof buildTestServer>>["app"], travelerToken: string) {
  const tripRes = await app.inject({
    method: "POST",
    url: "/trips",
    headers: { authorization: `Bearer ${travelerToken}` },
    payload: SAMPLE_TRIP,
  });
  const tripId = tripRes.json().trip.id;

  const sender = await signupAndGetToken(app, { firstName: "CPSender", lastName: "Helper" });
  const parcelRes = await app.inject({
    method: "POST",
    url: "/parcels",
    headers: { authorization: `Bearer ${sender.accessToken}` },
    payload: {
      description: "Colis pour test checkpoint trip",
      category: "Other",
      weightKg: 1,
      dimensionsCm: { length: 10, width: 10, height: 10 },
      estimatedValue: 10,
      valueCurrency: "EUR",
      pickupAddress: { level: "PIN_DROP", label: "Paris", country: "FR", lat: 48.8, lng: 2.3, accuracyMeters: 10 },
      deliveryAddress: { level: "PIN_DROP", label: "Alger", country: "DZ", lat: 36.7, lng: 3.0, accuracyMeters: 10 },
      urgencyLevel: "LOW",
    },
  });

  await app.inject({
    method: "POST",
    url: "/matching/accept",
    headers: { authorization: `Bearer ${travelerToken}` },
    payload: { tripId, parcelId: parcelRes.json().parcel.id },
  });

  return tripId;
}

describe("trips", () => {
  let app: FastifyInstance, token: string, userId: string;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
    ({ accessToken: token, userId } = await signupAndGetToken(app));
  });

  after(async () => { await app.close(); });

  describe("POST /trips", () => {
    it("creates a trip as PUBLISHED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: SAMPLE_TRIP,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.trip.status, "PUBLISHED");
      assert.equal(body.trip.travelerId, userId);
    });

    it("creates a DRAFT trip when isDraft=true", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_TRIP, isDraft: true },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().trip.status, "DRAFT");
    });

    it("rejects past departure time for published trip", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...SAMPLE_TRIP,
          departureTime: new Date(Date.now() - 86400000).toISOString(),
        },
      });
      assert.equal(res.statusCode, 400);
    });
  });

  describe("GET /trips", () => {
    it("lists the user's own trips", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(body.total > 0);
      assert.ok(Array.isArray(body.trips));
    });
  });

  describe("GET /trips/:id", () => {
    it("returns a single trip detail", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: SAMPLE_TRIP,
      });
      const tripId = created.json().trip.id;

      const res = await app.inject({
        method: "GET",
        url: `/trips/${tripId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().trip.id, tripId);
    });

    it("returns 404 for unknown trip", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/trips/nonexistent-id",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 404);
    });
  });

  describe("PATCH /trips/:id", () => {
    it("updates a DRAFT trip", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_TRIP, isDraft: true },
      });
      const tripId = created.json().trip.id;

      const res = await app.inject({
        method: "PATCH",
        url: `/trips/${tripId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { notes: "Updated notes" },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().trip.notes, "Updated notes");
    });
  });

  describe("POST /trips/:id/checkpoint", () => {
    it("records a DEPARTURE checkpoint and advances trip to IN_PROGRESS", async () => {
      const tripId = await createMatchedTrip(app, token);

      const res = await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "DEPARTURE",
          location: { address: "Aéroport CDG Terminal 2", lat: 49.0097, lng: 2.5479 },
          notes: "En route vers Alger",
        },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().tripStatus, "IN_PROGRESS");
    });

    it("rejects DEPARTURE if already IN_PROGRESS", async () => {
      const tripId = await createMatchedTrip(app, token);

      // First departure succeeds
      await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: "DEPARTURE", location: { address: "Airport" } },
      });

      // Second departure should fail
      const res = await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: "DEPARTURE", location: { address: "Airport again" } },
      });
      assert.equal(res.statusCode, 409);
    });

    it("rejects checkpoint from non-traveler with 403", async () => {
      const tripId = await createMatchedTrip(app, token);

      const other = await signupAndGetToken(app);
      const res = await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${other.accessToken}` },
        payload: { type: "DEPARTURE", location: { address: "Airport" } },
      });
      assert.equal(res.statusCode, 403);
    });
  });

  describe("GET /trips/:id/checkpoints", () => {
    it("returns chronological checkpoint history", async () => {
      const tripId = await createMatchedTrip(app, token);

      await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: "DEPARTURE", location: { address: "Paris" } },
      });
      await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${token}` },
        payload: { type: "TRANSIT", location: { address: "Mid-air" } },
      });

      const res = await app.inject({
        method: "GET",
        url: `/trips/${tripId}/checkpoints`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const checkpoints = res.json().checkpoints;
      assert.ok(checkpoints.length >= 2);
      assert.equal(checkpoints[0].type, "DEPARTURE");
      assert.equal(checkpoints[1].type, "TRANSIT");
    });
  });
});
