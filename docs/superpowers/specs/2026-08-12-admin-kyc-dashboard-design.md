# apps/admin: KYC manual-review dashboard (v1)

**Date:** 2026-08-12 · **Status:** approved by user (Claude Code session)

## Context

`apps/admin` is an empty directory in the pnpm workspace — nothing has been built yet. The backend
(`packages/api`) already has one, and only one, admin-gated capability: the manual KYC review queue
(`GET /kyc/admin/pending`, `POST /kyc/admin/:id/review`, both behind `app.authenticate` +
`app.requireAdmin`). Everything else an admin dashboard might eventually cover — dispute
moderation, user management, escrow oversight — is explicitly called out as future, separate work
in the codebase (`disputes.ts`'s comment: "admin moderation queue... separate chantier, like the
KYC review queue"; `kyc.ts`'s own header comment for the KYC queue itself).

Building a broader admin shell now would mean UI for endpoints that don't exist. v1 scope is
therefore exactly what the backend supports: **admin login + the KYC review queue, nothing more.**

## Decisions (validated by user)

- **Scope:** login + single KYC review queue screen. No stubbed nav for future sections (users,
  disputes, escrow) — add those when their backend routes exist.
- **Stack:** Next.js (App Router) + TypeScript (strict) + Tailwind, consistent with the monorepo's
  conventions (mobile uses TS strict + a Tailwind-based system).
- **Visual design:** clean and functional, no custom design system or branding investment — plain
  Tailwind, readable table/card layout. This is an internal tool for a repetitive task, not
  end-user-facing.
- **Auth:** reuse `POST /auth/login` as-is — no new backend auth. No refresh-token flow (low-usage
  internal tool); a `401` just clears the session and redirects to `/login`.

## Architecture

- New app at `apps/admin`, added to the pnpm workspace (`pnpm-workspace.yaml` already globs
  `apps/*`, so just needs a `package.json` with the workspace's naming convention:
  `@crowdshipping/admin`).
- `POST /auth/login` (same endpoint the mobile app uses) — on success, check the response's
  `role === "ADMIN"`. If not, show "This account doesn't have admin access" and don't persist a
  session. (The backend itself still enforces this on every `/kyc/admin/*` call via
  `app.requireAdmin` — the client-side check is just a better error message, not the security
  boundary.)
- Session: JWT access token in `localStorage` (mirrors `apps/mobile/src/lib/storage.ts`'s pattern),
  attached as `Authorization: Bearer <token>` by a small `apiFetch` wrapper
  (`src/lib/api.ts`, same shape as the mobile client minus the refresh logic).
- Route guard: a client component at the root layout checks for a token on mount; no token (or a
  401 from any API call) → redirect to `/login`.

## Screens

### `/login`

Email + password form → `POST /auth/login`. Three outcomes:
- Success + `role === "ADMIN"` → store token, redirect to `/`.
- Success + `role !== "ADMIN"` → "This account doesn't have admin access", don't store anything.
- 401/403 → "Invalid credentials" (mirrors the API's actual error message where useful).

### `/` — the review queue (the only screen after login)

1. On load: `GET /kyc/admin/pending?limit=20&offset=0`.
2. Each pending submission renders as a card:
   - Submitter: `user.firstName` `user.lastName`, `user.email`.
   - `documentType`, `targetLevel` (ENHANCED/FULL), `createdAt` (submitted date).
   - `documentUrl`, `documentBackUrl` (if present), `selfieUrl` — shown as `<img>` thumbnails,
     click-through to the full URL in a new tab. **Note:** `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`
     are unset in this dev `.env`, so real uploaded images won't resolve here yet — that's a
     pre-existing infra gap outside this app's scope. Broken images just show `alt` text
     ("Document photo unavailable"), no special empty state needed for it.
3. **Approve** button — immediate `POST /kyc/admin/:id/review` with `{ decision: "APPROVED" }`.
   On success, remove the card from the list.
4. **Reject** button — opens an inline textarea for an optional note (soft-encouraged, not required
   — the backend's `reviewSchema` allows an empty note, but rejecting without a reason is bad admin
   UX so the UI nudges for one). `POST .../review` with `{ decision: "REJECTED", note }`. On
   success, remove the card.
5. **Pagination:** "Load more" button using `offset += limit`, appending to the existing list — no
   numbered pages. The queue is expected to stay small.
6. **Empty state:** "No pending submissions" when `submissions.length === 0` and not loading.
7. **Logout:** clears the token, redirect to `/login`.

## Error handling

- API errors (network failure, non-2xx) surface as an inline message near the relevant action —
  never a silent failure.
- Approve/Reject buttons show a loading state and disable for the duration of their request
  (prevents double-submit / double-decision race with the backend's own `409 Submission already
  {status}` guard).
- A `401` on any call clears the session and redirects to `/login` (session expired or token
  invalid — no distinction needed for v1).

## Testing

- `pnpm --filter @crowdshipping/admin typecheck` (tsc strict) must pass.
- Manual E2E, since there's no seed KYC submission in the dev DB yet:
  1. Promote one existing test user to `ADMIN` via a direct SQL update against the dev DB (the
     documented bootstrap method — no admin signup endpoint exists, intentionally).
  2. Create a `PENDING` `KycSubmission` for a different test user via a direct authenticated
     `POST /kyc/submit` call with dummy (non-resolving) image URLs — enough to exercise the queue's
     rendering and the approve/reject actions without needing real S3-hosted images.
  3. Log in to `apps/admin` as the promoted admin, confirm the queue shows the seeded submission,
     approve it, and verify the submitting user's `kycLevel` updated to the submission's
     `targetLevel` (via `GET /kyc/status` as that user, or a DB check).

## Out of scope (explicit, not forgotten)

- Any UI for disputes, user management, escrow oversight, or analytics — no backend routes exist
  for these yet.
- Refresh-token flow — low-usage internal tool, re-login on expiry is acceptable.
- Real KYC document images — blocked on S3 credentials being configured in `.env`, a separate
  infra task.
- Admin self-service signup — admins are provisioned via direct DB access by design (see
  `packages/api/src/plugins/admin.ts`'s header comment).
