/**
 * Auth helper for integration tests — creates a verified user and returns tokens.
 * Uses the dev-mode OTP (000000) since TWILIO_VERIFY_SERVICE_SID won't be set.
 *
 * NOTE: `node --test` loads each file as a separate module scope, so module-level
 * counters reset per file. We use crypto.randomUUID() to guarantee globally unique
 * identifiers across all concurrently-running test files.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export async function signupAndGetToken(
  app: FastifyInstance,
  overrides?: Partial<{
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
  }>,
): Promise<TokenResult> {
  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const email = overrides?.email ?? `test-${id}@e2e.crowdshipping.local`;
  // Phone must be digits only (E.164 regex /^\+\d{6,15}$/).
  // Use Date.now() to avoid hex chars from UUID which contain a-f.
  const phoneNum = String(Date.now()).slice(-8);
  const phone = overrides?.phone ?? `+21355${phoneNum}`;
  const password = overrides?.password ?? "Password123";
  const firstName = overrides?.firstName ?? "Test";
  const lastName = overrides?.lastName ?? "User";

  // 1) Signup
  const signupRes = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { email, phone, password, firstName, lastName },
  });
  if (signupRes.statusCode !== 201) {
    throw new Error(`signup failed (${signupRes.statusCode}): ${signupRes.body}`);
  }

  // 2) Verify phone (dev OTP)
  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/verify-phone",
    payload: { phone, code: "000000" },
  });
  if (verifyRes.statusCode !== 200) {
    throw new Error(`verify-phone failed (${verifyRes.statusCode}): ${verifyRes.body}`);
  }
  const verifyBody = verifyRes.json() as { accessToken: string; refreshToken: string; user: { id: string } };

  return {
    accessToken: verifyBody.accessToken,
    refreshToken: verifyBody.refreshToken,
    userId: verifyBody.user.id,
  };
}
