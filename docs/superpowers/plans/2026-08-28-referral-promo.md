# Referral / Promo (F14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Peer-to-peer referral: every user gets a personal code; a referee entering it at signup and completing their first shipment unlocks a one-shot platform-fee discount credit for both parties.

**Architecture:** A `Referral` row links referrer→referee, created at signup. A `ReferralCredit` ledger (not a balance field) holds one row per earned reward so unlimited stacked referrals compose without balance math. The reward triggers inside the existing `releaseEscrowForParcel` helper on a user's first `RELEASED` escrow; the discount consumes inside the existing `computePayoutBreakdown` money math on the next `POST /escrow/:parcelId/fund`.

**Tech Stack:** Fastify + Zod (API), Prisma/Postgres (DB), `node:test` + `node:assert/strict` (API tests, no DB mocking — pure logic gets pure unit tests, DB-touching behavior gets real-DB integration tests via `app.inject`), Expo Router + i18next + NativeWind (mobile).

**Spec:** [docs/superpowers/specs/2026-08-28-referral-promo-design.md](../specs/2026-08-28-referral-promo-design.md) — read it alongside this plan; it has the full rationale for every decision below.

## Global Constraints

- Reward trigger: referee's **first** `EscrowLedger` row to reach `RELEASED` (as sender or traveler) — never signup alone, never KYC alone.
- Reward shape: one-shot flat `discountPct` (default **50%**) off the platform fee, one `ReferralCredit` row per party per successful referral. No running EUR balance.
- Discount must reduce `platformFee` itself (not just `totalAmount`) — `travelerPayout = totalAmount − platformFee − insurance` in the existing money model, so discounting `totalAmount` alone would silently cut the *traveler's* payout. See spec's "Consommation du crédit" section.
- No admin-created generic promo codes in this scope — peer referral only.
- No cap on lifetime referrals per user, no credit expiry.
- Referral codes are 8 chars, uppercase alphanumeric, excluding `0/O/1/I`, always generated and compared upper-case.
- A signup with an invalid/unknown `referralCode` must still succeed (never blocks account creation).
- Follow existing test convention exactly: pure/deterministic logic (money math, code format) gets a DB-free `node:test` file; DB-dependent behavior gets an HTTP integration test via `buildTestServer()` + `ensureCleanDB()` + `app.inject()`. Never mock the Prisma client (see `trust-service.test.ts` header comment). Routes that call Stripe (`POST /escrow/:parcelId/fund`, escrow release) have **zero** existing integration coverage in this codebase (placeholder `STRIPE_SECRET_KEY`, no mock) — this plan does not change that boundary; it isolates the referral-specific logic so it's testable without crossing it.
- Two separate test commands, and using the wrong one gives a false pass, not an error: `pnpm --filter @crowdshipping/api test` globs `src/test/*.test.ts` only (top-level pure-logic files); `pnpm --filter @crowdshipping/api test:integration` globs `src/test/integration/*.test.ts`. A file placed under `integration/` but verified with the plain `test` command will silently never run.

---

### Task 1: Prisma schema — `Referral`, `ReferralCredit`, `User.referralCode`

**Files:**
- Modify: `packages/db/schema.prisma`
- Modify: `packages/api/src/test/helpers/db.ts:9-22`

**Interfaces:**
- Produces: Prisma models `Referral` (`id, referrerId, refereeId, code, status: ReferralStatus, createdAt, rewardedAt`) and `ReferralCredit` (`id, userId, discountPct: Decimal, consumedAt, consumedEscrowId, createdAt`); enum `ReferralStatus = PENDING | REWARDED`; `User.referralCode: String @unique`. Every later task's Prisma calls (`prisma.referral.*`, `prisma.referralCredit.*`, `user.referralCode`) depend on this exact shape.

- [ ] **Step 1: Add the enum, fields, and models to the schema**

Open `packages/db/schema.prisma`. Add this enum near the other enums (after `enum AddressLevel` at line 116, before `model User` at line 126):

```prisma
enum ReferralStatus {
  PENDING
  REWARDED
}
```

Inside `model User` (around line 126-179), add the new field in the "Meta" section (after `deviceTokens String[]` at line 164) and two new relations in the "Relations" section (after `kycSubmissions KycSubmission[]` at line 175):

```prisma
  referralCode    String     @unique @db.VarChar(8)
```

```prisma
  referralsMade     Referral[]       @relation("ReferralsMade")
  referralReceived  Referral?        @relation("ReferralsReceived")
  referralCredits   ReferralCredit[]
```

Add `@@index([referralCode])` alongside the existing `@@index` lines at 177-178 (unique already indexes it, but every other unique-looking lookup field like `email`/`phone` here relies on the implicit unique index too — skip the explicit index, Prisma's `@unique` already creates one; do not add a redundant `@@index([referralCode])`).

Add the two new models at the end of the file (after the last model, `KycSubmission` — check the file's actual end with `Read` first since line numbers may have drifted):

```prisma
model Referral {
  id          String         @id @default(uuid())
  referrerId  String
  referrer    User           @relation("ReferralsMade", fields: [referrerId], references: [id])
  refereeId   String         @unique
  referee     User           @relation("ReferralsReceived", fields: [refereeId], references: [id])
  code        String
  status      ReferralStatus @default(PENDING)
  createdAt   DateTime       @default(now())
  rewardedAt  DateTime?

  @@index([referrerId])
  @@index([status])
}

model ReferralCredit {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  discountPct      Decimal   @db.Decimal(4, 2)
  consumedAt       DateTime?
  consumedEscrowId String?
  createdAt        DateTime  @default(now())

  @@index([userId, consumedAt])
}
```

- [ ] **Step 2: Push the schema and regenerate the client**

Run: `pnpm --filter @crowdshipping/db push`
Expected: Prisma reports the new tables/columns created, no errors. (This project uses `prisma db push` for dev schema sync — there's no committed `migrations/` directory.)

Then run: `pnpm --filter @crowdshipping/db generate`
Expected: `@prisma/client` regenerates with `prisma.referral`, `prisma.referralCredit`, and `ReferralStatus` types available.

- [ ] **Step 3: Add the new tables to the test-DB truncation list**

In `packages/api/src/test/helpers/db.ts`, add `"ReferralCredit"` and `"Referral"` to the `tables` array before `"User"` (they have FKs to `User`, so must truncate first — same reasoning as `KycSubmission` above them):

```ts
    "ChatMessage",
    "Notification",
    "Rating",
    "Dispute",
    "CustomsClearanceLog",
    "TripCheckpoint",
    "EscrowLedger",
    "Parcel",
    "Trip",
    "KycSubmission",
    "ReferralCredit",
    "Referral",
    "User",
```

- [ ] **Step 4: Verify the whole workspace still typechecks**

Run: `pnpm -r typecheck`
Expected: all 5 projects (`apps/admin`, `apps/mobile`, `packages/db`, `packages/matching`, `packages/api`) report `Done` with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/schema.prisma packages/api/src/test/helpers/db.ts
git commit -m "Schema: add Referral + ReferralCredit models, User.referralCode"
```

---

### Task 2: Referral code generation

**Files:**
- Create: `packages/api/src/lib/referral-code.ts`
- Test: `packages/api/src/test/referral-code.test.ts`

**Interfaces:**
- Produces: `generateReferralCode(): string` — 8 uppercase alphanumeric chars, excluding `0/O/1/I`. Task 3 imports this to assign `User.referralCode` at signup.

- [ ] **Step 1: Write the failing test**

```ts
// packages/api/src/test/referral-code.test.ts
/**
 * Referral code format — pure logic, no DB (see Global Constraints: pure
 * logic gets a DB-free test, same convention as stripe-money.test.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateReferralCode } from "../lib/referral-code.js";

describe("generateReferralCode", () => {
  it("returns an 8-character string", () => {
    assert.strictEqual(generateReferralCode().length, 8);
  });

  it("only uses uppercase alphanumeric characters, excluding 0/O/1/I", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      assert.ok(/^[A-Z0-9]{8}$/.test(code), `unexpected chars in ${code}`);
      assert.ok(!/[0O1I]/.test(code), `ambiguous char in ${code}`);
    }
  });

  it("produces distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateReferralCode()));
    assert.ok(codes.size > 490, `expected near-500 unique codes, got ${codes.size}`);
  });
});

console.log("referral-code tests: done");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test`
Expected: FAIL — `Cannot find module '../lib/referral-code.js'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/api/src/lib/referral-code.ts
/**
 * Referral code generation — 8-char uppercase alphanumeric, excluding
 * 0/O/1/I so a code read aloud or handwritten is never ambiguous.
 *
 * Uses crypto.randomInt (not Math.random) — cheap to do right, and a
 * referral code is a bearer credential of sorts (whoever holds it can
 * attribute a signup to a referrer), so it shouldn't be predictable.
 *
 * Collision handling lives at the call site (auth.ts retries on the
 * unique-constraint violation), not here — this function has no DB access.
 */
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS — all `referral-code tests` green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/referral-code.ts packages/api/src/test/referral-code.test.ts
git commit -m "Add referral code generation"
```

---

### Task 3: Signup wiring — assign codes, accept a referral code, create `Referral`

**Files:**
- Modify: `packages/api/src/routes/auth.ts:23-30` (schema), `:55-83` (signup handler)
- Test: `packages/api/src/test/integration/referral.test.ts` (new file)

**Interfaces:**
- Consumes: `generateReferralCode()` from Task 2.
- Produces: `POST /auth/signup` accepts optional `referralCode: string` in the body; every created `User` gets a `referralCode`; a valid `referralCode` on signup creates a `Referral({referrerId, refereeId, code, status: "PENDING"})` row. Task 9's `GET /referrals/me` reads `Referral` rows this creates.

- [ ] **Step 1: Write the failing integration test**

```ts
// packages/api/src/test/integration/referral.test.ts
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

console.log("referral signup tests: done");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test:integration` (note: `test:integration`, not `test` — the plain `test` script's glob `src/test/*.test.ts` does not reach `src/test/integration/`)
Expected: FAIL — either a 500 (schema field not selected in signup's create) or the `referralCode` field simply not populated / no `Referral` row found. The exact failure is the last assertion (`referral` is `null`) since `referralCode` isn't parsed from the body yet.

- [ ] **Step 3: Implement the schema + handler changes**

In `packages/api/src/routes/auth.ts`, add the import at the top (after the existing imports around line 19):

```ts
import { generateReferralCode } from "../lib/referral-code.js";
```

Extend `signupSchema` (lines 23-30):

```ts
const signupSchema = z.object({
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+\d{6,15}$/, "phone must be E.164 (e.g. +213XXXXXXXXX)"),
  password: z.string().min(8, "password must be ≥ 8 chars"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  referralCode: z.string().length(8).toUpperCase().optional(),
});
```

In the `POST /signup` handler, replace the destructure and user-creation block (lines 60-83) with:

```ts
    const { email, phone, password, firstName, lastName, referralCode } = parsed.data;

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

    // A referralCode collision is astronomically unlikely (33^8 keyspace)
    // but the field is @unique, so retry on P2002 rather than letting a
    // rare collision surface as a 500.
    let user;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        user = await prisma.user.create({
          data: {
            email,
            phone,
            passwordHash,
            firstName,
            lastName,
            displayName: `${firstName} ${lastName.charAt(0)}.`,
            kycLevel: "NONE",
            referralCode: generateReferralCode(),
          },
          select: { id: true, email: true, phone: true, firstName: true },
        });
        break;
      } catch (err) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code: string }).code === "P2002";
        if (!isUniqueViolation || attempt === 4) throw err;
      }
    }
    if (!user) throw new Error("Failed to create user after retries");

    // referralCode entry is signup-only and never blocks account creation:
    // an unknown code is silently ignored (typo tolerance beats a hard error
    // over a promo code).
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (referrer) {
        await prisma.referral.create({
          data: { referrerId: referrer.id, refereeId: user.id, code: referralCode },
        });
      }
    }
```

Leave the rest of the handler (OTP dispatch, response) unchanged — it already reads `user` afterward.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test:integration`
Expected: PASS — all `referral signup tests` green, and the full suite (`auth.test.ts` etc.) still passes since `signupSchema`'s new field is optional.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/auth.ts packages/api/src/test/integration/referral.test.ts
git commit -m "Auth: assign referral codes at signup, record referrals"
```

---

### Task 4: Discount-aware `computePayoutBreakdown`

**Files:**
- Modify: `packages/api/src/lib/stripe.ts:78-95`
- Modify: `packages/api/src/test/stripe-money.test.ts` (add cases)

**Interfaces:**
- Produces: `computePayoutBreakdown(travelerPrice, feeBps?, insuranceFee?, discountPct?)` — 4th param, default `0`, fully backward-compatible. Task 8 passes a `ReferralCredit.discountPct` here.

- [ ] **Step 1: Write the failing tests**

Add to `packages/api/src/test/stripe-money.test.ts`, inside the existing `describe("computePayoutBreakdown", ...)` block (after the last `it(...)` at line 77, before the closing `});`):

```ts
  it("applies a referral discount to the platform fee without touching the traveler payout", () => {
    // 30 EUR price → 3 EUR raw fee. 50% discount → 1.5 EUR off → fee = 1.5.
    const b = computePayoutBreakdown(30, 1000, 0, 50);
    assert.strictEqual(b.platformFee, 1.5);
    assert.strictEqual(b.travelerPayout, 30, "traveler must still receive the full price");
    assert.strictEqual(b.totalAmount, 31.5); // price + discounted fee
  });

  it("a 100% discount waives the platform fee entirely", () => {
    const b = computePayoutBreakdown(30, 1000, 0, 100);
    assert.strictEqual(b.platformFee, 0);
    assert.strictEqual(b.totalAmount, 30);
    assert.strictEqual(b.travelerPayout, 30);
  });

  it("defaults to no discount when the 4th param is omitted", () => {
    const withDefault = computePayoutBreakdown(30);
    const explicitZero = computePayoutBreakdown(30, 1000, 0, 0);
    assert.deepStrictEqual(withDefault, explicitZero);
  });

  it("echoes the applied discountPct back in the breakdown for the client to display", () => {
    const b = computePayoutBreakdown(30, 1000, 0, 50);
    assert.strictEqual(b.discountPct, 50);
    assert.strictEqual(computePayoutBreakdown(30).discountPct, 0);
  });

  it("rounds the discount amount to avoid floating-point drift (e.g. 33% discount)", () => {
    // 70 EUR price → 7 EUR raw fee. 33% off → 4.69, not a dirty float like
    // 4.6899999999999995, and not euro-granularity-rounded to 5.
    const b = computePayoutBreakdown(70, 1000, 0, 33);
    assert.strictEqual(b.platformFee, 4.69);
    assert.strictEqual(b.totalAmount, 74.69);
    assert.strictEqual(b.travelerPayout, 70);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test`
Expected: FAIL — the first two new tests fail because `discountPct` isn't applied yet (`platformFee` comes back as `3`, not `1.5`).

- [ ] **Step 3: Implement the discount**

Replace `computePayoutBreakdown` in `packages/api/src/lib/stripe.ts` (lines 78-95). Also add `discountPct: number;` to the `PayoutBreakdown` interface above it (line 59-68), documented as "the referral discount % actually applied, 0 if none — echoed back so the client can show a discount banner":

```ts
export interface PayoutBreakdown {
  /** Amount charged to the sender (traveler price + insurance + fee). */
  totalAmount: number;
  /** Platform commission (10% default), charged on top of the price. */
  platformFee: number;
  /** Insurance premium, pass-through to the insurer (0 in v1). */
  insuranceFee: number;
  /** Net amount transferred to the traveler on release. */
  travelerPayout: number;
  /** Referral discount % actually applied to the fee, 0 if none. */
  discountPct: number;
}

export function computePayoutBreakdown(
  travelerPrice: Prisma.Decimal | number | string,
  feeBps: number = env.STRIPE_PLATFORM_FEE_BPS,
  insuranceFee: Prisma.Decimal | number | string = 0,
  discountPct: Prisma.Decimal | number | string = 0,
): PayoutBreakdown {
  const price = Number(travelerPrice);
  const insurance = Number(insuranceFee);
  const discount = Number(discountPct);

  // Fee is charged on the traveler price, rounded to the cent. Rounding
  // half-up avoids the platform absorbing sub-cent drift over thousands of
  // transactions.
  const rawPlatformFee = Math.round((price * feeBps) / 10000);

  // Referral discount reduces the fee itself, not totalAmount directly —
  // travelerPayout is derived as (totalAmount - platformFee - insurance),
  // so discounting the fee (which totalAmount includes) leaves the
  // traveler's payout untouched. Discounting totalAmount alone would
  // silently cut the traveler's payout instead of the platform's cut.
  // Round the final fee to the cent, not the intermediate discount amount —
  // rounding discountAmount alone (e.g. Math.round(7 * 0.33) = 2) snaps to
  // whole-EUR granularity, which is wrong for a percentage discount (7 EUR
  // fee, 33% off should be 4.69, not 5). Match the *100/100 pattern used
  // below for totalAmount/travelerPayout.
  const discountAmount = rawPlatformFee * (discount / 100);
  const platformFee = Math.round((rawPlatformFee - discountAmount) * 100) / 100;

  const totalAmount = Math.round((price + insurance + platformFee) * 100) / 100;
  const travelerPayout =
    Math.round((totalAmount - platformFee - insurance) * 100) / 100;

  return { totalAmount, platformFee, insuranceFee: insurance, travelerPayout, discountPct: discount };
}
```

Note: the pre-existing tests in this file construct expected objects with `assert.strictEqual` on individual fields (not `assert.deepStrictEqual` against a full object literal), so adding `discountPct` to the returned shape doesn't break them — only the new `deepStrictEqual` test above needs both sides to include it, which they do since both go through `computePayoutBreakdown`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS — every `stripe-money` test green, including the 3 new ones and all pre-existing ones (unaffected since default `discountPct = 0`).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/stripe.ts packages/api/src/test/stripe-money.test.ts
git commit -m "Money: support a referral discount on the platform fee"
```

---

### Task 5: Notification types for referral rewards

**Files:**
- Modify: `packages/api/src/lib/notifications.ts:26-53` (types + payload), `:75-135` (templates)
- Modify: `packages/api/src/test/notifications.test.ts` (add cases)

**Interfaces:**
- Produces: `NotificationType` gains `"REFERRAL_REWARDED_REFERRER"` and `"REFERRAL_REWARDED_REFEREE"`; `NotificationPayload` gains `discountPct?: number`. Task 6's `grantReferralReward` calls `notify(userId, "REFERRAL_REWARDED_REFERRER" | "REFERRAL_REWARDED_REFEREE", { discountPct })`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/api/src/test/notifications.test.ts`, inside `describe("message templates", ...)`: add the two new types to the `types` array at line 19-23, and add a dedicated interpolation test after the existing ones (near line 50):

```ts
  it("interpolates discountPct into REFERRAL_REWARDED_REFERRER", () => {
    const { body } = renderMessage("REFERRAL_REWARDED_REFERRER", { discountPct: 50 });
    assert.ok(body.includes("50"), `expected 50 in: ${body}`);
  });

  it("interpolates discountPct into REFERRAL_REWARDED_REFEREE", () => {
    const { body } = renderMessage("REFERRAL_REWARDED_REFEREE", { discountPct: 50 });
    assert.ok(body.includes("50"), `expected 50 in: ${body}`);
  });
```

(The `types` array loop at the top of the file will fail first since `REFERRAL_REWARDED_REFERRER`/`REFEREE` aren't valid `NotificationType` values yet — that's expected.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test`
Expected: FAIL — TypeScript compile error (the array literal isn't assignable to `NotificationType[]`) surfaces as a build/test failure.

- [ ] **Step 3: Implement**

In `packages/api/src/lib/notifications.ts`, add the two types to the `NotificationType` union (after `"PARCEL_SEIZED"` at line 39):

```ts
  | "PARCEL_SEIZED"
  | "REFERRAL_REWARDED_REFERRER"
  | "REFERRAL_REWARDED_REFEREE";
```

Add `discountPct?: number;` to `NotificationPayload` (after `disputeReason?: string;` at line 51):

```ts
  disputeReason?: string;
  discountPct?: number;
```

Add the two templates to the `TEMPLATES` map (after `DISPUTE_OPENED` at line 129-134, before the closing `};`):

```ts
  REFERRAL_REWARDED_REFERRER: (p) => ({
    title: "Parrainage récompensé 🎁",
    body: `Un ami que vous avez parrainé a effectué sa première livraison. Vous avez reçu ${p.discountPct ?? 50}% de réduction sur votre prochaine fee.`,
  }),
  REFERRAL_REWARDED_REFEREE: (p) => ({
    title: "Merci d'avoir utilisé un code de parrainage 🎁",
    body: `Vous avez reçu ${p.discountPct ?? 50}% de réduction sur votre prochaine fee.`,
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS — all `notifications.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/notifications.ts packages/api/src/test/notifications.test.ts
git commit -m "Notifications: add referral-reward templates"
```

---

### Task 6: Referral service — credit lookup/consumption + reward granting

**Files:**
- Create: `packages/api/src/lib/referral-service.ts`
- Test: `packages/api/src/test/integration/referral-reward.test.ts` (new file)

**Interfaces:**
- Consumes: `notify` from `../lib/notifications.js` (Task 5's new types), `prisma` from `@crowdshipping/db`.
- Produces:
  - `findReferralCredit(userId: string): Promise<{ id: string; discountPct: Prisma.Decimal } | null>` — Task 8 (escrow fund) calls this.
  - `consumeReferralCredit(creditId: string, escrowId: string): Promise<void>` — Task 8 calls this after the PaymentIntent is created.
  - `grantReferralReward(refereeId: string): Promise<void>` — Task 7 (escrow release) calls this when a user's release count is exactly 1. Idempotent: safe to call more than once for the same referee (a second call is a no-op because the first already flipped `Referral.status` to `REWARDED`).

- [ ] **Step 1: Write the failing integration test**

This exercises `grantReferralReward` directly against the real test DB (via signup fixtures over HTTP, same as every other integration test) — it deliberately never touches `EscrowLedger` or Stripe, since granting the reward only needs a `User` + a `PENDING` `Referral` to exist. The "count this user's RELEASED escrows and call this at the right time" wiring is Task 7, against the untested Stripe-gated release path (see Global Constraints).

```ts
// packages/api/src/test/integration/referral-reward.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test:integration`
Expected: FAIL — `Cannot find module '../../lib/referral-service.js'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/api/src/lib/referral-service.ts
/**
 * Referral reward granting + credit ledger — the DB-touching half of the
 * referral feature (code generation is the pure half, lib/referral-code.ts).
 *
 * grantReferralReward() is called from two places that each know a user
 * just reached their first RELEASED escrow (escrow-service.ts, for sender
 * and traveler independently) — see the design spec's "Déclenchement de la
 * récompense" section for why the count check lives at the call site.
 */
import { prisma, Prisma } from "@crowdshipping/db";
import { notify } from "./notifications.js";

const REFERRAL_DISCOUNT_PCT = 50;

/** Oldest unconsumed credit for a user, or null. FIFO — see design spec. */
export async function findReferralCredit(
  userId: string,
): Promise<{ id: string; discountPct: Prisma.Decimal } | null> {
  return prisma.referralCredit.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, discountPct: true },
  });
}

/** Marks a credit consumed against a specific escrow. Not reversible. */
export async function consumeReferralCredit(
  creditId: string,
  escrowId: string,
): Promise<void> {
  await prisma.referralCredit.update({
    where: { id: creditId },
    data: { consumedAt: new Date(), consumedEscrowId: escrowId },
  });
}

/**
 * Grants the referral reward for a referee's first completed shipment.
 * Idempotent: the PENDING → REWARDED transition is filtered on `status:
 * PENDING`, so a second call (or a race between sender/traveler-side
 * triggers) is a guaranteed no-op past the first successful grant.
 * Safe to call for a user with no referrer — silently does nothing.
 */
export async function grantReferralReward(refereeId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== "PENDING") return;

  const updated = await prisma.referral.updateMany({
    where: { refereeId, status: "PENDING" },
    data: { status: "REWARDED", rewardedAt: new Date() },
  });
  if (updated.count === 0) return; // lost the race to a concurrent call

  await prisma.referralCredit.createMany({
    data: [
      { userId: referral.referrerId, discountPct: REFERRAL_DISCOUNT_PCT },
      { userId: referral.refereeId, discountPct: REFERRAL_DISCOUNT_PCT },
    ],
  });

  await Promise.all([
    notify(referral.referrerId, "REFERRAL_REWARDED_REFERRER", { discountPct: REFERRAL_DISCOUNT_PCT }),
    notify(referral.refereeId, "REFERRAL_REWARDED_REFEREE", { discountPct: REFERRAL_DISCOUNT_PCT }),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test:integration`
Expected: PASS — all `referral-reward` tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/referral-service.ts packages/api/src/test/integration/referral-reward.test.ts
git commit -m "Add referral reward granting + credit ledger"
```

---

### Task 7: Trigger the reward on first escrow release

**Files:**
- Modify: `packages/api/src/lib/escrow-service.ts:106-127`

**Interfaces:**
- Consumes: `grantReferralReward` from Task 6.
- Produces: no new exports — `releaseEscrowForParcel`'s existing `ReleaseResult` return type is unchanged; this is a best-effort side effect, same pattern as the existing `notify(...)` call it sits next to.

This path runs through Stripe (`releaseEscrowForParcel` is only reachable after a real Stripe Transfer succeeds) and has no existing integration coverage — see Global Constraints. No new test is added here; the logic it calls (`grantReferralReward`) is already covered by Task 6's tests. Keep this change small and obviously correct.

- [ ] **Step 1: Add the trigger**

In `packages/api/src/lib/escrow-service.ts`, add the import (after `import { notify } from "./notifications.js";` at line 27):

```ts
import { grantReferralReward } from "./referral-service.js";
```

Replace the entire tail of `releaseEscrowForParcel`, from the `notify(...)` call through the function's closing `return` and brace (lines 116-127 in the original file — read the file first to confirm exact current line numbers, since Task 1-6 didn't touch this file):

```ts
  // Tell the traveler their payout landed. Best-effort — a push failure
  // never un-releases the escrow.
  notify(travelerId, "PAYOUT_SENT", {
    parcelId,
    amount: Number(updated.travelerPayout),
    currency: updated.currency,
  }).catch(() => {
    /* swallowed: provider errors are logged inside notify() */
  });

  // Referral reward: fires for either party on their first-ever RELEASED
  // escrow. grantReferralReward() itself no-ops for a user with no PENDING
  // referral, so it's cheap and safe to attempt for both unconditionally
  // once their release count is confirmed to be exactly 1.
  for (const userId of [updated.senderId, updated.travelerId]) {
    prisma.escrowLedger
      .count({
        where: {
          status: "RELEASED",
          OR: [{ senderId: userId }, { travelerId: userId }],
        },
      })
      .then((releasedCount) => {
        if (releasedCount === 1) return grantReferralReward(userId);
      })
      .catch((err) => {
        console.error(`referral reward check failed for user ${userId}:`, err);
      });
  }

  return { kind: "released", escrow: updated, transferId };
}
```

(The final `}` closes the `releaseEscrowForParcel` function itself — make sure the replacement doesn't leave a duplicate closing brace or a duplicate `return` statement behind.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crowdshipping/api typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/escrow-service.ts
git commit -m "Escrow: trigger referral reward on a user's first release"
```

---

### Task 8: Consume the credit at escrow funding

**Files:**
- Modify: `packages/api/src/routes/escrow.ts:26-36` (imports), `:128-200` (fund handler)

**Interfaces:**
- Consumes: `findReferralCredit`, `consumeReferralCredit` from Task 6; the 4th `discountPct` param of `computePayoutBreakdown` from Task 4.

Same Stripe-gated boundary as Task 7 — no new integration test here; `computePayoutBreakdown`'s discount math is already covered by Task 4, and `findReferralCredit`/`consumeReferralCredit` by Task 6.

- [ ] **Step 1: Add the import**

In `packages/api/src/routes/escrow.ts`, add to the existing import block (after `import { releaseEscrowForParcel } from "../lib/escrow-service.js";` at line 35):

```ts
import { findReferralCredit, consumeReferralCredit } from "../lib/referral-service.js";
```

- [ ] **Step 2: Look up the credit and pass the discount**

In the `POST /:parcelId/fund` handler, replace the breakdown computation (line 128-129):

```ts
      const travelerPrice = resolveTravelerPrice(ctx);
      const breakdown = computePayoutBreakdown(travelerPrice);
```

with:

```ts
      const travelerPrice = resolveTravelerPrice(ctx);
      const referralCredit = await findReferralCredit(ctx.senderId);
      const breakdown = computePayoutBreakdown(
        travelerPrice,
        undefined,
        undefined,
        referralCredit?.discountPct,
      );
```

- [ ] **Step 3: Mark the credit consumed once the escrow row exists**

The `EscrowLedger` row (`escrow`) is created by the `prisma.escrowLedger.upsert(...)` call (line 166-196), *after* the PaymentIntent — `consumedEscrowId` must reference that row's id, not the Stripe PaymentIntent id, so this has to run after the upsert, not right after `stripe.paymentIntents.create(...)`. Add it right after the `upsert` call resolves, before the `return reply.code(201).send({...})` (line 198):

```ts
      if (referralCredit) {
        // Consumed once the escrow row backing this charge exists. The
        // idempotent early-return path above (line 133-147, an existing
        // non-final intent) returns before this point, so a retry of an
        // already-in-flight payment never double-consumes a credit.
        await consumeReferralCredit(referralCredit.id, escrow.id);
      }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @crowdshipping/api typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/escrow.ts
git commit -m "Escrow: consume a referral credit when funding"
```

---

### Task 9: `GET /referrals/me` — code + referral list

**Files:**
- Create: `packages/api/src/routes/referrals.ts`
- Modify: `packages/api/src/server.ts:29` (import), `:97` (registration)
- Test: append to `packages/api/src/test/integration/referral.test.ts`

**Interfaces:**
- Produces: `GET /referrals/me` (authenticated) → `{ referralCode: string, referrals: Array<{ refereeFirstName: string; status: "PENDING" | "REWARDED"; createdAt: string; rewardedAt: string | null }> }`. Task 10's mobile `getMyReferralCode`/`getMyReferrals` wrappers consume this shape.

- [ ] **Step 1: Write the failing test**

Append to `packages/api/src/test/integration/referral.test.ts`, as a new `describe` block before the final `console.log` (it reuses the `prisma` import Task 3 already added at the top of this file — no new import needed):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crowdshipping/api test:integration`
Expected: FAIL — `404` (route doesn't exist yet).

- [ ] **Step 3: Implement the route**

```ts
// packages/api/src/routes/referrals.ts
/**
 * Referral read endpoint — a user's own code + the referrals they've made.
 * Writing (signup-time code assignment + Referral creation) lives in
 * auth.ts; this route is read-only.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@crowdshipping/db";

export const referralRoutes: FastifyPluginAsync = async (app) => {
  // GET /referrals/me — the caller's referral code + everyone they've referred.
  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const [user, referrals] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: req.user.sub },
        select: { referralCode: true },
      }),
      prisma.referral.findMany({
        where: { referrerId: req.user.sub },
        orderBy: { createdAt: "desc" },
        include: { referee: { select: { firstName: true } } },
      }),
    ]);

    return {
      referralCode: user.referralCode,
      referrals: referrals.map((r) => ({
        refereeFirstName: r.referee.firstName,
        status: r.status,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    };
  });
};
```

Register it in `packages/api/src/server.ts` — add the import after `import { ratingRoutes } from "./routes/ratings.js";` (line 29):

```ts
import { referralRoutes } from "./routes/referrals.js";
```

Add the registration after `await app.register(ratingRoutes, { prefix: "/ratings" });` (line 97):

```ts
  await app.register(referralRoutes, { prefix: "/referrals" });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crowdshipping/api test:integration`
Expected: PASS — all `referral signup tests` (Task 3 + this task's additions) green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/referrals.ts packages/api/src/server.ts packages/api/src/test/integration/referral.test.ts
git commit -m "Add GET /referrals/me"
```

---

### Task 10: Mobile — signup field + API wrappers

**Files:**
- Modify: `apps/mobile/src/lib/auth.ts:11-26` (SignupInput + signup())
- Create: `apps/mobile/src/lib/referrals.ts`
- Modify: `apps/mobile/app/auth/signup.tsx`
- Modify: `apps/mobile/src/locales/fr.ts:115-121` (signup section), `:509-527` (settings section — added to in Task 11)
- Modify: `apps/mobile/src/locales/en.ts` (mirror)

**Interfaces:**
- Produces: `authApi.signup()` accepts an optional `referralCode`; `referralsApi.getMyReferralCode()` / `getMyReferrals()` wrap `GET /referrals/me`. Task 11's invite screen consumes both.

No new test in this task: mobile `apiFetch` wrappers follow the existing `lib/ratings.ts` pattern, which itself has no dedicated unit test in this codebase (thin fetch wrappers aren't unit-tested on the mobile side here) — verified manually via the running app in Task 11.

- [ ] **Step 1: Extend the signup API wrapper**

In `apps/mobile/src/lib/auth.ts`, update `SignupInput` (lines 11-17):

```ts
export interface SignupInput {
  email: string;
  phone: string; // E.164: +213...
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
}
```

`signup()` (line 24-26) already forwards the whole `input` object as the body, so no further change is needed there.

- [ ] **Step 2: Add the referrals API wrapper**

```ts
// apps/mobile/src/lib/referrals.ts
/**
 * Referrals API — typed wrapper over GET /referrals/me.
 * Mirrors packages/api/src/routes/referrals.ts.
 */
import { apiFetch } from "./api";

export interface ReferralEntry {
  refereeFirstName: string;
  status: "PENDING" | "REWARDED";
  createdAt: string;
  rewardedAt: string | null;
}

export interface MyReferrals {
  referralCode: string;
  referrals: ReferralEntry[];
}

export function getMyReferrals(): Promise<MyReferrals> {
  return apiFetch("/referrals/me");
}
```

- [ ] **Step 3: Add the signup field**

In `apps/mobile/app/auth/signup.tsx`, add state (after `const [password, setPassword] = useState("");` at line 25):

```tsx
  const [referralCode, setReferralCode] = useState("");
```

Pass it in the `submit()` call (after `password,` in the `authApi.signup({...})` call at line 36):

```tsx
        password,
        referralCode: referralCode.trim() || undefined,
```

Add the input field in the form, after the password `Input` (after line 102, before the `Button`):

```tsx
        <Input
          label={t("signup.referralCodeLabel")}
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="signup-referral-code"
        />
```

- [ ] **Step 4: Add locale keys**

In `apps/mobile/src/locales/fr.ts`, inside the `signup: { ... }` block (lines 115-121), add:

```ts
    referralCodeLabel: "Code de parrainage (optionnel)",
```

In `apps/mobile/src/locales/en.ts`, inside the corresponding `signup: { ... }` block, add:

```ts
    referralCodeLabel: "Referral code (optional)",
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/auth.ts apps/mobile/src/lib/referrals.ts apps/mobile/app/auth/signup.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: referral code field at signup + referrals API wrapper"
```

---

### Task 11: Mobile — "Invite friends" screen + settings entry point

**Files:**
- Create: `apps/mobile/app/invite.tsx`
- Modify: `apps/mobile/app/settings.tsx`
- Modify: `apps/mobile/src/locales/fr.ts:509-527` (settings section), `en.ts` (mirror)

**Interfaces:**
- Consumes: `getMyReferrals` from Task 10.

No automated test: this is a screen composition task, verified by running the app (Step 5 below) — consistent with how other pure-UI screens in this codebase (e.g. the settings screen itself) have no dedicated test file.

- [ ] **Step 1: Build the invite screen**

```tsx
// apps/mobile/app/invite.tsx
/**
 * Invite friends — shows the user's personal referral code, a native share
 * action, and the status of everyone they've referred so far.
 */
import { useEffect, useState } from "react";
import { Share, Text, View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "../src/components/Screen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { AuthWall } from "../src/components/AuthWall";
import { useAuth } from "../src/store/auth";
import { getMyReferrals, type MyReferrals } from "../src/lib/referrals";

export default function InviteScreen() {
  const { t } = useTranslation();
  const { tokens } = useAuth();
  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    getMyReferrals()
      .then(setData)
      .finally(() => setLoading(false));
  }, [tokens]);

  if (!tokens) {
    return <AuthWall headerTitle={t("invite.title")} />;
  }

  async function onShare() {
    if (!data) return;
    await Share.share({
      message: t("invite.shareMessage", { code: data.referralCode }),
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t("invite.title")} />

      {loading || !data ? (
        <ActivityIndicator />
      ) : (
        <>
          <Card className="items-center gap-stack-gap">
            <Text className="text-text-muted font-body">{t("invite.yourCode")}</Text>
            <Text className="text-text-primary font-heading text-screen-title font-bold tracking-widest">
              {data.referralCode}
            </Text>
            <Button label={t("invite.shareButton")} onPress={onShare} />
          </Card>

          <Text className="font-mono text-meta uppercase text-text-secondary mt-section-gap mb-2">
            {t("invite.yourReferrals")}
          </Text>
          {data.referrals.length === 0 ? (
            <Text className="text-text-muted font-body">{t("invite.noReferralsYet")}</Text>
          ) : (
            <Card className="gap-1">
              {data.referrals.map((r, i) => (
                <View key={i} className="flex-row justify-between py-card-padding">
                  <Text className="text-text-primary font-body">{r.refereeFirstName}</Text>
                  <Text className="text-text-muted font-body">
                    {r.status === "REWARDED" ? t("invite.statusRewarded") : t("invite.statusPending")}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Add the settings entry point**

In `apps/mobile/app/settings.tsx`, add a new `PressableRow` in the preferences `Card` (after the `howItWorks` row and its preceding `Divider` at line 84-85):

```tsx
        <Divider />
        <PressableRow icon="gift-outline" label={t("settings.inviteFriends")} onPress={() => router.push("/invite")} />
```

- [ ] **Step 3: Add locale keys**

In `apps/mobile/src/locales/fr.ts`, add a new top-level `invite: { ... }` block (alongside `signup:`, `verify:`, `onboarding:`, etc.):

```ts
  invite: {
    title: "Inviter des amis",
    yourCode: "Votre code de parrainage",
    shareButton: "Partager mon code",
    shareMessage: "Rejoins CrowdShipping avec mon code {{code}} et profite d'une réduction sur ta première livraison !",
    yourReferrals: "Vos parrainages",
    noReferralsYet: "Vous n'avez encore parrainé personne.",
    statusPending: "En attente",
    statusRewarded: "Récompensé 🎁",
  },
```

Add `inviteFriends: "Inviter des amis",` inside the existing `settings: { ... }` block (after `howItWorks` at line 514).

In `apps/mobile/src/locales/en.ts`, mirror both additions:

```ts
  invite: {
    title: "Invite friends",
    yourCode: "Your referral code",
    shareButton: "Share my code",
    shareMessage: "Join CrowdShipping with my code {{code}} and get a discount on your first shipment!",
    yourReferrals: "Your referrals",
    noReferralsYet: "You haven't referred anyone yet.",
    statusPending: "Pending",
    statusRewarded: "Rewarded 🎁",
  },
```

Add `inviteFriends: "Invite friends",` inside the existing `settings: { ... }` block.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: no errors.

- [ ] **Step 5: Manually verify in the running app**

Run: `pnpm --filter @crowdshipping/mobile start` (or the project's usual Expo dev command), open the app:
1. Sign up a new account, confirm the optional referral code field appears and an empty value doesn't block submission.
2. Log in as an existing user, go to Settings → "Inviter des amis" (or "Invite friends" in EN), confirm the screen shows an 8-character code and a working native share sheet.
3. Sign up a second account entering the first account's code; log back into the first account and confirm the invite screen now lists the second account with "En attente" / "Pending" status.

Expected: all three flows work without crashes; screenshot or describe what you saw if reporting back.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/invite.tsx apps/mobile/app/settings.tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: add Invite Friends screen + settings entry point"
```

---

### Task 12: Mobile — discount banner on the funding screen

**Files:**
- Modify: `apps/mobile/src/lib/escrow.ts:17-22` (`PayoutBreakdown` interface)
- Modify: `apps/mobile/app/escrow/[parcelId].tsx:119-137`
- Modify: `apps/mobile/src/locales/fr.ts`, `en.ts`

**Interfaces:**
- Consumes: `breakdown.discountPct` from Task 4/8's backend change (already flows through `fund()`/`getEscrow()` unmodified since they just relay the JSON body).

This closes the spec's "Mobile" requirement that a stacked credit being applied isn't silent. No automated test — same rationale as Task 11 (screen composition, verified by running the app).

- [ ] **Step 1: Add `discountPct` to the mobile `PayoutBreakdown` type**

In `apps/mobile/src/lib/escrow.ts`, update the interface (lines 17-22):

```ts
export interface PayoutBreakdown {
  totalAmount: number;
  platformFee: number;
  insuranceFee: number;
  travelerPayout: number;
  discountPct: number;
}
```

- [ ] **Step 2: Show the banner when a discount was applied**

In `apps/mobile/app/escrow/[parcelId].tsx`, add a banner inside the `breakdown ? (...)` block, right after the `<Card className="gap-2">...</Card>` fee-details card (after line 137, before the `escrowHint` info `Card` at line 139):

```tsx
          {breakdown.discountPct > 0 ? (
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-body text-xs font-semibold">
                {t("escrow.referralDiscountApplied", { pct: breakdown.discountPct })}
              </Text>
            </Card>
          ) : null}
```

- [ ] **Step 3: Add locale keys**

In `apps/mobile/src/locales/fr.ts`, inside the existing `escrow: { ... }` block, add:

```ts
    referralDiscountApplied: "Réduction de parrainage de {{pct}}% appliquée sur la fee 🎁",
```

In `apps/mobile/src/locales/en.ts`, inside the corresponding `escrow: { ... }` block, add:

```ts
    referralDiscountApplied: "{{pct}}% referral discount applied to the fee 🎁",
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: no errors.

- [ ] **Step 5: Manually verify**

Using the flow from Task 11 Step 5 (an account with an unconsumed `REWARDED` credit), open its escrow funding screen for any matched parcel and confirm the discount banner appears with the correct percentage, and that the total shown already reflects the discounted fee.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/escrow.ts apps/mobile/app/escrow/\[parcelId\].tsx apps/mobile/src/locales/fr.ts apps/mobile/src/locales/en.ts
git commit -m "Mobile: show a banner when a referral discount is applied at funding"
```

