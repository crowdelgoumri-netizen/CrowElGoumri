/**
 * Referral reward granting — tests grantReferralReward() directly (not via
 * HTTP) because it's a side-effect of escrow release, not its own endpoint.
 * Deliberately doesn't touch EscrowLedger/Stripe: granting only needs a
 * PENDING Referral to exist, which signup already creates (see Task 3).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/setup.js";
import { ensureCleanDB } from "../helpers/db.js";
import { prisma } from "@crowdshipping/db";
import {
  grantReferralReward,
  findReferralCredit,
  consumeReferralCredit,
  maybeGrantFirstReleaseReward,
} from "../../lib/referral-service.js";

async function signupWithCode(app: FastifyInstance, opts: {
  email: string; phone: string; referralCode?: string;
}) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: {
      email: opts.email,
      phone: opts.phone,
      password: "Password123",
      firstName: "Test",
      lastName: "User",
      ...(opts.referralCode ? { referralCode: opts.referralCode } : {}),
    },
  });
  return res.json().user.id as string;
}

/**
 * Seeds a minimal Parcel + EscrowLedger row directly via Prisma — no
 * Stripe, no HTTP call to the fund/release routes. Used to exercise
 * maybeGrantFirstReleaseReward()'s "is this the user's Nth RELEASED escrow"
 * count logic in isolation.
 */
async function createReleasedEscrow(opts: {
  senderId: string;
  travelerId: string;
  status?: "RELEASED" | "LOCKED";
}) {
  const status = opts.status ?? "RELEASED";
  const parcel = await prisma.parcel.create({
    data: {
      senderId: opts.senderId,
      description: "Test parcel",
      category: "Other",
      weightKg: 1,
      dimensionsCm: { length: 10, width: 10, height: 10 },
      estimatedValue: 10,
      pickupAddress: { level: "PIN_DROP", label: "Paris", country: "FR", lat: 48.8, lng: 2.3, accuracyMeters: 10 },
      deliveryAddress: { level: "PIN_DROP", label: "Alger", country: "DZ", lat: 36.7, lng: 3.0, accuracyMeters: 10 },
      urgencyLevel: "LOW",
      status: "DELIVERED",
    },
  });
  const escrow = await prisma.escrowLedger.create({
    data: {
      parcelId: parcel.id,
      senderId: opts.senderId,
      travelerId: opts.travelerId,
      status,
      totalAmount: 100,
      currency: "EUR",
      platformFee: 10,
      travelerPayout: 90,
      fundingMethod: "CREDIT_CARD_STRIPE",
      releasedAt: status === "RELEASED" ? new Date() : null,
    },
  });
  return { parcel, escrow };
}

describe("grantReferralReward", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  it("rewards both referrer and referee with a ReferralCredit", async () => {
    const referrerId = await signupWithCode(app, { email: "gr-a@test.local", phone: "+213559940001" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId = await signupWithCode(app, {
      email: "gr-b@test.local", phone: "+213559940002", referralCode: referrer.referralCode,
    });

    await grantReferralReward(refereeId);

    const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId } });
    assert.equal(referral.status, "REWARDED");
    assert.ok(referral.rewardedAt);

    const referrerCredit = await findReferralCredit(referrerId);
    const refereeCredit = await findReferralCredit(refereeId);
    assert.ok(referrerCredit, "referrer should have an unconsumed credit");
    assert.ok(refereeCredit, "referee should have an unconsumed credit");
    assert.equal(Number(referrerCredit!.discountPct), 50);
    assert.equal(Number(refereeCredit!.discountPct), 50);
  });

  it("is a no-op if called twice for the same referee (idempotent)", async () => {
    const referrerId = await signupWithCode(app, { email: "gr-c@test.local", phone: "+213559940003" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId = await signupWithCode(app, {
      email: "gr-d@test.local", phone: "+213559940004", referralCode: referrer.referralCode,
    });

    await grantReferralReward(refereeId);
    await grantReferralReward(refereeId); // second call must not double-grant

    const credits = await prisma.referralCredit.findMany({ where: { userId: referrerId } });
    assert.equal(credits.length, 1, "referrer should have exactly one credit, not two");
  });

  it("is a no-op if the user has no PENDING referral (e.g. no referrer)", async () => {
    const soloId = await signupWithCode(app, { email: "gr-e@test.local", phone: "+213559940005" });
    await grantReferralReward(soloId); // should not throw
    const credit = await findReferralCredit(soloId);
    assert.equal(credit, null);
  });
});

describe("findReferralCredit / consumeReferralCredit", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  it("returns the oldest unconsumed credit and excludes consumed ones", async () => {
    const referrerId = await signupWithCode(app, { email: "fc-a@test.local", phone: "+213559940010" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId1 = await signupWithCode(app, {
      email: "fc-b@test.local", phone: "+213559940011", referralCode: referrer.referralCode,
    });
    await grantReferralReward(refereeId1); // referrer's 1st credit

    const credit = await findReferralCredit(referrerId);
    assert.ok(credit);
    await consumeReferralCredit(credit!.id, "fake-escrow-id");

    const afterConsuming = await findReferralCredit(referrerId);
    assert.equal(afterConsuming, null, "consumed credit must not be returned again");
  });

  it("exactly one of two concurrent consumes against the same credit wins", async () => {
    const referrerId = await signupWithCode(app, { email: "cc-a@test.local", phone: "+213559940030" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId = await signupWithCode(app, {
      email: "cc-b@test.local", phone: "+213559940031", referralCode: referrer.referralCode,
    });
    await grantReferralReward(refereeId); // gives referrer one unconsumed credit

    const credit = await findReferralCredit(referrerId);
    assert.ok(credit, "referrer should have an unconsumed credit");

    // Simulate two concurrent funding requests on two different parcels
    // both racing to spend the same credit.
    const [resultA, resultB] = await Promise.all([
      consumeReferralCredit(credit!.id, "escrow-a"),
      consumeReferralCredit(credit!.id, "escrow-b"),
    ]);

    const results = [resultA, resultB];
    assert.equal(results.filter((r) => r === true).length, 1, "exactly one consume must win");
    assert.equal(results.filter((r) => r === false).length, 1, "exactly one consume must lose");

    const finalCredit = await prisma.referralCredit.findUniqueOrThrow({ where: { id: credit!.id } });
    assert.ok(finalCredit.consumedAt, "credit must end up consumed");
    assert.ok(
      finalCredit.consumedEscrowId === "escrow-a" || finalCredit.consumedEscrowId === "escrow-b",
      "credit must be consumed against exactly one of the two escrow ids",
    );
  });
});

describe("maybeGrantFirstReleaseReward", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  it("grants the reward on a user's first RELEASED escrow, not on a later one", async () => {
    const referrerId = await signupWithCode(app, { email: "mgr-a@test.local", phone: "+213559940040" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId = await signupWithCode(app, {
      email: "mgr-b@test.local", phone: "+213559940041", referralCode: referrer.referralCode,
    });
    const travelerId = await signupWithCode(app, { email: "mgr-c@test.local", phone: "+213559940042" });

    // First RELEASED escrow for the referee (as sender) — this is the
    // referee's first-ever release, so the reward must fire.
    await createReleasedEscrow({ senderId: refereeId, travelerId });
    await maybeGrantFirstReleaseReward(refereeId);

    const referralAfterFirst = await prisma.referral.findUniqueOrThrow({ where: { refereeId } });
    assert.equal(referralAfterFirst.status, "REWARDED");
    const creditsAfterFirst = await prisma.referralCredit.findMany({ where: { userId: refereeId } });
    assert.equal(creditsAfterFirst.length, 1);

    // A second RELEASED escrow brings the referee's release count to 2 —
    // maybeGrantFirstReleaseReward must not grant again.
    await createReleasedEscrow({ senderId: refereeId, travelerId });
    await maybeGrantFirstReleaseReward(refereeId);

    const creditsAfterSecond = await prisma.referralCredit.findMany({ where: { userId: refereeId } });
    assert.equal(creditsAfterSecond.length, 1, "must not grant again on the second release");
  });

  it("does nothing for a user with zero RELEASED escrows", async () => {
    const soloId = await signupWithCode(app, { email: "mgr-d@test.local", phone: "+213559940043" });
    await maybeGrantFirstReleaseReward(soloId); // should not throw
    const credit = await findReferralCredit(soloId);
    assert.equal(credit, null);
  });

  it("does not fire for a LOCKED (not yet RELEASED) escrow", async () => {
    const referrerId = await signupWithCode(app, { email: "mgr-e@test.local", phone: "+213559940044" });
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId }, select: { referralCode: true },
    });
    const refereeId = await signupWithCode(app, {
      email: "mgr-f@test.local", phone: "+213559940045", referralCode: referrer.referralCode,
    });
    const travelerId = await signupWithCode(app, { email: "mgr-g@test.local", phone: "+213559940046" });

    await createReleasedEscrow({ senderId: refereeId, travelerId, status: "LOCKED" });
    await maybeGrantFirstReleaseReward(refereeId);

    const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId } });
    assert.equal(referral.status, "PENDING", "a LOCKED (not RELEASED) escrow must not trigger the reward");
  });
});

console.log("referral-reward tests: done");
