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

export type ExternalProviderSecretSource = "keychain" | "env";

export type WebCredentials = { cookie: string; userId: string | undefined };

type KeychainReader = (service: string) => Promise<string | undefined>;
let customKeychainReader: KeychainReader | null = null;

export function __setKeychainReaderForTesting(reader: KeychainReader | null): void {
  customKeychainReader = reader;
}

type ExternalProviderTokenState = {
  webCredsCache?: { value: WebCredentials; expiresAt: number };
  cached?: { token: string; expiresAt: number };
  inflightWebCreds?: Promise<WebCredentials | undefined>;
  inflightToken?: Promise<string>;
};

const globalState = globalThis as unknown as { __externalProviderTokenState?: ExternalProviderTokenState };
globalState.__externalProviderTokenState ??= {};
const tokenState: ExternalProviderTokenState = globalState.__externalProviderTokenState;

export class InvalidSecretSourceError extends Error {
  constructor(invalidSource: string) {
    super(`Invalid EXTERNAL_API_SECRET_SOURCE "${invalidSource}". Valid options are "keychain" or "env".`);
    this.name = "InvalidSecretSourceError";
  }
}

export class MissingTokenError extends Error {
  constructor(source: ExternalProviderSecretSource = "keychain") {
    const message =
      source === "env"
        ? [
            "No upstream credentials are configured.",
            "Set EXTERNAL_API_WEB_COOKIE (and optional EXTERNAL_API_WEB_USER) in your environment variables.",
            "Alternatively, set EXTERNAL_API_TOKEN in your environment variables.",
          ].join("\n")
        : [
            "No upstream API token is available.",
            "Store one in the macOS keychain by running this yourself in a terminal:",
            `  security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w`,
            "Alternatively set EXTERNAL_API_TOKEN in .env.local.",
          ].join("\n");
    super(message);
    this.name = "MissingTokenError";
  }
}

/**
 * Returns the configured credential source ("keychain" or "env").
 * Defaults to "keychain" when unset or empty.
 */
export function getExternalProviderSecretSource(): ExternalProviderSecretSource {
  const raw = process.env.EXTERNAL_API_SECRET_SOURCE?.trim();
  if (!raw) {
    return "keychain";
  }
  if (raw === "keychain" || raw === "env") {
    return raw;
  }
  throw new InvalidSecretSourceError(raw);
}

/**
 * Normalizes a raw secret string: trims whitespace and strips accidental wrapping
 * quotes ("..." or '...').
 */
export function normalizeSecret(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  let trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes a web session cookie string: strips outer quotes, whitespace, and
 * any accidental leading `Cookie:` prefix.
 */
export function normalizeCookie(value: string | undefined): string | undefined {
  const normalized = normalizeSecret(value);
  if (normalized === undefined) {
    return undefined;
  }
  if (normalized.toLowerCase().startsWith("cookie:")) {
    const withoutPrefix = normalized.slice(7).trim();
    return withoutPrefix.length > 0 ? withoutPrefix : undefined;
  }
  return normalized;
}

/**
 * Returns active environment-based secrets for scrubbing from logs and error responses.
 */
export function getActiveSecrets(): string[] {
  const secrets: string[] = [];
  const envCookie = normalizeCookie(process.env.EXTERNAL_API_WEB_COOKIE);
  const envUser = normalizeSecret(process.env.EXTERNAL_API_WEB_USER);
  const envToken = normalizeSecret(process.env.EXTERNAL_API_TOKEN);
  if (envCookie) secrets.push(envCookie);
  if (envUser) secrets.push(envUser);
  if (envToken) secrets.push(envToken);
  return secrets;
}

/**
 * Invalidates cached in-memory token and web credentials.
 */
export function invalidateCredentialCache(): void {
  tokenState.webCredsCache = undefined;
  tokenState.cached = undefined;
  tokenState.inflightWebCreds = undefined;
  tokenState.inflightToken = undefined;
}

/**
 * Reads the token from the macOS keychain.
 *
 * `find-generic-password -w` prints the secret to stdout, so the value is
 * captured here and never logged, echoed, or included in an error message.
 */
async function readKeychainSecret(service: string): Promise<string | undefined> {
  if (customKeychainReader !== null) {
    return customKeychainReader(service);
  }

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
 * Resolves the upstream token. In "keychain" mode, reads from macOS Keychain
 * service `external-api-token`. In "env" mode, reads normalized `EXTERNAL_API_TOKEN`.
 */
export async function getUpstreamToken(): Promise<string> {
  const source = getExternalProviderSecretSource();
  const now = Date.now();
  if (tokenState.cached !== undefined && tokenState.cached.expiresAt > now) {
    return tokenState.cached.token;
  }

  if (tokenState.inflightToken !== undefined) {
    return tokenState.inflightToken;
  }

  const promise = (async () => {
    try {
      let resolved: string | undefined;

      if (source === "env") {
        resolved = normalizeSecret(process.env.EXTERNAL_API_TOKEN);
      } else {
        resolved = await readKeychainSecret(KEYCHAIN_SERVICE);
      }

      if (resolved === undefined || resolved.length === 0) {
        throw new MissingTokenError(source);
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
 * In "keychain" mode, reads `external-api-web-cookie` and `external-api-web-user`
 * from macOS Keychain.
 * In "env" mode, reads normalized `EXTERNAL_API_WEB_COOKIE` and `EXTERNAL_API_WEB_USER`
 * from process.env without invoking the macOS `security` CLI.
 */
export async function getWebCredentials(): Promise<WebCredentials | undefined> {
  const source = getExternalProviderSecretSource();
  const now = Date.now();
  if (tokenState.webCredsCache !== undefined && tokenState.webCredsCache.expiresAt > now) {
    return tokenState.webCredsCache.value;
  }

  if (tokenState.inflightWebCreds !== undefined) {
    return tokenState.inflightWebCreds;
  }

  const promise = (async () => {
    try {
      if (source === "env") {
        const cookie = normalizeCookie(process.env.EXTERNAL_API_WEB_COOKIE);
        if (cookie === undefined) {
          return undefined;
        }
        const userId = normalizeSecret(process.env.EXTERNAL_API_WEB_USER);
        const value: WebCredentials = {
          cookie,
          userId: userId !== undefined && userId.length > 0 ? userId : undefined,
        };
        tokenState.webCredsCache = { value, expiresAt: Date.now() + WEB_CREDS_CACHE_TTL_MS };
        return value;
      }

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
