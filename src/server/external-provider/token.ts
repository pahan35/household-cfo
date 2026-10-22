import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = "external-api-token";
const KEYCHAIN_TIMEOUT_MS = 5_000;
const TOKEN_CACHE_TTL_MS = 60 * 60 * 1000;
const WEB_COOKIE_SERVICE = "external-api-web-cookie";
const WEB_USER_SERVICE = "external-api-web-user";
// Cookies can be invalidated or refreshed at any time, so they must not share
// the hour-long token cache. A short TTL keeps keychain reads cheap while
// picking up refreshed cookies within seconds.
const WEB_CREDS_CACHE_TTL_MS = 30 * 1000;

export type WebCredentials = { cookie: string; userId: string | undefined };

let webCredsCache: { value: WebCredentials; expiresAt: number } | undefined;

let cached: { token: string; expiresAt: number } | undefined;

export class MissingTokenError extends Error {
  constructor() {
    super(
      [
        "No upstream API token is available.",
        "Store one in the macOS keychain by running this yourself in a terminal:",
        `  security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w`,
        "Alternatively set EXTERNAL_API_TOKEN in .env.local.",
      ].join("\n"),
    );
    this.name = "MissingTokenError";
  }
}

/**
 * Reads the token from the macOS keychain.
 *
 * `find-generic-password -w` prints the secret to stdout, so the value is
 * captured here and never logged, echoed, or included in an error message.
 */
async function readKeychainSecret(service: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("security", ["find-generic-password", "-s", service, "-w"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      timeout: KEYCHAIN_TIMEOUT_MS,
    });

    const secret = stdout.trim();
    return secret.length > 0 ? secret : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the upstream token, preferring the keychain over the environment so
 * the secret is not persisted in any file inside the repository.
 */
export async function getUpstreamToken(): Promise<string> {
  const now = Date.now();
  if (cached !== undefined && cached.expiresAt > now) {
    return cached.token;
  }

  const fromEnv = process.env.EXTERNAL_API_TOKEN?.trim();
  const resolved = fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : await readKeychainSecret(KEYCHAIN_SERVICE);

  if (resolved === undefined || resolved.length === 0) {
    throw new MissingTokenError();
  }

  cached = { token: resolved, expiresAt: now + TOKEN_CACHE_TTL_MS };
  return resolved;
}

/**
 * Resolves the web session credentials used by the cookie-authenticated
 * api.external-provider.example.com backend.
 *
 * The full `Cookie:` request-header string (copied from a logged-in browser XHR)
 * lives under `external-api-web-cookie`; the logged-in user id lives under
 * `external-api-web-user`. Both are user-managed keychain entries and are never
 * logged, echoed, or included in error messages.
 */
export async function getWebCredentials(): Promise<WebCredentials | undefined> {
  const now = Date.now();
  if (webCredsCache !== undefined && webCredsCache.expiresAt > now) {
    return webCredsCache.value;
  }

  const cookie = await readKeychainSecret(WEB_COOKIE_SERVICE);
  if (cookie === undefined) {
    return undefined;
  }

  const userId = await readKeychainSecret(WEB_USER_SERVICE);
  if (userId === undefined || userId.length === 0) {
    // Without a user id only cookie-authenticated /api/* bodies cannot be
    // completed, but the cookie alone is still valid for the other routes.
    const value: WebCredentials = { cookie, userId: undefined };
    webCredsCache = { value, expiresAt: now + WEB_CREDS_CACHE_TTL_MS };
    return value;
  }

  const value: WebCredentials = { cookie, userId };
  webCredsCache = { value, expiresAt: now + WEB_CREDS_CACHE_TTL_MS };
  return value;
}
