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
});

console.log("referral-reward tests: done");
