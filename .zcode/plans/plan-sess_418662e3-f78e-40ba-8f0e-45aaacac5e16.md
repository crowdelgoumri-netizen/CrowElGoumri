## Phase 8 — KYC verification (manual admin-review queue)

Manual KYC submission + admin approval queue, per the blueprint's `KYC_PROVIDER=manual` path. Users upload ID + selfie (as URLs, following the parcels photo-URL convention), status goes PENDING, an admin reviews and approves/rejects; on approval KYC bumps to ENHANCED and trust recomputes. The Sumsub automated adapter slots in later behind the same `KycProvider` interface.

Per the approved scope: **manual admin-review queue** + **persist trust on every KYC change**.

### Schema change (`packages/db/schema.prisma`)

Add a `KycSubmission` model — auditable review history, distinct from the single `User.kycDocumentUrl` field (which can't represent ID+selfie+status+reviewer):

```prisma
model KycSubmission {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  documentType String   // "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE" | "RESIDENCY_PERMIT"
  documentUrl  String   // front of ID
  documentBackUrl String? // back, for two-sided docs
  selfieUrl    String   // liveness selfie (client-side check deferred; manual review in v1)
  status       String   @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED"
  reviewerId   String?  // admin userId
  reviewNote   String?  // rejection reason or approval note
  reviewedAt   DateTime?
  targetLevel  String   // "ENHANCED" | "FULL" — what to bump to on approval
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([status])
}
```

User gets a `kycSubmissions KycSubmission[]` back-reference. Then `pnpm db:generate` + `pnpm db:push`.

### New files

**1. `packages/api/src/lib/trust-service.ts`** — the trust recompute helper
- `recomputeTrustForUser(userId)`: loads the user, calls `computeTrustScore(trustInputsFromUser(user))` (from `@crowdshipping/matching`), persists `User.trustScore` + `User.trustBadge` + `User.updatedAt`. Returns the new `TrustResult`.
- One place that knows "trust needs persisting". KYC approval, ratings, deliveries, bans all call into it. Fixes the stale-column gap where `User.trustScore` stays 0 forever.

**2. `packages/api/src/plugins/admin.ts`** — admin guard (fastify-plugin)
- `app.requireAdmin`: a preHandler that checks `req.user.role === "ADMIN"`, returns 403 otherwise. Mirrors the `app.authenticate` pattern. `fp()` so the decorator is visible app-wide. Replaces the ad-hoc `req.user.role === "ADMIN"` checks scattered in escrow.ts.

**3. `packages/api/src/routes/kyc.ts`** — the `/kyc` group
- `POST /kyc/submit` (authenticated) — user submits a KYC request. Body: `{ documentType, documentUrl, documentBackUrl?, selfieUrl, targetLevel }`. Guards: user's KYC is below targetLevel, no existing PENDING submission (one in flight at a time). Creates `KycSubmission` status PENDING. Notifies admins (or logs in v1 — no admin-users list yet).
- `GET /kyc/status` (authenticated) — returns the user's current `kycLevel` + latest submission status. The mobile app shows "Verification in progress" / "Verified" / "Rejected: reason".
- `GET /kyc/admin/pending` (admin) — lists PENDING submissions (paginated). The review queue.
- `POST /kyc/admin/:id/review` (admin) — body `{ decision: "APPROVED" | "REJECTED", note? }`. On APPROVED: stamps submission + bumps `User.kycLevel` to `targetLevel` + stamps `kycVerifiedAt` + calls `recomputeTrustForUser`. On REJECTED: stamps submission with note. Either way, notifies the user.

### Modified files
- **`packages/db/schema.prisma`** — add `KycSubmission` model + User back-reference.
- **`packages/api/src/routes/auth.ts`** — on `verify-phone` (NONE→BASIC), call `recomputeTrustForUser(user.id)` so the BASIC bump immediately reflects in the persisted trust score. One-line fix for the long-standing stale-trust bug.
- **`packages/api/src/server.ts`** — register `adminPlugin` (after authPlugin) + `kycRoutes` under `/kyc`.
- **`packages/api/src/routes/escrow.ts`** — swap the ad-hoc `req.user.role === "ADMIN"` check for `app.requireAdmin` preHandler on the release route (consistency; optional but clean).

### Admin user bootstrap
No admin exists yet (every user defaults to `BOTH`). For v1 dev/seed, document a one-shot: set a user's role to ADMIN via `prisma studio` or a SQL update. No signup endpoint for admins (intentional — admins are rare, provisioned not self-served). Documented in the kyc.ts route header.

### Validation & testing
- `pnpm db:generate` + `pnpm db:push` succeed.
- `pnpm typecheck` (all packages) clean.
- New tests:
  - `trust-service.test.ts` — verify `recomputeTrustForUser` produces a higher score for ENHANCED than BASIC than NONE (stubbed prisma). Confirms the KYC→trust coupling actually flows through.
  - Extend `notifications` or a new `kyc-flow.test.ts` — the review-decision notification path.

### Explicit v1 deferrals
- Sumsub/Onfido automated KYC (`KYC_PROVIDER=sumsub` adapter — slots in behind a `KycProvider` interface later).
- S3 document storage (v1 uses URL strings following the parcels photo convention; S3 is a cross-cutting concern for a dedicated storage phase).
- Liveness detection (selfie is reviewed manually; automated liveness comes with Sumsub).
- Document OCR / auto-extraction (manual review in v1).
- Admin signup/provisioning UI (admins set via DB in v1).

### Commit
Single commit: `Phase 8: KYC verification (manual review queue + trust recompute)`.