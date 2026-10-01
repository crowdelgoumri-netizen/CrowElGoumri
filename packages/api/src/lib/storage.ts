/**
 * S3-compatible object storage — presigned PUT uploads (blueprint storage phase).
 *
 * The API never proxies file bytes. A client obtains a short-lived presigned
 * PUT URL from POST /uploads/presign, uploads directly to the S3-compatible
 * endpoint (Wasabi in prod, MinIO or any S3-compatible store in dev), then
 * submits the resulting object URL to the existing /kyc/submit, /parcels, …
 * routes unchanged — matching the schema's own "client uploads to S3, sends
 * the URL here" convention (packages/db/schema.prisma).
 *
 * Provider-agnostic: anything speaking the S3 API works (AWS S3, Wasabi,
 * MinIO) via the five S3_* env vars + forcePathStyle (required for MinIO and
 * Wasabi path-style addressing, harmless on AWS S3).
 *
 * Storage is optional: when any of the five env vars is missing,
 * isStorageConfigured() is false and the /uploads/presign route returns 503.
 * Direct URL submission to /kyc/submit + /parcels keeps working, so dev/seed
 * without a bucket can still exercise those flows with placeholder URLs.
 *
 * Size cap: a presigned PUT can't reliably constrain bytes server-side, so
 * maxSizeBytes is enforced client-side (the only place the file is visible)
 * and is part of the contract each purpose publishes here.
 */
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

// ── Purposes ─────────────────────────────────────────────────────────
// Each purpose fixes the storage key prefix, the allowed MIME types, and the
// max size. UPLOAD_PURPOSES + the UploadPurpose type are mirrored by the
// mobile client (apps/mobile/src/lib/uploads.ts) — keep them in sync.

export const UPLOAD_PURPOSES = [
  "kyc-doc",
  "kyc-selfie",
  "parcel-photo",
  "invoice",
  "dispute-attachment",
  "chat-attachment",
] as const;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

interface PurposeRule {
  contentTypes: readonly string[];
  maxSizeBytes: number;
}

/** 10 MB — generous enough for a high-res ID scan or parcel photo. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PURPOSE_RULES: Record<UploadPurpose, PurposeRule> = {
  "kyc-doc": { contentTypes: IMAGE_TYPES, maxSizeBytes: MAX_IMAGE_BYTES },
  "kyc-selfie": { contentTypes: IMAGE_TYPES, maxSizeBytes: MAX_IMAGE_BYTES },
  "parcel-photo": { contentTypes: IMAGE_TYPES, maxSizeBytes: MAX_IMAGE_BYTES },
  invoice: { contentTypes: DOC_TYPES, maxSizeBytes: MAX_IMAGE_BYTES },
  "dispute-attachment": {
    contentTypes: DOC_TYPES,
    maxSizeBytes: MAX_IMAGE_BYTES,
  },
  "chat-attachment": { contentTypes: IMAGE_TYPES, maxSizeBytes: MAX_IMAGE_BYTES },
};

// MIME → file extension for the object key. Explicit (rather than splitting
// the content-type string) so we never trust an arbitrary client suffix.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// ── Typed errors ─────────────────────────────────────────────────────

/** Raised when a content-type isn't allowed for the requested purpose. */
export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

// ── Configuration ────────────────────────────────────────────────────

/**
 * Storage is "configured" iff all five S3_* vars are present. The route uses
 * this to answer 503 rather than constructing a half-configured client.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    env.S3_ENDPOINT &&
      env.S3_REGION &&
      env.S3_BUCKET &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY,
  );
}

// ── Singleton S3 client ──────────────────────────────────────────────

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    const config: S3ClientConfig = {
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    };
    _client = new S3Client(config);
  }
  return _client;
}

// ── Presigning ───────────────────────────────────────────────────────

const PRESIGN_TTL_SECONDS = 300; // 5 min — enough for a mobile upload on slow data.

export interface PresignPutInput {
  userId: string;
  purpose: UploadPurpose;
  contentType: string;
}

export interface PresignedUpload {
  /** Short-lived signed URL the client PUTs the file bytes to. */
  uploadUrl: string;
  /** Canonical object URL the client submits to /kyc/submit, /parcels, … */
  objectUrl: string;
  /** Full object key: uploads/{userId}/{purpose}/{uuid}.{ext}. */
  key: string;
}

/**
 * Produce a presigned PUT URL for a single upload. Validates purpose +
 * content-type against PURPOSE_RULES before signing — a wrong-type file can
 * never obtain a valid URL. Throws InvalidUploadError on a disallowed type,
 * and a plain Error if storage is unconfigured (the route guards with
 * isStorageConfigured first, so that path is defense in depth).
 */
export async function presignPut(
  input: PresignPutInput,
): Promise<PresignedUpload> {
  if (!isStorageConfigured()) {
    throw new Error("storage not configured");
  }
  const rule = PURPOSE_RULES[input.purpose];
  if (!rule.contentTypes.includes(input.contentType)) {
    throw new InvalidUploadError(
      `content-type "${input.contentType}" is not allowed for purpose "${input.purpose}"`,
    );
  }
  const ext = EXT_BY_TYPE[input.contentType];
  if (!ext) {
    // Unreachable given the allowlist above, but defense in depth.
    throw new InvalidUploadError(
      `no file extension mapped for content-type "${input.contentType}"`,
    );
  }

  // Per-user prefix: isolation (no cross-user enumeration) + no collisions.
  const key = `uploads/${input.userId}/${input.purpose}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_TTL_SECONDS,
  });

  // Path-style object URL matches forcePathStyle:true. Whether this URL is
  // publicly GET-able depends on bucket policy — for sensitive docs (KYC) the
  // bucket should be private, with a presigned GET path added in a follow-up
  // (see spec §Hardening). Stored as-is by /kyc/submit and /parcels.
  const objectUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;

  return { uploadUrl, objectUrl, key };
}
