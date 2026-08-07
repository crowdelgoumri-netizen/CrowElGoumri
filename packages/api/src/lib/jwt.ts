/**
 * JWT helpers — access + refresh token pair.
 *
 * Access token:  short-lived (15m), sent on every request, carries userId + role.
 * Refresh token: long-lived (7d),  used once to mint a new access token.
 *
 * Both are signed with the same secret in v1 (acceptable for a monolith;
 * split to asymmetric RS256 + separate refresh secret when we extract
 * the auth service).
 */
import type { FastifyInstance } from "fastify";

export interface AccessTokenPayload {
  sub: string; // userId
  role: string; // UserRole
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  // jti (JWT ID) would go here for a revocation list — deferred to v1.1
}

export function signAccessToken(
  app: FastifyInstance,
  payload: { sub: string; role: string },
): string {
  return app.jwt.sign(
    { ...payload, type: "access" } satisfies AccessTokenPayload,
    { expiresIn: process.env.JWT_ACCESS_TTL || "15m" },
  );
}

export function signRefreshToken(
  app: FastifyInstance,
  userId: string,
): string {
  return app.jwt.sign(
    { sub: userId, type: "refresh" } satisfies RefreshTokenPayload,
    { expiresIn: process.env.JWT_REFRESH_TTL || "7d" },
  );
}
