/**
 * Chat integration tests — send message, history, threads, mark read.
 * Requires a matched parcel (sender + traveler) so the thread exists.
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

describe("chat", () => {
  let app: FastifyInstance, senderToken: string, travelerToken: string, parcelId: string;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());

    const sender = await signupAndGetToken(app, {
      email: "chat-sender@e2e.local",
      phone: "+213559910001",
      firstName: "Sender",
      lastName: "Chat",
    });
    senderToken = sender.accessToken;

    const traveler = await signupAndGetToken(app, {
      email: "chat-traveler@e2e.local",
      phone: "+213559910002",
      firstName: "Traveler",
      lastName: "Chat",
    });
    travelerToken = traveler.accessToken;

    // Create a parcel + trip + match to set up a chat thread
    const parcelRes = await app.inject({
      method: "POST",
      url: "/parcels",
      headers: { authorization: `Bearer ${senderToken}` },
      payload: {
        description: "Colis pour test chat",
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
    parcelId = parcelRes.json().parcel.id;

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

    await app.inject({
      method: "POST",
      url: "/matching/accept",
      headers: { authorization: `Bearer ${travelerToken}` },
      payload: { tripId: tripRes.json().trip.id, parcelId },
    });
  });

  after(async () => { await app.close(); });

  describe("POST /chat/:parcelId", () => {
    it("sender sends a message", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/chat/${parcelId}`,
        headers: { authorization: `Bearer ${senderToken}` },
        payload: { body: "Bonjour, est-ce que vous pouvez emporter mon colis?" },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().message.body, "Bonjour, est-ce que vous pouvez emporter mon colis?");
    });

    it("traveler replies", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/chat/${parcelId}`,
        headers: { authorization: `Bearer ${travelerToken}` },
        payload: { body: "Oui, pas de problème!" },
      });
      assert.equal(res.statusCode, 201);
    });

    it("rejects message from non-participant with 403", async () => {
      const stranger = await signupAndGetToken(app);
      const res = await app.inject({
        method: "POST",
        url: `/chat/${parcelId}`,
        headers: { authorization: `Bearer ${stranger.accessToken}` },
        payload: { body: "I should not be here" },
      });
      assert.equal(res.statusCode, 403);
    });
  });

  describe("GET /chat/:parcelId", () => {
    it("returns message history", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/chat/${parcelId}`,
        headers: { authorization: `Bearer ${senderToken}` },
      });
      assert.equal(res.statusCode, 200);
      const messages = res.json().messages;
      assert.ok(messages.length >= 2);
      // Messages are oldest-first
      assert.equal(messages[0].body, "Bonjour, est-ce que vous pouvez emporter mon colis?");
    });
  });

  describe("GET /chat/threads", () => {
    it("returns the matched parcel thread", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/chat/threads",
        headers: { authorization: `Bearer ${senderToken}` },
      });
      assert.equal(res.statusCode, 200);
      const threads = res.json().threads;
      assert.ok(threads.length > 0);
      assert.equal(threads[0].parcelId, parcelId);
      assert.ok(threads[0].counterparty);
    });
  });

  describe("POST /chat/:parcelId/read", () => {
    it("marks unread messages as read", async () => {
      // Traveler sends another message (unread by sender)
      await app.inject({
        method: "POST",
        url: `/chat/${parcelId}`,
        headers: { authorization: `Bearer ${travelerToken}` },
        payload: { body: "Unread message" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/chat/${parcelId}/read`,
        headers: { authorization: `Bearer ${senderToken}` },
      });
      assert.equal(res.statusCode, 200);
      assert.ok(res.json().markedRead >= 1);
    });
  });
});
