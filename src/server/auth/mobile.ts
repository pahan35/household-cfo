import "server-only";

import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import type { AuthContext } from "@/server/services/types";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Parses `MOBILE_API_TOKENS` into `{ label, token }` pairs.
 *
 * Accepted format: comma-separated entries, each either `label:token` or a bare `token`
 * (labelled `mobile`). Tokens are never logged or returned to callers.
 */
export function parseMobileApiTokens(env: Record<string, string | undefined> = process.env) {
  const raw = env.MOBILE_API_TOKENS;
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator === -1) return { label: "mobile", token: entry };
      return { label: entry.slice(0, separator).trim() || "mobile", token: entry.slice(separator + 1).trim() };
    })
    .filter((entry) => entry.token.length > 0);
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Constant-time check of a presented Bearer token against the configured mobile API tokens. */
export function verifyMobileToken(
  token: string,
  env: Record<string, string | undefined> = process.env,
): AuthContext | null {
  const presented = digest(token);
  let matched: AuthContext | null = null;

  // Compare against every configured token so timing does not reveal which one matched.
  for (const candidate of parseMobileApiTokens(env)) {
    if (timingSafeEqual(presented, digest(candidate.token)) && !matched) {
      matched = { subject: candidate.label, source: "bearer" };
    }
  }
  return matched;
}

/**
 * Resolves the caller of a `/api/v1/` request:
 * 1. `Authorization: Bearer <token>` → mobile API token (an invalid token is rejected outright).
 * 2. Local development bypass.
 * 3. Web session cookie.
 */
export async function resolveRequestAuth(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Promise<AuthContext | null> {
  const bearer = extractBearerToken(request);
  if (bearer) {
    return verifyMobileToken(bearer, env);
  }

  if (isAuthBypassActive(env)) {
    return { subject: "local-dev", source: "bypass" };
  }

  const session = await getSessionFromRequest(request, env);
  return session ? { subject: session.email, source: "session" } : null;
}
