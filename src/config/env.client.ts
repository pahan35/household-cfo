import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_MODE: z.preprocess(
    (val) => (typeof val === "string" && val.trim() !== "" ? val.trim().toLowerCase() : undefined),
    z.enum(["focused", "full"]).optional(),
  ),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export class ClientEnvValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const formattedIssues = issues.map((i) => `  - [${i.path.join(".") || "root"}]: ${i.message}`).join("\n");
    super(`Client environment validation failed:\n${formattedIssues}`);
    this.name = "ClientEnvValidationError";
    this.issues = issues;
  }
}

/**
 * Pure, side-effect-free client environment validator.
 * Accepts a custom dictionary for unit test isolation.
 * Defaults to statically referencing process.env.NEXT_PUBLIC_* so bundlers can inline the values.
 */
export function validateClientEnv(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE,
  },
): ClientEnv {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    throw new ClientEnvValidationError(result.error.issues);
  }
  return result.data;
}

let cachedClientEnv: ClientEnv | null = null;

/**
 * Returns the lazily-evaluated client environment singleton.
 * In test mode (NODE_ENV === "test"), re-evaluates each time to support test overrides.
 */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv || process.env.NODE_ENV === "test") {
    cachedClientEnv = validateClientEnv();
  }
  return cachedClientEnv;
}

/**
 * Resets the in-memory client environment cache (primarily for tests).
 */
export function resetClientEnvCache(): void {
  cachedClientEnv = null;
}
