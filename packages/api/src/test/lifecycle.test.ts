/**
 * Lifecycle state-machine tests.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * Pure logic — no DB, no Fastify. Locks down the legal transitions so a
 * route can't accidentally skip a state (e.g. MATCHED straight to DELIVERED
 * without pickup/transit) or revive a terminal status.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertParcelTransition,
  assertTripTransition,
} from "../lib/lifecycle.js";

describe("parcel lifecycle", () => {
  it("follows the happy-path chain", () => {
    const chain = [
      ["DRAFT", "PENDING_MATCH"],
      ["PENDING_MATCH", "MATCHED"],
      ["MATCHED", "AWAITING_PICKUP"],
      ["AWAITING_PICKUP", "IN_TRANSIT"],
      ["IN_TRANSIT", "AWAITING_DELIVERY"],
      ["AWAITING_DELIVERY", "DELIVERED"],
    ] as const;
    for (const [from, to] of chain) {
      assert.ok(
        assertParcelTransition(from, to),
        `expected ${from} → ${to} to be legal`,
      );
    }
  });

  it("rejects skipping pickup", () => {
    assert.ok(!assertParcelTransition("MATCHED", "IN_TRANSIT"));
    assert.ok(!assertParcelTransition("MATCHED", "DELIVERED"));
  });

  it("allows cancellation from any pre-transit state", () => {
    for (const from of [
      "DRAFT", "PENDING_MATCH", "MATCHED", "AWAITING_PICKUP",
    ] as const) {
      assert.ok(assertParcelTransition(from, "CANCELLED"), `${from} → CANCELLED`);
    }
  });

  it("forbids cancelling a parcel already in transit or delivered", () => {
    assert.ok(!assertParcelTransition("IN_TRANSIT", "CANCELLED"));
    assert.ok(!assertParcelTransition("DELIVERED", "CANCELLED"));
  });

  it("treats terminal statuses as having no forward edges", () => {
    for (const terminal of ["DELIVERED", "CANCELLED", "SEIZED"] as const) {
      assert.ok(!assertParcelTransition(terminal, "DELIVERED"));
      assert.ok(!assertParcelTransition(terminal, "CANCELLED"));
    }
  });

  it("allows a customs check detour mid-transit", () => {
    assert.ok(assertParcelTransition("IN_TRANSIT", "CUSTOMS_CHECK"));
    assert.ok(assertParcelTransition("CUSTOMS_CHECK", "IN_TRANSIT"));
  });

  it("allows reporting a dispute after delivery", () => {
    assert.ok(assertParcelTransition("DELIVERED", "DISPUTED"));
  });
});

describe("trip lifecycle", () => {
  it("follows the happy-path chain", () => {
    const chain = [
      ["DRAFT", "PUBLISHED"],
      ["PUBLISHED", "MATCHING"],
      ["MATCHING", "IN_PROGRESS"],
      ["IN_PROGRESS", "COMPLETED"],
    ] as const;
    for (const [from, to] of chain) {
      assert.ok(assertTripTransition(from, to), `${from} → ${to}`);
    }
  });

  it("rejects skipping departure", () => {
    assert.ok(!assertTripTransition("PUBLISHED", "IN_PROGRESS"));
    assert.ok(!assertTripTransition("MATCHING", "COMPLETED"));
  });

  it("cannot restart a completed or cancelled trip", () => {
    assert.ok(!assertTripTransition("COMPLETED", "IN_PROGRESS"));
    assert.ok(!assertTripTransition("CANCELLED", "PUBLISHED"));
  });
});

console.log("lifecycle tests: done");
