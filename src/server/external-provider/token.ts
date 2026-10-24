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

type ExternalProviderTokenState = {
  webCredsCache?: { value: WebCredentials; expiresAt: number };
  cached?: { token: string; expiresAt: number };
  inflightWebCreds?: Promise<WebCredentials | undefined>;
  inflightToken?: Promise<string>;
};

const globalState = globalThis as unknown as { __externalProviderTokenState?: ExternalProviderTokenState };
globalState.__externalProviderTokenState ??= {};
const tokenState: ExternalProviderTokenState = globalState.__externalProviderTokenState;

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
  if (tokenState.cached !== undefined && tokenState.cached.expiresAt > now) {
    return tokenState.cached.token;
  }

  if (tokenState.inflightToken !== undefined) {
    return tokenState.inflightToken;
  }

  const promise = (async () => {
    try {
      const fromEnv = process.env.EXTERNAL_API_TOKEN?.trim();
      const resolved =
        fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : await readKeychainSecret(KEYCHAIN_SERVICE);

      if (resolved === undefined || resolved.length === 0) {
        throw new MissingTokenError();
      }

      tokenState.cached = { token: resolved, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS };
      return resolved;
    } finally {
      tokenState.inflightToken = undefined;
    }
  })();

  tokenState.inflightToken = promise;
  return promise;
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
  if (tokenState.webCredsCache !== undefined && tokenState.webCredsCache.expiresAt > now) {
    return tokenState.webCredsCache.value;
  }

  if (tokenState.inflightWebCreds !== undefined) {
    return tokenState.inflightWebCreds;
  }

  const promise = (async () => {
    try {
      const cookie = await readKeychainSecret(WEB_COOKIE_SERVICE);
      if (cookie === undefined) {
        return undefined;
      }

      const userId = await readKeychainSecret(WEB_USER_SERVICE);
      const value: WebCredentials =
        userId === undefined || userId.length === 0 ? { cookie, userId: undefined } : { cookie, userId };

      tokenState.webCredsCache = { value, expiresAt: Date.now() + WEB_CREDS_CACHE_TTL_MS };
      return value;
    } finally {
      tokenState.inflightWebCreds = undefined;
    }
  })();

  tokenState.inflightWebCreds = promise;
  return promise;
}
