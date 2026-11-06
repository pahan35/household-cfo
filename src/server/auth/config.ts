export class FatalAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalAuthConfigError";
  }
}

/**
 * Returns true if the environment is Vercel or production.
 */
export function isVercelOrProd(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV) || env.NODE_ENV === "production";
}

/**
 * Resolves whether local authentication bypass is active.
 *
 * In local non-Vercel development (NODE_ENV !== "production" and not Vercel),
 * this defaults to `true` when unset, and can be toggled to `false` via
 * AUTH_BYPASS_LOCAL="false" to test Google OAuth locally.
 *
 * Hard fail-closed guard: on Vercel or in production, bypass is NEVER permitted.
 * If AUTH_BYPASS_LOCAL is set to "true" on Vercel or in production, this throws
 * a FatalAuthConfigError immediately.
 */
export function isAuthBypassActive(env: Record<string, string | undefined> = process.env): boolean {
  if (isVercelOrProd(env)) {
    if (env.AUTH_BYPASS_LOCAL?.toLowerCase() === "true") {
      throw new FatalAuthConfigError(
        "CRITICAL SECURITY CONFIGURATION ERROR: AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production.",
      );
    }
    return false;
  }

  // Local development outside Vercel
  if (env.AUTH_BYPASS_LOCAL?.toLowerCase() === "false") {
    return false;
  }
  return true;
}

/**
 * Parses the comma-separated ALLOWED_USER_EMAILS environment variable
 * into a set of normalized (trimmed, lowercase) email strings.
 */
export function getAllowedUserEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = env.ALLOWED_USER_EMAILS;
  if (!raw) {
    return new Set<string>();
  }
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
}

/**
 * Checks whether an email address is present in the parsed allowlist.
 */
export function isEmailAllowed(email?: string | null, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) {
    return false;
  }
  const allowed = getAllowedUserEmails(env);
  return allowed.has(email.trim().toLowerCase());
}

/**
 * Returns the resolved auth configuration.
 */
export function getAuthConfig(env: Record<string, string | undefined> = process.env) {
  return {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    authSecret: env.AUTH_SECRET ?? "",
    allowedEmails: getAllowedUserEmails(env),
    isBypassActive: isAuthBypassActive(env),
    isVercelOrProd: isVercelOrProd(env),
  };
}
