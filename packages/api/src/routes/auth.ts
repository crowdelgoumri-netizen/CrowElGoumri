/**
 * Auth routes — signup, login, phone verification, token refresh.
 *
 * Phone verification runs in two modes:
 *   - dev mode (TWILIO_VERIFY_SERVICE_SID unset): accepts "000000",
 *     logs the would-be OTP to the console. Lets you test the full
 *     signup→verify→login flow without a Twilio account.
 *   - prod mode (Twilio configured): calls Twilio Verify API to send
 *     and check real SMS codes.
 *
 * The verify step is separate from signup so a user can retry the OTP
 * without re-entering their details. A user is phone-verified (and
 * therefore usable) only after /verify-phone succeeds.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccessToken, signRefreshToken } from "../lib/jwt.js";
import { recomputeTrustForUser } from "../lib/trust-service.js";

// ── Schemas ──────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+\d{6,15}$/, "phone must be E.164 (e.g. +213XXXXXXXXX)"),
  password: z.string().min(8, "password must be ≥ 8 chars"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^\+\d{6,15}$/),
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits"),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// ── Dev-mode OTP ─────────────────────────────────────────────────────
const DEV_OTP = "000000";
const isDevMode = () => !process.env.TWILIO_VERIFY_SERVICE_SID;

// ── Referral code generation ─────────────────────────────────────────
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0/O/1/I

function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_CODE_ALPHABET[
      Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)
    ];
  }
  return code;
}

// ── Routes ───────────────────────────────────────────────────────────
export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/signup — create account (unverified phone)
  app.post("/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { email, phone, password, firstName, lastName } = parsed.data;

    // Uniqueness check (Prisma throws on unique violation, but a friendly
    // message is better than a 500 for the common case).
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing) {
      const field = existing.email === email ? "email" : "phone";
      return reply
        .code(409)
        .send({ error: `An account with this ${field} already exists` });
    }

    const passwordHash = await hashPassword(password);

    // Generate unique referral code (retry on collision, though unlikely with 33^8 space)
    let referralCode: string;
    let retries = 0;
    const maxRetries = 10;
    while (retries < maxRetries) {
      referralCode = generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode },
      });
      if (!existing) break;
      retries++;
    }
    if (retries === maxRetries) {
      return reply.code(500).send({ error: "Failed to generate unique referral code" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName.charAt(0)}.`,
        kycLevel: "NONE",
        referralCode: referralCode!,
      },
      select: { id: true, email: true, phone: true, firstName: true },
    });

    // In dev mode we "send" the OTP by logging it. In prod we'd call
    // Twilio Verify's /verifications endpoint here.
    if (isDevMode()) {
      app.log.info({ phone }, `📱 dev-mode OTP for ${phone}: ${DEV_OTP}`);
    }

    return reply.code(201).send({
      user,
      message: isDevMode()
        ? "Account created. Verify your phone with code 000000 (dev mode)."
        : "Account created. Check your phone for a verification code.",
    });
  });

  // POST /auth/verify-phone — confirm phone ownership, upgrade KYC to BASIC
  app.post("/verify-phone", async (req, reply) => {
    const parsed = verifyPhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { phone, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return reply.code(404).send({ error: "No account with this phone" });
    }

    // Check the code
    const codeValid = isDevMode() ? code === DEV_OTP : await checkTwilioOtp(phone, code);
    if (!codeValid) {
      return reply.code(400).send({ error: "Invalid or expired code" });
    }

    // Upgrade KYC: NONE → BASIC (phone + email now verified)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { kycLevel: "BASIC", kycVerifiedAt: new Date() },
      select: { id: true, kycLevel: true },
    });
    // Trust weighs kycLevel directly — recompute now instead of leaving the
    // cached User.trustScore/trustBadge stale until some later signal fires.
    await recomputeTrustForUser(user.id);

    const accessToken = signAccessToken(app, {
      sub: user.id,
      role: user.role,
    });
    const refreshToken = signRefreshToken(app, user.id);

    return reply.send({
      user: updated,
      accessToken,
      refreshToken,
    });
  });

  // POST /auth/login — email + password (requires phone-verified account)
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    if (user.isBanned) {
      return reply.code(403).send({ error: "Account suspended" });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    // Block login if phone not yet verified — they must complete /verify-phone
    if (user.kycLevel === "NONE") {
      return reply.code(403).send({
        error: "Phone not verified",
        action: "verify-phone",
        phone: user.phone,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = signAccessToken(app, { sub: user.id, role: user.role });
    const refreshToken = signRefreshToken(app, user.id);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        kycLevel: user.kycLevel,
      },
      accessToken,
      refreshToken,
    });
  });

  // POST /auth/refresh — exchange refresh token for new access token
  app.post("/refresh", async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const payload = app.jwt.verify(parsed.data.refreshToken) as {
        sub: string;
        type: string;
      };
      if (payload.type !== "refresh") {
        return reply.code(401).send({ error: "Invalid token type" });
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isBanned: true },
      });
      if (!user || user.isBanned) {
        return reply.code(401).send({ error: "User not found or banned" });
      }
      const accessToken = signAccessToken(app, {
        sub: user.id,
        role: user.role,
      });
      return reply.send({ accessToken });
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });
};

// ── Twilio Verify integration (called only in prod mode) ─────────────
async function checkTwilioOtp(phone: string, code: string): Promise<boolean> {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
  ).toString("base64");
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${sid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    },
  );
  const data = (await res.json()) as { status?: string };
  return data.status === "approved";
}
