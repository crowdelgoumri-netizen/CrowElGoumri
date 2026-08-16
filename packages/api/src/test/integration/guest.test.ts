/**
 * Guest browsing integration tests — the public marketplace reads.
 *
 * Unauthenticated users can browse the PUBLISHED trips feed, the
 * PENDING_MATCH parcels feed, and non-DRAFT details. Everything scoped to
 * a user (own trips/parcels) and every write stays behind authenticate.
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
  origin: { level: "PIN_DROP", label: "Gare de Lyon, Paris", city: "Paris", country: "FR" },
  destination: { level: "PIN_DROP", label: "Alger centre", city: "Alger", wilaya: "Alger", country: "DZ" },
  totalDistanceKm: 1400,
  departureTime: futureDate(7),
  mode: "FLIGHT",
  maxWeightKg: 20,
  pricePerKg: 5,
  priceCurrency: "EUR",
};

const SAMPLE_PARCEL = {
  description: "Un colis de vêtements pour la famille",
  category: "Clothing",
  weightKg: 3.5,
  dimensionsCm: { length: 30, width: 20, height: 15 },
  estimatedValue: 80,
  valueCurrency: "EUR",
  pickupAddress: { level: "PIN_DROP", label: "Paris", country: "FR" },
  deliveryAddress: { level: "PIN_DROP", label: "Alger", country: "DZ" },
  urgencyLevel: "MEDIUM",
  recipientName: "Mohand",
  recipientPhone: "+213555000001",
};

describe("guest browsing", () => {
  let app: FastifyInstance;
  let travelerToken: string;
  let senderToken: string;
  let publishedTripId: string;
  let draftTripId: string;
  let pendingParcelId: string;
  let draftParcelId: string;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
    ({ accessToken: travelerToken } = await signupAndGetToken(app, { firstName: "Traveler" }));
    ({ accessToken: senderToken } = await signupAndGetToken(app, { firstName: "Sender" }));

    const tripRes = await app.inject({
      method: "POST",
      url: "/trips",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: SAMPLE_TRIP,
    });
    publishedTripId = tripRes.json().trip.id;

    const draftTripRes = await app.inject({
      method: "POST",
      url: "/trips",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: { ...SAMPLE_TRIP, departureTime: futureDate(9), isDraft: true },
    });
    draftTripId = draftTripRes.json().trip.id;

    const parcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: SAMPLE_PARCEL,
    });
    pendingParcelId = parcelRes.json().parcel.id;

    const draftParcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: { ...SAMPLE_PARCEL, description: "Un brouillon de colis privé", isDraft: true },
    });
    draftParcelId = draftParcelRes.json().parcel.id;
  });

  after(async () => { await app.close(); });

  describe("GET /trips as guest", () => {
    it("lists PUBLISHED trips without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/trips?status=PUBLISHED" });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body.trips));
      assert.ok(body.trips.some((t: { id: string }) => t.id === publishedTripId));
      assert.ok(!body.trips.some((t: { id: string }) => t.id === draftTripId));
    });

    it("still works with a garbage token (treated as guest)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/trips?status=PUBLISHED",
        headers: { authorization: "Bearer not-a-jwt" },
      });
      assert.equal(res.statusCode, 200);
    });

    it("shows a published trip detail without a token", async () => {
      const res = await app.inject({ method: "GET", url: `/trips/${publishedTripId}` });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().trip.id, publishedTripId);
    });

    it("hides DRAFT trip details from guests", async () => {
      const res = await app.inject({ method: "GET", url: `/trips/${draftTripId}` });
      assert.equal(res.statusCode, 404);
    });

    it("rejects the traveler-private scope without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/trips" });
      assert.equal(res.statusCode, 401);
    });

    it("still returns own trips for the authenticated traveler", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/trips",
        headers: { authorization: `Bearer ${travelerToken}` },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(body.trips.some((t: { id: string }) => t.id === draftTripId));
    });
  });

  describe("GET /parcels as guest", () => {
    it("lists PENDING_MATCH parcels without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/parcels?status=PENDING_MATCH" });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(body.parcels.some((p: { id: string }) => p.id === pendingParcelId));
      assert.ok(!body.parcels.some((p: { id: string }) => p.id === draftParcelId));
    });

    it("shows a pending parcel detail without a token but strips recipient PII", async () => {
      const res = await app.inject({ method: "GET", url: `/parcels/${pendingParcelId}` });
      assert.equal(res.statusCode, 200);
      const parcel = res.json().parcel;
      assert.equal(parcel.id, pendingParcelId);
      assert.equal(parcel.recipientPhone, null);
      assert.equal(parcel.recipientName, null);
    });

    it("keeps recipient PII for the authenticated sender", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/parcels/${pendingParcelId}`,
        headers: { authorization: `Bearer ${senderToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.recipientPhone, SAMPLE_PARCEL.recipientPhone);
    });

    it("hides DRAFT parcel details from guests", async () => {
      const res = await app.inject({ method: "GET", url: `/parcels/${draftParcelId}` });
      assert.equal(res.statusCode, 404);
    });

    it("rejects the sender-private scope without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/parcels" });
      assert.equal(res.statusCode, 401);
    });
  });

  describe("writes stay protected", () => {
    it("POST /trips without a token → 401", async () => {
      const res = await app.inject({ method: "POST", url: "/trips", payload: SAMPLE_TRIP });
      assert.equal(res.statusCode, 401);
    });

    it("POST /parcels without a token → 401", async () => {
      const res = await app.inject({ method: "POST", url: "/parcels", payload: SAMPLE_PARCEL });
      assert.equal(res.statusCode, 401);
    });

    it("GET /me without a token → 401", async () => {
      const res = await app.inject({ method: "GET", url: "/me" });
      assert.equal(res.statusCode, 401);
    });
  });
});
