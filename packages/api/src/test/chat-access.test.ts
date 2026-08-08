/**
 * Access-control smoke test for the chat participant helper.
 * Run with: pnpm --filter @crowdshipping/api test:chat
 *
 * Stubs prisma.parcel.findUnique so we exercise only the authorization
 * logic — no DB, no sockets. The point of this file is to lock down the
 * one rule the whole chat surface depends on: only the sender and the
 * matched traveler participate, and an unmatched parcel has no thread.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@crowdshipping/db";
import {
  assertParcelParticipant,
  HttpError,
} from "../lib/chat-access.js";

// Shape returned by the helper's select clause.
type ParcelStub = {
  senderId: string;
  matchedTrip: { travelerId: string } | null;
};

// Replace before each test so cases stay isolated.
function stubParcel(p: ParcelStub | null) {
  (prisma.parcel as unknown as { findUnique: unknown }).findUnique = async () =>
    p;
}

beforeEach(() => {
  (prisma.parcel as unknown as { findUnique: unknown }).findUnique = async () =>
    null;
});

describe("assertParcelParticipant", () => {
  it("returns SENDER when the caller is the parcel sender", async () => {
    stubParcel({ senderId: "u1", matchedTrip: { travelerId: "u2" } });
    const r = await assertParcelParticipant("p1", "u1");
    assert.strictEqual(r.role, "SENDER");
    assert.strictEqual(r.travelerId, "u2");
  });

  it("returns TRAVELER when the caller is the matched traveler", async () => {
    stubParcel({ senderId: "u1", matchedTrip: { travelerId: "u2" } });
    const r = await assertParcelParticipant("p1", "u2");
    assert.strictEqual(r.role, "TRAVELER");
  });

  it("throws 403 when the caller is neither party", async () => {
    stubParcel({ senderId: "u1", matchedTrip: { travelerId: "u2" } });
    await assert.rejects(
      () => assertParcelParticipant("p1", "u3"),
      (err: unknown) => err instanceof HttpError && err.status === 403,
    );
  });

  it("throws 404 when the parcel has no matched trip (no thread yet)", async () => {
    stubParcel({ senderId: "u1", matchedTrip: null });
    // Even the sender can't chat before a match exists.
    await assert.rejects(
      () => assertParcelParticipant("p1", "u1"),
      (err: unknown) => err instanceof HttpError && err.status === 404,
    );
  });

  it("throws 404 when the parcel does not exist", async () => {
    stubParcel(null);
    await assert.rejects(
      () => assertParcelParticipant("missing", "u1"),
      (err: unknown) => err instanceof HttpError && err.status === 404,
    );
  });
});

console.log("chat-access tests: done");
