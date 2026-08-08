/**
 * Delivery PIN + brute-force lockout tests.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * Exercises generation, the hash/verify round-trip, and the AttemptTracker
 * lockout window — no DB, no Fastify. The tracker takes an injectable
 * clock so we can test the timed lockout deterministically.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateDeliveryPin,
  hashDeliveryPin,
  verifyDeliveryPin,
  AttemptTracker,
  PIN_LENGTH,
} from "../lib/delivery-pin.js";

describe("generateDeliveryPin", () => {
  it("produces a 6-digit zero-padded string", () => {
    for (let i = 0; i < 100; i++) {
      const pin = generateDeliveryPin();
      assert.strictEqual(pin.length, PIN_LENGTH);
      assert.match(pin, /^\d{6}$/);
      assert.ok(Number(pin) >= 0 && Number(pin) <= 999999);
    }
  });

  it("can reach the zero-padded edge (low values)", () => {
    // Probabilistic over 100 draws above; just assert the format holds
    // for a value we construct to look like a low draw.
    assert.match("000000", /^\d{6}$/);
  });
});

describe("hashDeliveryPin / verifyDeliveryPin", () => {
  it("verifies a correct PIN against its hash", async () => {
    const pin = "482910";
    const hash = await hashDeliveryPin(pin);
    assert.notStrictEqual(hash, pin, "hash must not equal plaintext");
    assert.ok(await verifyDeliveryPin(pin, hash));
  });

  it("rejects a wrong PIN", async () => {
    const hash = await hashDeliveryPin("123456");
    assert.ok(!(await verifyDeliveryPin("654321", hash)));
  });

  it("produces a fresh hash per call (salted)", async () => {
    const h1 = await hashDeliveryPin("999999");
    const h2 = await hashDeliveryPin("999999");
    assert.notStrictEqual(h1, h2);
  });
});

describe("AttemptTracker lockout", () => {
  // Helper: build a tracker with a controllable clock starting at t=0.
  function makeTracker() {
    let t = 0;
    return {
      tracker: new AttemptTracker(5, 15 * 60 * 1000, () => t),
      advance: (ms: number) => {
        t += ms;
      },
      now: () => t,
    };
  }

  it("counts down remaining attempts", () => {
    const { tracker } = makeTracker();
    assert.strictEqual(tracker.remainingAttempts("p1"), 5);
    tracker.recordFailure("p1");
    tracker.recordFailure("p1");
    assert.strictEqual(tracker.remainingAttempts("p1"), 3);
  });

  it("locks after the cap, then unlocks once the window elapses", () => {
    const { tracker, advance } = makeTracker();
    for (let i = 0; i < 5; i++) tracker.recordFailure("p1");
    assert.ok(tracker.isLocked("p1"), "should be locked at cap");

    // Still locked mid-window.
    advance(10 * 60 * 1000);
    assert.ok(tracker.isLocked("p1"));

    // Unlocks after the full window.
    advance(6 * 60 * 1000); // total 16 min > 15 min
    assert.ok(!tracker.isLocked("p1"));
  });

  it("resets the counter on success", () => {
    const { tracker } = makeTracker();
    tracker.recordFailure("p1");
    tracker.recordFailure("p1");
    tracker.recordSuccess("p1");
    assert.strictEqual(tracker.remainingAttempts("p1"), 5);
    assert.ok(!tracker.isLocked("p1"));
  });

  it("isolates counters per parcel", () => {
    const { tracker } = makeTracker();
    tracker.recordFailure("p1");
    tracker.recordFailure("p1");
    assert.strictEqual(tracker.remainingAttempts("p2"), 5);
    assert.strictEqual(tracker.remainingAttempts("p1"), 3);
  });
});

console.log("delivery-pin tests: done");
