/**
 * Uploads — presigned PUT to S3-compatible storage.
 *
 * Mirrors packages/api/src/routes/uploads.ts + packages/api/src/lib/storage.ts.
 * Two tiers:
 *   - uploadFile()          pure transport: presign → PUT the bytes → objectUrl.
 *   - pickAndUploadImage()  the mobile composite: permission + expo-image-picker
 *                            + size check + uploadFile. Screens share this so the
 *                            pick→upload sequence lives in one place.
 *
 * Size is enforced here (client-side) against MAX_BYTES before the upload — a
 * presigned PUT can't reliably cap bytes server-side, so the contract is
 * checked where we actually have the file (the picker's reported fileSize).
 *
 * The PUT itself goes through expo-file-system uploadAsync, which streams the
 * file off disk to the presigned URL — no base64 hop, works with iOS ph://
 * and Android file:// picker URIs, and stays out of JS memory.
 */
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { apiFetch, ApiError } from "./api";

export type UploadPurpose =
  | "kyc-doc"
  | "kyc-selfie"
  | "parcel-photo"
  | "invoice"
  | "dispute-attachment";

/** Mirrors packages/api/src/lib/storage.ts PURPOSE_RULES maxSizeBytes. */
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024);

interface PresignResponse {
  uploadUrl: string;
  objectUrl: string;
  key: string;
}

/**
 * Upload a local file URI to object storage, returning the object URL the
 * caller submits with the owning request (/kyc/submit, /parcels, …).
 *
 * @param localUri     file URI (e.g. picker `asset.uri`)
 * @param purpose      drives the storage key prefix + allowed MIME types
 * @param contentType  MIME (picker `asset.mimeType`); defaults to image/jpeg
 * @param sizeBytes    picker `asset.fileSize`; enforced against MAX_BYTES
 */
export async function uploadFile(
  localUri: string,
  purpose: UploadPurpose,
  contentType: string = "image/jpeg",
  sizeBytes?: number,
): Promise<string> {
  if (sizeBytes != null && sizeBytes > MAX_BYTES) {
    throw new ApiError(
      413,
      `Fichier trop volumineux (max ${MAX_MB} Mo).`,
    );
  }

  const presign = await apiFetch<PresignResponse>("/uploads/presign", {
    method: "POST",
    body: { purpose, contentType },
  });

  // uploadAsync streams the file off disk to the URL. The Content-Type header
  // must match what presign signed (above) or S3 rejects the signature.
  // httpMethod is a string union in expo-file-system v18 ('POST'|'PUT'|'PATCH').
  const result = await FileSystem.uploadAsync(presign.uploadUrl, localUri, {
    httpMethod: "PUT",
    headers: { "Content-Type": contentType },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, `Échec de l'envoi (${result.status}).`);
  }
  return presign.objectUrl;
}

export interface PickedImage {
  /** Displayable file:// URI for an <Image> preview (works even on a private bucket). */
  localUri: string;
  /** Canonical object URL to submit to the API. */
  objectUrl: string;
}

/**
 * Request library permission, launch the image picker, and upload the chosen
 * image. Returns null if the user cancels. Throws ApiError on upload/presign
 * failure or oversize — callers surface it via Alert.
 *
 * Image-only on the client (no document picker yet): the `invoice` and
 * `dispute-attachment` purposes accept PDF server-side, but v1 collects them
 * as photos; PDF support lands with expo-document-picker later.
 */
export async function pickAndUploadImage(
  purpose: UploadPurpose,
): Promise<PickedImage | null> {
  await ImagePicker.requestMediaLibraryPermissionsAsync();
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const contentType = asset.mimeType || "image/jpeg";
  const objectUrl = await uploadFile(
    asset.uri,
    purpose,
    contentType,
    asset.fileSize,
  );
  return { localUri: asset.uri, objectUrl };
}
