import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY ERROR: src/config/env.server.ts cannot be imported in client code.");
}

const optionalTrimmedString = () =>
  z.preprocess((val) => (typeof val === "string" && val.trim() !== "" ? val.trim() : undefined), z.string().optional());

function normalizeUrl(url: string): string {
  let cleaned = url.trim().toLowerCase();
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.preprocess(
      (val) => (typeof val === "string" && val.trim() !== "" ? val.trim().toLowerCase() : undefined),
      z.enum(["development", "production", "test"]).default("development"),
    ),
    VERCEL: optionalTrimmedString(),
    VERCEL_ENV: z.preprocess(
      (val) => (typeof val === "string" && val.trim() !== "" ? val.trim().toLowerCase() : undefined),
      z.enum(["production", "preview", "development"]).optional(),
    ),
    VERCEL_GIT_COMMIT_REF: optionalTrimmedString(),

    EXTERNAL_API_ADAPTER: z.preprocess(
      (val) => (typeof val === "string" && val.trim() !== "" ? val.trim().toLowerCase() : undefined),
      z.enum(["external-provider", "mock"]).default("external-provider"),
    ),
    EXTERNAL_API_SECRET_SOURCE: z.preprocess(
      (val) => (typeof val === "string" && val.trim() !== "" ? val.trim().toLowerCase() : undefined),
      z.enum(["keychain", "env"]).default("keychain"),
    ),

    EXTERNAL_API_WEB_COOKIE: optionalTrimmedString(),
    EXTERNAL_API_WEB_USER: optionalTrimmedString(),
    EXTERNAL_API_TOKEN: optionalTrimmedString(),

    DATABASE_URL: optionalTrimmedString(),
    SUPABASE_URL: optionalTrimmedString(),
    SUPABASE_SECRET_KEY: optionalTrimmedString(),
    SUPABASE_SERVICE_ROLE_KEY: optionalTrimmedString(),

    SUPABASE_MOCK_URL: optionalTrimmedString(),
    SUPABASE_MOCK_SECRET_KEY: optionalTrimmedString(),
    SUPABASE_MOCK_SERVICE_ROLE_KEY: optionalTrimmedString(),

    CRON_SECRET: optionalTrimmedString(),

    GOOGLE_CLIENT_ID: optionalTrimmedString(),
    GOOGLE_CLIENT_SECRET: optionalTrimmedString(),
    AUTH_SECRET: optionalTrimmedString(),
    ALLOWED_USER_EMAILS: optionalTrimmedString(),
    AUTH_BYPASS_LOCAL: optionalTrimmedString(),
    AUTH_CANONICAL_URL: optionalTrimmedString(),
    ALLOWED_PREVIEW_ORIGINS: optionalTrimmedString(),

    MOBILE_API_TOKENS: optionalTrimmedString(),
  })
  .superRefine((data, ctx) => {
    const isVercel = data.VERCEL === "1" || Boolean(data.VERCEL_ENV);
    const isProduction = data.NODE_ENV === "production" || data.VERCEL_ENV === "production";

    // 1. E2E branch enforcement
    if (data.VERCEL_GIT_COMMIT_REF === "e2e" && data.EXTERNAL_API_ADAPTER !== "mock") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EXTERNAL_API_ADAPTER"],
        message: "CRITICAL CONFIGURATION ERROR: VERCEL_GIT_COMMIT_REF is 'e2e' but EXTERNAL_API_ADAPTER is not 'mock'.",
      });
    }

    // 2. Blast-radius protection: mock URL cannot equal production URL
    if (data.EXTERNAL_API_ADAPTER === "mock" && data.SUPABASE_MOCK_URL && data.SUPABASE_URL) {
      const mockUrl = normalizeUrl(data.SUPABASE_MOCK_URL);
      const prodUrl = normalizeUrl(data.SUPABASE_URL);
      if (mockUrl === prodUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SUPABASE_MOCK_URL"],
          message:
            "CRITICAL BLAST-RADIUS PROTECTION: SUPABASE_MOCK_URL cannot be identical to production SUPABASE_URL in mock adapter mode.",
        });
      }
    }

    // 3. Production safety guards
    if (isProduction) {
      if (data.EXTERNAL_API_ADAPTER === "mock") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EXTERNAL_API_ADAPTER"],
          message: "CRITICAL SAFETY GUARD: EXTERNAL_API_ADAPTER cannot be 'mock' in production deployments.",
        });
      }

      if (!data.AUTH_SECRET || data.AUTH_SECRET.trim().length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message: "CRITICAL SECURITY ERROR: AUTH_SECRET must be at least 32 characters long in production.",
        });
      }
    }

    // 4. Auth bypass guard: never allowed on Vercel or in production
    if ((isVercel || isProduction) && data.AUTH_BYPASS_LOCAL?.toLowerCase() === "true") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_BYPASS_LOCAL"],
        message:
          "CRITICAL SECURITY CONFIGURATION ERROR: AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const formattedIssues = issues.map((i) => `  - [${i.path.join(".") || "root"}]: ${i.message}`).join("\n");
    super(`Environment validation failed:\n${formattedIssues}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/**
 * Pure, side-effect-free server environment validator.
 * Accepts a custom environment dictionary for testing without mutating process.env.
 */
export function validateServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

let cachedEnv: ServerEnv | null = null;

/**
 * Returns the lazily-evaluated server environment singleton.
 * In test mode (NODE_ENV === "test"), re-evaluates each time to support test overrides.
 */
export function getServerEnv(): ServerEnv {
  if (!cachedEnv || process.env.NODE_ENV === "test") {
    cachedEnv = validateServerEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Resets the in-memory server environment cache (primarily for tests).
 */
export function resetServerEnvCache(): void {
  cachedEnv = null;
}
