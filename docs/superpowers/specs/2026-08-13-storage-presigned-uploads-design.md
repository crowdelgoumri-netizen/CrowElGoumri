# Storage: S3-compatible presigned uploads (KYC docs + parcel photos)

**Date:** 2026-08-13 · **Status:** draft — pending user approval (ZCode session)

## Context

The backend already persists URLs for KYC documents (`KycSubmission.documentUrl` /
`documentBackUrl` / `selfieUrl`), parcel photos (`Parcel.photoUrls[]`, max 5), parcel
invoices (`Parcel.invoiceUrl`), and dispute attachments (`Dispute.attachments[]`). Both
URL-consuming routes validate them server-side — KYC via the `httpUrl` refinement
(`routes/kyc.ts:34`), parcels via `z.string().url()` (`routes/parcels.ts:68-69`).

What is **missing** is any way to *produce* a valid URL. Today clients must hand in an
arbitrary http(s) URL string, which in practice means the KYC and parcel-photo flows cannot
accept real files. The schema comments make the deferral explicit:

- `packages/db/schema.prisma:475` — *"client uploads to S3, sends the URL here; same
  convention as Parcel.photoUrls. S3 integration itself is a dedicated cross-cutting phase."*
- `apps/mobile/src/lib/kyc.ts:5` — *"photo upload itself is a cross-cutting concern; in dev a
  placeholder URL works, image-picker uploads land with the storage phase."*

This is that phase. It is the gating prerequisite for KYC going live (a manual-review
marketplace cannot accept submissions it can't view), and it unblocks parcel photos into the
bargain.

Provider is already settled in `.env.example:27-33`: an **S3-compatible API**, with Wasabi
as the documented production target ("~80% cheaper than S3. Use S3-compatible API"). Five
vars are documented there (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`), but only `S3_ENDPOINT` + `S3_BUCKET` are declared in
`packages/api/src/env.ts:39-40` — the other three are read by nothing today.

## Decision: presigned PUT (client uploads directly to object storage)

The client asks the API for a short-lived presigned PUT URL, PUTs the file bytes **directly**
to the S3-compatible endpoint, then submits the resulting object URL to the existing
`/kyc/submit`, `/parcels`, etc. endpoints unchanged.

This matches the schema's own stated convention ("client uploads to S3, sends the URL here")
and keeps the API out of the byte path.

**Alternative rejected — API-proxied multipart upload.** The client POSTs the file to the
API (multipart/form-data), and the API streams it onward to S3. Simpler client, but the API
becomes a byte proxy: multipart parsing, memory/bandwidth pressure, larger request limits,
and a heavier Fastify plugin surface. For a mobile client uploading a handful of images to
S3-compatible storage, presigned PUT is the standard pattern and needs none of that. The API
keeps its current "store a URL" shape on every consuming route — no route signatures change.

**Provider lock-in: none.** The SDK talks the S3 API; AWS S3, Wasabi (prod), and MinIO (local
dev) are all interchangeable via the five env vars + `forcePathStyle`.

## Backend changes

### `packages/api/src/env.ts`
Add the three vars that `.env.example` already documents but code does not read:
- `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — all `z.string().optional()`.
Storage is considered **configured** iff all five of `S3_ENDPOINT`/`S3_REGION`/`S3_BUCKET`/
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` are present.

### `packages/api/src/lib/storage.ts` (new)
S3 client built from the five env vars, with `forcePathStyle: true` (required for MinIO and
Wasabi path-style addressing). Exports:
- `isStorageConfigured(): boolean` — gate used by the route and by graceful dev behavior.
- `presignPut({ userId, purpose, contentType }): Promise<{ uploadUrl, objectUrl, key }>` where
  - `key = uploads/{userId}/{purpose}/{ulid}.{ext}` — per-user prefix (isolation, no
    enumeration, no collisions); `ext` derived from `contentType`.
  - `purpose` ∈ `{ "kyc-doc", "kyc-selfie", "parcel-photo", "invoice", "dispute-attachment" }`
    drives the key prefix, the allowed MIME types, and the max size.
  - TTL: 5 minutes.
- A `PURPOSE_RULES` table mapping each purpose → `{ contentTypes: string[], maxSizeBytes }`,
  enforced **before** signing so an oversized/wrong-type object can never get a valid PUT URL.

New runtime deps (S3 SDK is tree-shakeable and isomorphic): `@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner`.

### `packages/api/src/routes/uploads.ts` (new)
- `POST /uploads/presign` (authenticated via `app.authenticate`):
  - Body: `{ purpose, contentType }`.
  - Validates purpose + contentType against `PURPOSE_RULES`; 400 on disallowed type.
  - 503 `{ error: "storage not configured" }` when `!isStorageConfigured()` — a loud failure
    rather than a silent no-op, since callers now depend on the URL.
  - Returns `{ uploadUrl, objectUrl, key }` on success.
- Registered in `packages/api/src/server.ts` alongside the other route plugins.

### No schema changes
The existing URL columns already store the result of an upload. **No Prisma migration.**

## Mobile changes

### `apps/mobile/src/lib/uploads.ts` (new)
- `Purpose` union mirroring the backend.
- `uploadFile(uri, purpose): Promise<string>` — `POST /uploads/presign`, then
  `fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type" } })`, then return
  the `objectUrl`. Surfaces a typed error on non-2xx from either call.

### Wire into screens
- **KYC** (`app/kyc.tsx`): `expo-image-picker` → `uploadFile(uri, "kyc-doc" | "kyc-selfie")`
  per image → pass the returned `objectUrl` into `submitKyc`. Per-image loading + error state.
- **Post-parcel** (`app/post-parcel.tsx`): pick up to 5 photos → upload each → `photoUrls[]`;
  same for the optional invoice (`"invoice"`).

## Dev ergonomics (preserves today's testing path)

When S3 is unconfigured, `/uploads/presign` returns 503 — but `/kyc/submit` and `/parcels`
**still accept plain http URLs** as they do today. So dev/seed without a bucket can still
exercise both flows with placeholder URLs; nothing forces a local MinIO just to test the API.
With a bucket (or MinIO) configured, the full upload path lights up with zero route changes.

## Hardening (noted — separate concern, not in this spec)

`httpUrl` (`routes/kyc.ts:34`) and `z.string().url()` (`routes/parcels.ts:68`) currently
accept **any** http(s) host. A worthwhile follow-up after this lands: require submitted
KYC/parcel URLs to live under our own bucket host, closing the door on arbitrary external
URLs (and the mild abuse surface that entails). Out of scope here to keep this chantier
focused; flagged for a hardening pass.

## Out of scope

- Stripe Connect payouts, customs/prohibited-items engine (separate chantiers).
- Image scanning / AV / thumbnail generation / CDN fronting / bucket lifecycle rules.
- Tightening URL host validation (hardening, see above).
- Dispute-attachment *UI* wiring — the `"dispute-attachment"` presign purpose is defined so it
  works, but the dispute screen's attach flow is left for later (the `attachments` column
  already stores URLs, unchanged).
