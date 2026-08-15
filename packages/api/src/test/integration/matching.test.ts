/**
 * Matching integration tests — full accept flow: create users, parcel, trip,
 * accept match, verify both sides see each other.
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

describe("matching", () => {
  let app: FastifyInstance, senderToken: string, travelerToken: string;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());

    const sender = await signupAndGetToken(app, {
      email: "sender@match.local",
      phone: "+213550010001",
      firstName: "Sender",
      lastName: "User",
    });
    senderToken = sender.accessToken;

    const traveler = await signupAndGetToken(app, {
      email: "traveler@match.local",
      phone: "+213550010002",
      firstName: "Traveler",
      lastName: "User",
    });
    travelerToken = traveler.accessToken;
  });

  after(async () => { await app.close(); });

  it("accept flow: parcel PENDING_MATCH → MATCHED via /matching/accept", async () => {
    // 1) Sender creates a parcel
    const parcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: {
        description: "Colis test pour le matching",
        category: "Electronics",
        weightKg: 2,
        dimensionsCm: { length: 20, width: 15, height: 10 },
        estimatedValue: 150,
        valueCurrency: "EUR",
        pickupAddress: {
          level: "PIN_DROP",
          label: "Paris, France",
          country: "FR",
          lat: 48.8566,
          lng: 2.3522,
          accuracyMeters: 20,
        },
        deliveryAddress: {
          level: "PIN_DROP",
          label: "Alger, Algérie",
          country: "DZ",
          lat: 36.7538,
          lng: 3.0588,
          accuracyMeters: 20,
        },
        urgencyLevel: "MEDIUM",
      },
    });
    assert.equal(parcelRes.statusCode, 201);
    const parcelId = parcelRes.json().parcel.id;
    assert.equal(parcelRes.json().parcel.status, "PENDING_MATCH");

    // 2) Traveler creates a published trip
    const tripRes = await app.inject({
      method: "POST",
      url: "/trips",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: {
        origin: {
          level: "PIN_DROP",
          label: "Paris CDG",
          country: "FR",
          lat: 49.0097,
          lng: 2.5479,
          accuracyMeters: 50,
        },
        destination: {
          level: "PIN_DROP",
          label: "Alger Aéroport",
          country: "DZ",
          lat: 36.6941,
          lng: 3.2154,
          accuracyMeters: 50,
        },
        totalDistanceKm: 1400,
        departureTime: futureDate(5),
        mode: "FLIGHT",
        maxWeightKg: 20,
        maxDetourKm: 50,
        pricePerKg: 5,
      },
    });
    assert.equal(tripRes.statusCode, 201);
    const tripId = tripRes.json().trip.id;
    assert.equal(tripRes.json().trip.status, "PUBLISHED");

    // 3) Traveler accepts the parcel
    const acceptRes = await app.inject({
      method: "POST",
      url: "/matching/accept",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: { tripId, parcelId },
    });
    assert.equal(acceptRes.statusCode, 200);
    assert.equal(acceptRes.json().parcel.status, "MATCHED");
    assert.equal(acceptRes.json().parcel.matchedTripId, tripId);

    // 4) Verify parcel detail shows the matched trip
    const parcelDetail = await app.inject({
      method: "GET",
      url: `/parcels/${parcelId}`,
      headers: { authorization: `Bearer ${senderToken}` },
    });
    assert.equal(parcelDetail.statusCode, 200);
    assert.equal(parcelDetail.json().parcel.matchedTrip.id, tripId);

    // 5) Verify trip shows the matched parcel
    const tripDetail = await app.inject({
      method: "GET",
      url: `/trips/${tripId}`,
      headers: { authorization: `Bearer ${travelerToken}` },
    });
    assert.equal(tripDetail.statusCode, 200);
    assert.ok(tripDetail.json().trip.parcels.length > 0);
    assert.equal(tripDetail.json().trip.parcels[0].id, parcelId);
  });

  it("rejects accept for already-matched parcel with 409", async () => {
    const parcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: {
        description: "Already matched parcel",
        category: "Other",
        weightKg: 1,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        estimatedValue: 20,
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
      headers: { authorization: `Bearer ${travelerToken}` },
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

    // First accept
    await app.inject({
      method: "POST",
      url: "/matching/accept",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: { tripId, parcelId },
    });

    // Second accept should fail
    const res = await app.inject({
      method: "POST",
      url: "/matching/accept",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: { tripId, parcelId },
    });
    assert.equal(res.statusCode, 409);
  });

  it("rejects accept from non-trip-owner with 403", async () => {
    const parcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: {
        description: "Ownership test parcel",
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
      headers: { authorization: `Bearer ${travelerToken}` },
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

    // Sender tries to accept their own parcel onto the traveler's trip
    const res = await app.inject({
      method: "POST",
      url: "/matching/accept",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: { tripId, parcelId },
    });
    assert.equal(res.statusCode, 403);
  });
});
