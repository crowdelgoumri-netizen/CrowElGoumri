/**
 * Environment variable validation via zod.
 * Fails fast at startup if anything required is missing — no runtime surprises.
 */
import { z } from "zod";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Load .env from the monorepo root (two levels up from packages/api/src).
// dotenv default looks in cwd, which is packages/api when run via pnpm filter.
loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z
    .string()
    .url()
    .refine((u) => u.startsWith("postgres"), {
      message: "DATABASE_URL must be a postgres:// connection string",
    }),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 bytes"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // Stripe — required for escrow (Phase 4); allow placeholder in early dev
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_PLATFORM_FEE_BPS: z.coerce.number().default(1000), // 10%

  // Optional external services (phased in later)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  KYC_PROVIDER: z.enum(["sumsub", "manual"]).default("manual"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  console.error(
    parsed.error.flatten().fieldErrors,
  );
  console.error(
    "\n👉 Copy .env.example to .env and fill in the required values.",
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
