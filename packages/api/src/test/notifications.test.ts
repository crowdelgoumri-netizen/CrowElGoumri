/**
 * Notification smoke tests — template resolution + token validation.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * These cover the pure logic: every known type renders a non-empty
 * {title, body}, payloads flow into templates, and the Expo token filter
 * rejects garbage before the SDK ever sees it. The provider fan-out /
 * persistence path is exercised via the stubbed-prisma integration tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderMessage,
  isValidExpoToken,
  type NotificationType,
} from "../lib/notifications.js";

describe("message templates", () => {
  const types: NotificationType[] = [
    "MATCH_FOUND", "PARCEL_PICKED_UP", "IN_TRANSIT", "AWAITING_DELIVERY",
    "DELIVERED", "PAYOUT_SENT", "ESCROW_FUNDED", "ESCROW_REFUNDED",
    "CHAT_MESSAGE",
  ];

  for (const type of types) {
    it(`renders a non-empty {title, body} for ${type}`, () => {
      const { title, body } = renderMessage(type, {
        travelerName: "Ahmed",
        amount: 30,
        currency: "EUR",
        senderName: "Karim",
        chatPreview: "Bonjour",
      });
      assert.ok(typeof title === "string" && title.length > 0, "title empty");
      assert.ok(typeof body === "string" && body.length > 0, "body empty");
    });
  }

  it("interpolates the traveler name into MATCH_FOUND", () => {
    const { body } = renderMessage("MATCH_FOUND", { travelerName: "Ahmed" });
    assert.ok(body.includes("Ahmed"), `expected Ahmed in: ${body}`);
  });

  it("falls back to a generic noun when the name is absent", () => {
    const { body } = renderMessage("MATCH_FOUND", {});
    assert.ok(body.includes("voyageur"), `expected fallback in: ${body}`);
  });

  it("formats PAYOUT_SENT with amount + currency", () => {
    const { body } = renderMessage("PAYOUT_SENT", { amount: 27, currency: "EUR" });
    assert.ok(body.includes("27"), `expected amount in: ${body}`);
    assert.ok(body.includes("EUR"), `expected currency in: ${body}`);
  });

  it("truncation-safe CHAT_MESSAGE with empty preview still renders", () => {
    const { body } = renderMessage("CHAT_MESSAGE", {});
    assert.ok(body.length > 0);
  });
});

describe("isValidExpoToken", () => {
  it("accepts the canonical Expo token shape", () => {
    assert.ok(isValidExpoToken("ExponentPushToken[abcdef123456]"));
    assert.ok(isValidExpoToken("ExponentPushToken[Aa-Zz_0-9-]"));
  });

  it("rejects malformed tokens", () => {
    assert.ok(!isValidExpoToken(""));
    assert.ok(!isValidExpoToken("abcdef123456")); // bare, no wrapper
    assert.ok(!isValidExpoToken("ExponentPushToken[]")); // empty inside
    assert.ok(!isValidExpoToken("FCM_TOKEN[xxx]")); // wrong prefix
    assert.ok(!isValidExpoToken("ExponentPushToken[bad chars!]")); // invalid chars
  });
});

console.log("notifications tests: done");
