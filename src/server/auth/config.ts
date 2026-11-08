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
 * Normalizes an origin/URL string (trimmed, lowercase, protocol + host only).
 */
export function normalizeOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns the canonical auth URL if configured (e.g. "https://family-budget.vercel.app").
 */
export function getCanonicalAuthUrl(env: Record<string, string | undefined> = process.env): string | null {
  return normalizeOrigin(env.AUTH_CANONICAL_URL);
}

/**
 * Parses comma-separated ALLOWED_PREVIEW_ORIGINS into an array of normalized origins.
 */
export function getAllowedPreviewOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.ALLOWED_PREVIEW_ORIGINS;
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/\/+$/, ""))
    .filter((item) => item.length > 0);
}

/**
 * Checks whether an origin is allowed as a target for preview OAuth relay.
 * Allowed origins:
 * - Matches AUTH_CANONICAL_URL
 * - Matches ALLOWED_PREVIEW_ORIGINS (exact or *.domain.tld wildcards)
 * - Safe Vercel deployment hostname: https://*.vercel.app
 * - Localhost in local non-production development
 */
export function isAllowedPreviewOrigin(
  origin?: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  // Canonical origin is always valid
  const canonical = getCanonicalAuthUrl(env);
  if (canonical && normalized === canonical) {
    return true;
  }

  // Check explicit ALLOWED_PREVIEW_ORIGINS
  const allowedList = getAllowedPreviewOrigins(env);
  for (const item of allowedList) {
    if (item === normalized) {
      return true;
    }
    if (item.startsWith("*.")) {
      const suffix = item.slice(1); // e.g. ".domain.com"
      try {
        const parsed = new URL(normalized);
        if (parsed.hostname.endsWith(suffix) || parsed.hostname === suffix.slice(1)) {
          return true;
        }
      } catch {
        // continue
      }
    }
  }

  // Safe Vercel deployment URL pattern
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) {
      return true;
    }
    // Localhost in local dev
    if (!isVercelOrProd(env) && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Returns the resolved auth configuration.
 */
export function getAuthConfig(env: Record<string, string | undefined> = process.env) {
  return {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    authSecret: env.AUTH_SECRET ?? "",
    canonicalUrl: getCanonicalAuthUrl(env),
    allowedPreviewOrigins: getAllowedPreviewOrigins(env),
    allowedEmails: getAllowedUserEmails(env),
    isBypassActive: isAuthBypassActive(env),
    isVercelOrProd: isVercelOrProd(env),
  };
}
