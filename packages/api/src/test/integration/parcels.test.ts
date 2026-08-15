/**
 * Parcel integration tests — CRUD, lifecycle transitions, edge cases.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/setup.js";
import { signupAndGetToken } from "../helpers/auth.js";
import { ensureCleanDB } from "../helpers/db.js";

const SAMPLE_PARCEL = {
  description: "Un colis de vêtements pour la famille",
  category: "Clothing",
  weightKg: 3.5,
  dimensionsCm: { length: 30, width: 20, height: 15 },
  estimatedValue: 80,
  valueCurrency: "EUR",
  pickupAddress: {
    level: "PIN_DROP",
    label: "12 Rue de Paris, Paris",
    city: "Paris",
    country: "FR",
    lat: 48.8566,
    lng: 2.3522,
    accuracyMeters: 10,
  },
  deliveryAddress: {
    level: "HUMAN_RELAY",
    label: "Centre ville, Alger",
    city: "Alger",
    wilaya: "Alger",
    country: "DZ",
    relayName: "Oncle Mohand",
    relayPhone: "+213555000001",
    instructions: "Demande à Mohand à la boulangerie",
  },
  urgencyLevel: "MEDIUM",
  recipientName: "Mohand",
  recipientPhone: "+213555000001",
};

describe("parcels", () => {
  let app: FastifyInstance, token: string, userId: string;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
    ({ accessToken: token, userId } = await signupAndGetToken(app));
  });

  after(async () => { await app.close(); });

  describe("POST /parcels", () => {
    it("creates a parcel as PENDING_MATCH", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: SAMPLE_PARCEL,
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.parcel.status, "PENDING_MATCH");
      assert.equal(body.parcel.senderId, userId);
    });

    it("creates a draft parcel when isDraft=true", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Draft parcel for testing", isDraft: true },
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.json().parcel.status, "DRAFT");
    });

    it("rejects unauthenticated requests", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/parcels",
        payload: SAMPLE_PARCEL,
      });
      assert.equal(res.statusCode, 401);
    });

    it("rejects too-short description", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "abc" },
      });
      assert.equal(res.statusCode, 400);
    });
  });

  describe("GET /parcels", () => {
    it("lists the user's own parcels", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(body.total > 0);
      assert.ok(Array.isArray(body.parcels));
    });
  });

  describe("GET /parcels/:id", () => {
    it("returns a single parcel detail", async () => {
      // Create a parcel first
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Detail test parcel" },
      });
      const parcelId = created.json().parcel.id;

      const res = await app.inject({
        method: "GET",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.id, parcelId);
    });

    it("returns 404 for unknown parcel", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/parcels/nonexistent-id",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 404);
    });

    it("hides DRAFT parcels from other users", async () => {
      // Create a draft
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Hidden draft", isDraft: true },
      });
      const parcelId = created.json().parcel.id;

      // Create another user and try to fetch the draft
      const other = await signupAndGetToken(app);
      const res = await app.inject({
        method: "GET",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${other.accessToken}` },
      });
      assert.equal(res.statusCode, 404);
    });
  });

  describe("PATCH /parcels/:id", () => {
    it("updates a DRAFT parcel", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Editable draft", isDraft: true },
      });
      const parcelId = created.json().parcel.id;

      const res = await app.inject({
        method: "PATCH",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { description: "Updated description" },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.description, "Updated description");
    });

    it("rejects update from non-owner with 403", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "This parcel is not yours", isDraft: true },
      });
      const parcelId = created.json().parcel.id;

      const other = await signupAndGetToken(app);
      const res = await app.inject({
        method: "PATCH",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${other.accessToken}` },
        payload: { description: "Hacked by someone else" },
      });
      assert.equal(res.statusCode, 403);
    });
  });

  describe("DELETE /parcels/:id", () => {
    it("cancels a PENDING_MATCH parcel", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Cancellable parcel" },
      });
      const parcelId = created.json().parcel.id;

      const res = await app.inject({
        method: "DELETE",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().parcel.status, "CANCELLED");
    });

    it("rejects cancel from non-owner with 403", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/parcels",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...SAMPLE_PARCEL, description: "Protected parcel" },
      });
      const parcelId = created.json().parcel.id;

      const other = await signupAndGetToken(app);
      const res = await app.inject({
        method: "DELETE",
        url: `/parcels/${parcelId}`,
        headers: { authorization: `Bearer ${other.accessToken}` },
      });
      assert.equal(res.statusCode, 403);
    });
  });
});
