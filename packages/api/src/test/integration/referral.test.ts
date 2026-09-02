/**
 * Referral integration tests — code assignment at signup, referral-code
 * entry creating a PENDING Referral, and the /referrals/me read endpoint
 * (added in a later task — this file grows across the referral build-out).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/setup.js";
import { ensureCleanDB } from "../helpers/db.js";
import { prisma } from "@crowdshipping/db";

describe("referral signup flow", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  it("assigns every new user an 8-char uppercase-alphanumeric referralCode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "ref-a@test.local",
        phone: "+213559930001",
        password: "Password123",
        firstName: "Ref",
        lastName: "A",
      },
    });
    assert.equal(res.statusCode, 201);
    // referralCode isn't in the signup response by design (kept minimal —
    // see Task 9's GET /referrals/me for the read path) — assert directly
    // via Prisma that signup actually populated it.
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: res.json().user.id },
      select: { referralCode: true },
    });
    assert.ok(/^[A-Z0-9]{8}$/.test(user.referralCode), `unexpected code: ${user.referralCode}`);
  });

  it("accepts signup with no referralCode and succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "ref-b@test.local",
        phone: "+213559930002",
        password: "Password123",
        firstName: "Ref",
        lastName: "B",
      },
    });
    assert.equal(res.statusCode, 201);
  });

  it("ignores an unknown referralCode and still creates the account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "ref-c@test.local",
        phone: "+213559930003",
        password: "Password123",
        firstName: "Ref",
        lastName: "C",
        referralCode: "NOPE0000".slice(0, 8), // well-formed but not assigned to anyone
      },
    });
    assert.equal(res.statusCode, 201);
  });

  it("creates a PENDING Referral when a valid referralCode is entered", async () => {
    // Signup + verify the referrer so we can read their code via /referrals/me
    // (endpoint added in Task 9 — until then, assert indirectly: a second
    // signup using an invented code tied to a real user must not error, and
    // the referee's own signup must still succeed).
    const referrerSignup = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "ref-referrer@test.local",
        phone: "+213559930010",
        password: "Password123",
        firstName: "Referrer",
        lastName: "One",
      },
    });
    assert.equal(referrerSignup.statusCode, 201);
    const referrerId = referrerSignup.json().user.id as string;

    // Fetch the referrer's code directly via Prisma — /referrals/me doesn't
    // exist until Task 9, and this test only needs to prove the Referral
    // row gets created correctly, not exercise the read endpoint.
    const referrer = await prisma.user.findUniqueOrThrow({
      where: { id: referrerId },
      select: { referralCode: true },
    });

    const refereeSignup = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "ref-referee@test.local",
        phone: "+213559930011",
        password: "Password123",
        firstName: "Referee",
        lastName: "One",
        referralCode: referrer.referralCode,
      },
    });
    assert.equal(refereeSignup.statusCode, 201);
    const refereeId = refereeSignup.json().user.id as string;

    const referral = await prisma.referral.findUnique({ where: { refereeId } });
    assert.ok(referral, "expected a Referral row to be created");
    assert.equal(referral!.referrerId, referrerId);
    assert.equal(referral!.status, "PENDING");
    assert.equal(referral!.code, referrer.referralCode);
  });
});

describe("GET /referrals/me", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  it("returns the caller's own code and an empty list with no referrals", async () => {
    const phone = "+213559930020";
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email: "me-a@test.local", phone,
        password: "Password123", firstName: "Me", lastName: "A",
      },
    });
    await app.inject({ method: "POST", url: "/auth/verify-phone", payload: { phone, code: "000000" } });
    const login = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "me-a@test.local", password: "Password123" },
    });
    const { accessToken } = login.json();

    const res = await app.inject({
      method: "GET", url: "/referrals/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.referralCode.length, 8);
    assert.deepStrictEqual(body.referrals, []);
  });

  it("lists a referee once they sign up with the caller's code", async () => {
    await app.inject({
      method: "POST", url: "/auth/signup",
      payload: {
        email: "me-referrer@test.local", phone: "+213559930030",
        password: "Password123", firstName: "Referrer", lastName: "Two",
      },
    });
    await app.inject({
      method: "POST", url: "/auth/verify-phone",
      payload: { phone: "+213559930030", code: "000000" },
    });
    const login = await app.inject({
      method: "POST", url: "/auth/login",
      payload: { email: "me-referrer@test.local", password: "Password123" },
    });
    const { accessToken } = login.json();

    const referrer = await prisma.user.findUniqueOrThrow({
      where: { email: "me-referrer@test.local" }, select: { referralCode: true },
    });
    await app.inject({
      method: "POST", url: "/auth/signup",
      payload: {
        email: "me-referee@test.local", phone: "+213559930031",
        password: "Password123", firstName: "Referee", lastName: "Two",
        referralCode: referrer.referralCode,
      },
    });

    const res = await app.inject({
      method: "GET", url: "/referrals/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.referrals.length, 1);
    assert.equal(body.referrals[0].refereeFirstName, "Referee");
    assert.equal(body.referrals[0].status, "PENDING");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/referrals/me" });
    assert.equal(res.statusCode, 401);
  });
});

console.log("referral signup tests: done");
