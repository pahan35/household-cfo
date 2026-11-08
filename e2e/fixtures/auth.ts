import { type BrowserContext, test as base, type Page } from "@playwright/test";

export const AUTH_COOKIE_NAME = "family_budget_session";
export const DEFAULT_E2E_EMAIL = "e2e-runner@family-budget.internal";
export const DEFAULT_FALLBACK_SECRET = "dev-insecure-auth-secret-family-budget-local-development-only-32bytes";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface E2ESessionOptions {
  email?: string;
  name?: string;
  picture?: string;
  secret?: string;
  expiresInSeconds?: number;
  now?: number;
}

/**
 * Creates an HMAC-SHA256 signed session JWT for E2E tests using Web Crypto.
 * Matches the signing format and structure expected by src/server/auth/session.ts.
 */
export async function createE2ESessionToken(options?: E2ESessionOptions): Promise<string> {
  const secret = options?.secret ?? process.env.AUTH_SECRET ?? DEFAULT_FALLBACK_SECRET;
  const email = (options?.email ?? DEFAULT_E2E_EMAIL).trim().toLowerCase();
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  const expiresIn = options?.expiresInSeconds ?? 7 * 24 * 60 * 60; // 7 days

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    email,
    name: options?.name ?? "E2E Test Runner",
    picture: options?.picture,
    iat: now,
    exp: now + expiresIn,
  };

  const enc = new TextEncoder();
  const encodedHeader = toBase64Url(enc.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(enc.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const encodedSignature = toBase64Url(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

export interface InjectAuthCookieOptions {
  baseURL?: string;
  token?: string;
  email?: string;
  name?: string;
  secret?: string;
}

/**
 * Injects a pre-signed family_budget_session cookie into the Playwright BrowserContext.
 */
export async function injectAuthCookie(context: BrowserContext, options?: InjectAuthCookieOptions): Promise<string> {
  const token =
    options?.token ??
    (await createE2ESessionToken({
      email: options?.email,
      name: options?.name,
      secret: options?.secret,
    }));

  const targetUrl =
    options?.baseURL ?? process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";

  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    url = new URL("http://localhost:3000");
  }

  await context.addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);

  return token;
}

/**
 * Extended Playwright test with pre-authenticated page fixture.
 */
export const test = base.extend<{
  authenticatedPage: Page;
  sessionToken: string;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture dependency injection requires object pattern
  sessionToken: async ({}, use) => {
    const token = await createE2ESessionToken();
    await use(token);
  },
  authenticatedPage: async ({ context, page, baseURL, sessionToken }, use) => {
    await injectAuthCookie(context, { baseURL, token: sessionToken });
    await use(page);
  },
});

export { expect } from "@playwright/test";
