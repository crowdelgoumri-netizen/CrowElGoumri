/**
 * Uploads route — issues presigned PUT URLs for direct-to-storage uploads.
 *
 *   POST /uploads/presign   (authenticated)
 *     body: { purpose, contentType }
 *     → { uploadUrl, objectUrl, key }
 *
 * The client PUTs the file directly to `uploadUrl`, then submits `objectUrl`
 * to the consuming route (/kyc/submit, /parcels, …) unchanged — the API never
 * proxies file bytes. See lib/storage.ts for provider config + purpose rules.
 *
 * 503 when storage isn't configured (any S3_* env var missing): a loud failure
 * rather than a silent no-op, since callers now depend on the URL.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  InvalidUploadError,
  UPLOAD_PURPOSES,
  isStorageConfigured,
  presignPut,
} from "../lib/storage.js";

const presignSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.string().min(1),
});

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  // POST /uploads/presign — mint a presigned PUT URL for one file
  app.post(
    "/presign",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      if (!isStorageConfigured()) {
        return reply.code(503).send({ error: "storage not configured" });
      }
      const parsed = presignSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { purpose, contentType } = parsed.data;
      try {
        const result = await presignPut({
          userId: req.user.sub,
          purpose,
          contentType,
        });
        return result; // 200
      } catch (e) {
        if (e instanceof InvalidUploadError) {
          return reply.code(400).send({ error: e.message });
        }
        req.log.error({ err: e, purpose, contentType }, "presign failed");
        return reply.code(500).send({ error: "upload could not be prepared" });
      }
    },
  );
};
