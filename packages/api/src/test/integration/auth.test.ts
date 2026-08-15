/**
 * Auth integration tests — signup, verify-phone, login, refresh.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../helpers/setup.js";
import { signupAndGetToken } from "../helpers/auth.js";
import { ensureCleanDB } from "../helpers/db.js";

describe("auth", () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureCleanDB();
    ({ app } = await buildTestServer());
  });

  after(async () => { await app.close(); });

  describe("POST /auth/signup", () => {
    it("creates an account and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: {
          email: "new@test.local",
          phone: "+213559990001",
          password: "Password123",
          firstName: "New",
          lastName: "User",
        },
      });
      assert.equal(res.statusCode, 201);
      const body = res.json();
      assert.equal(body.user.email, "new@test.local");
      assert.ok(body.user.id);
    });

    it("rejects duplicate email with 409", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: {
          email: "dup@test.local",
          phone: "+213559990002",
          password: "Password123",
          firstName: "Dup",
          lastName: "User",
        },
      });
      const res = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: {
          email: "dup@test.local",
          phone: "+213559990003",
          password: "Password123",
          firstName: "Dup",
          lastName: "User",
        },
      });
      assert.equal(res.statusCode, 409);
      assert.ok(res.json().error.includes("email"));
    });

    it("rejects too-short password with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: {
          email: "short@test.local",
          phone: "+213559990004",
          password: "abc",
          firstName: "Short",
          lastName: "User",
        },
      });
      assert.equal(res.statusCode, 400);
    });
  });

  describe("POST /auth/verify-phone", () => {
    it("accepts dev-mode OTP and returns tokens", async () => {
      const phone = "+213559990010";
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: "verify@test.local", phone, password: "Password123", firstName: "V", lastName: "User" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/auth/verify-phone",
        payload: { phone, code: "000000" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.ok(body.accessToken);
      assert.ok(body.refreshToken);
      assert.equal(body.user.kycLevel, "BASIC");
    });

    it("rejects wrong OTP with 400", async () => {
      const phone = "+213559990011";
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: "wrongotp@test.local", phone, password: "Password123", firstName: "W", lastName: "User" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/auth/verify-phone",
        payload: { phone, code: "123456" },
      });
      assert.equal(res.statusCode, 400);
      assert.ok(res.json().error.includes("Invalid"));
    });
  });

  describe("POST /auth/login", () => {
    it("returns tokens for verified user", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: "login-test@test.local", phone: "+213559990020", password: "Password123", firstName: "L", lastName: "User" },
      });
      await app.inject({
        method: "POST",
        url: "/auth/verify-phone",
        payload: { phone: "+213559990020", code: "000000" },
      });
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "login-test@test.local", password: "Password123" },
      });
      assert.equal(loginRes.statusCode, 200);
      assert.ok(loginRes.json().accessToken);
    });

    it("rejects wrong password with 401", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: "badpw@test.local", phone: "+213559990021", password: "Password123", firstName: "B", lastName: "User" },
      });
      await app.inject({
        method: "POST",
        url: "/auth/verify-phone",
        payload: { phone: "+213559990021", code: "000000" },
      });
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "badpw@test.local", password: "WrongPassword" },
      });
      assert.equal(res.statusCode, 401);
    });

    it("rejects unverified user with 403", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: "unverified@test.local", phone: "+213559990022", password: "Password123", firstName: "U", lastName: "User" },
      });
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "unverified@test.local", password: "Password123" },
      });
      assert.equal(res.statusCode, 403);
      assert.ok(res.json().error.includes("not verified"));
    });
  });

  describe("POST /auth/refresh", () => {
    it("exchanges a valid refresh token for a new access token", async () => {
      const { refreshToken } = await signupAndGetToken(app);

      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken },
      });
      assert.equal(res.statusCode, 200);
      assert.ok(res.json().accessToken);
    });

    it("rejects an invalid token with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "garbage" },
      });
      assert.equal(res.statusCode, 401);
    });
  });
});
