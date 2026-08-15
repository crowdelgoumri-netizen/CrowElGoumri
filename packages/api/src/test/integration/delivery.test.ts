/**
 * Delivery integration tests — PIN generation, delivery confirmation, ratings.
 * Tests the full lifecycle: MATCHED → AWAITING_PICKUP → IN_TRANSIT →
 * AWAITING_DELIVERY → DELIVERED, then post-delivery rating.
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

/**
 * Sets up a matched parcel ready for the delivery lifecycle.
 * Returns the parcel and trip IDs, plus tokens for both parties.
 */
async function setupMatchedParcel(app: Awaited<ReturnType<typeof buildTestServer>>["app"]) {
  const sender = await signupAndGetToken(app, {
    email: "del-sender@e2e.local",
    phone: "+213559920001",
    firstName: "Sender",
    lastName: "Delivery",
  });

  const traveler = await signupAndGetToken(app, {
    email: "del-traveler@e2e.local",
    phone: "+213559920002",
    firstName: "Traveler",
    lastName: "Delivery",
  });

  const parcelRes = await app.inject({
    method: "POST",
    url: "/parcels",
    headers: { authorization: `Bearer ${sender.accessToken}` },
    payload: {
      description: "Colis pour livraison complète",
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
  const parcelId = parcelRes.json().parcel.id;

  const tripRes = await app.inject({
    method: "POST",
    url: "/trips",
    headers: { authorization: `Bearer ${traveler.accessToken}` },
    payload: {
      origin: { level: "PIN_DROP", label: "Paris", country: "FR", lat: 48.8, lng: 2.3, accuracyMeters: 10 },
      destination: { level: "PIN_DROP", label: "Alger", country: "DZ", lat: 36.7, lng: 3.0, accuracyMeters: 10 },
      totalDistanceKm: 1400,
      departureTime: futureDate(5),
      mode: "FLIGHT",
      maxWeightKg: 10,
    },
  });
  const tripId = tripRes.json().trip.id;

  await app.inject({
    method: "POST",
    url: "/matching/accept",
    headers: { authorization: `Bearer ${traveler.accessToken}` },
    payload: { tripId, parcelId },
  });

  return { parcelId, tripId, sender, traveler };
}

describe("delivery", () => {
  describe("delivery PIN + lifecycle", () => {
    let app: FastifyInstance,
      parcelId: string,
      tripId: string,
      sender: Awaited<ReturnType<typeof signupAndGetToken>>,
      traveler: Awaited<ReturnType<typeof signupAndGetToken>>;

    before(async () => {
      await ensureCleanDB();
      ({ app } = await buildTestServer());
      const setup = await setupMatchedParcel(app);
      parcelId = setup.parcelId;
      tripId = setup.tripId;
      sender = setup.sender;
      traveler = setup.traveler;

      // Depart the trip (required for in-transit)
      await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { type: "DEPARTURE", location: { address: "Paris CDG" } },
      });
    });

    after(async () => { await app.close(); });

    it("sender generates a delivery PIN", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/delivery-pin`,
        headers: { authorization: `Bearer ${sender.accessToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.ok(res.json().pin);
      assert.ok(/^\d{6}$/.test(res.json().pin), "PIN should be 6 digits");
    });

    it("rejects PIN generation from non-sender with 403", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/delivery-pin`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      assert.equal(res.statusCode, 403);
    });

    it("traveler picks up the parcel → AWAITING_PICKUP", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/pickup`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.status, "AWAITING_PICKUP");
    });

    it("traveler marks in-transit → IN_TRANSIT", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/in-transit`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.status, "IN_TRANSIT");
    });

    it("traveler arrives at destination → AWAITING_DELIVERY", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/awaiting-delivery`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.status, "AWAITING_DELIVERY");
    });

    it("rejects wrong delivery PIN with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/deliver`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { pin: "000000" }, // Wrong PIN (we didn't save the generated one — regenerate it)
      });
      assert.ok(res.statusCode === 401 || res.statusCode === 409);
    });

    it("delivers with correct PIN → DELIVERED", async () => {
      // Regenerate PIN so we know it
      const pinRes = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/delivery-pin`,
        headers: { authorization: `Bearer ${sender.accessToken}` },
      });
      const pin = pinRes.json().pin;

      const res = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/deliver`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { pin },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.status, "DELIVERED");
    });
  });

  describe("post-delivery rating", () => {
    let app: FastifyInstance,
      parcelId: string,
      tripId: string,
      sender: Awaited<ReturnType<typeof signupAndGetToken>>,
      traveler: Awaited<ReturnType<typeof signupAndGetToken>>;

    before(async () => {
      await ensureCleanDB();
      ({ app } = await buildTestServer());
      const setup = await setupMatchedParcel(app);
      parcelId = setup.parcelId;
      tripId = setup.tripId;
      sender = setup.sender;
      traveler = setup.traveler;

      // Run the full lifecycle
      await app.inject({
        method: "POST",
        url: `/trips/${tripId}/checkpoint`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { type: "DEPARTURE", location: { address: "CDG" } },
      });
      await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/pickup`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/in-transit`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/awaiting-delivery`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
      });
      const pinRes = await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/delivery-pin`,
        headers: { authorization: `Bearer ${sender.accessToken}` },
      });
      await app.inject({
        method: "POST",
        url: `/parcels/${parcelId}/deliver`,
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { pin: pinRes.json().pin },
      });
    });

    after(async () => { await app.close(); });

    it("sender rates the traveler", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/ratings",
        headers: { authorization: `Bearer ${sender.accessToken}` },
        payload: { parcelId, score: 5, comment: "Excellent transporteur!" },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().rating.score, 5);
    });

    it("traveler rates the sender", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/ratings",
        headers: { authorization: `Bearer ${traveler.accessToken}` },
        payload: { parcelId, score: 4, comment: "Bon expéditeur" },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().rating.score, 4);
    });

    it("rejects duplicate rating with 409", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/ratings",
        headers: { authorization: `Bearer ${sender.accessToken}` },
        payload: { parcelId, score: 3 },
      });
      assert.equal(res.statusCode, 409);
      assert.ok(res.json().error.includes("already rated"));
    });

    it("reads both ratings for the parcel", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/ratings/${parcelId}`,
        headers: { authorization: `Bearer ${sender.accessToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().ratings.length, 2);
    });
  });
});
