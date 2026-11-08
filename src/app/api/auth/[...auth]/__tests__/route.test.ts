import { NextRequest } from "next/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_COOKIE_NAME,
  createOAuthStateToken,
  createSessionToken,
  verifyOAuthStateToken,
} from "@/server/auth/session";

import { GET } from "../route";

describe("OAuth route handler", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "mock-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
    process.env.AUTH_SECRET = "test-auth-secret-minimum-32-chars-long";
    process.env.ALLOWED_USER_EMAILS = "allowed@family.org";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("login action", () => {
    it("redirects to Google OAuth with proper params and sets state cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login?returnTo=/dashboard/custom");
      const res = await GET(req, { params: Promise.resolve({ auth: ["login"] }) });

      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(location).toContain("client_id=mock-client-id");
      expect(location).toContain("scope=openid+email+profile");

      const stateCookie = res.cookies.get("family_budget_oauth_state");
      expect(stateCookie).toBeDefined();
      const parsedState = JSON.parse(stateCookie?.value || "{}");
      expect(parsedState.returnTo).toBe("/dashboard/custom");
      expect(parsedState.state).toBeDefined();
    });

    it("defaults returnTo to /dashboard/family-budget in focused mode", async () => {
      process.env.NEXT_PUBLIC_APP_MODE = "focused";
      const req = new NextRequest("http://localhost:3000/api/auth/login");
      const res = await GET(req, { params: Promise.resolve({ auth: ["login"] }) });

      const stateCookie = res.cookies.get("family_budget_oauth_state");
      expect(stateCookie).toBeDefined();
      const parsedState = JSON.parse(stateCookie?.value || "{}");
      expect(parsedState.returnTo).toBe("/dashboard/family-budget");
    });

    it("defaults returnTo to /dashboard/default in full mode", async () => {
      process.env.NEXT_PUBLIC_APP_MODE = "full";
      const req = new NextRequest("http://localhost:3000/api/auth/login");
      const res = await GET(req, { params: Promise.resolve({ auth: ["login"] }) });

      const stateCookie = res.cookies.get("family_budget_oauth_state");
      expect(stateCookie).toBeDefined();
      const parsedState = JSON.parse(stateCookie?.value || "{}");
      expect(parsedState.returnTo).toBe("/dashboard/default");
    });

    it("returns 500 when GOOGLE_CLIENT_ID is not configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const req = new NextRequest("http://localhost:3000/api/auth/login");
      const res = await GET(req, { params: Promise.resolve({ auth: ["login"] }) });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.message).toContain("Google OAuth client ID is not configured");
    });
  });

  describe("callback action", () => {
    it("redirects to login when Google returns an error", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/callback?error=access_denied");
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login?error=access_denied");
    });

    it("redirects to login with state_mismatch when state does not match cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=mock-code&state=wrong-state", {
        headers: {
          cookie: `family_budget_oauth_state=${JSON.stringify({ state: "correct-state", returnTo: "/dashboard" })}`,
        },
      });
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login?error=state_mismatch");
    });

    it("redirects allowlisted user to returnTo and sets session cookie", async () => {
      const statePayload = JSON.stringify({ state: "xyz123", returnTo: "/dashboard/family-budget" });
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=good-code&state=xyz123", {
        headers: {
          cookie: `family_budget_oauth_state=${encodeURIComponent(statePayload)}`,
        },
      });

      globalThis.fetch = vi.fn().mockImplementation((url: string | Request) => {
        const urlStr = typeof url === "string" ? url : url.url;
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: "google-access-token" }), { status: 200 }),
          );
        }
        if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                email: "Allowed@Family.Org",
                email_verified: true,
                name: "Allowed User",
                picture: "https://example.com/avatar.png",
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch to ${urlStr}`));
      });

      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/family-budget");

      const sessionCookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
    });

    it("falls back to getHomeUrl() when state cookie does not specify returnTo", async () => {
      process.env.NEXT_PUBLIC_APP_MODE = "focused";
      const statePayload = JSON.stringify({ state: "xyz123" });
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=good-code&state=xyz123", {
        headers: {
          cookie: `family_budget_oauth_state=${encodeURIComponent(statePayload)}`,
        },
      });

      globalThis.fetch = vi.fn().mockImplementation((url: string | Request) => {
        const urlStr = typeof url === "string" ? url : url.url;
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: "google-access-token" }), { status: 200 }),
          );
        }
        if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                email: "allowed@family.org",
                email_verified: true,
                name: "Allowed User",
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch to ${urlStr}`));
      });

      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/family-budget");
    });

    it("redirects unverified email to /unauthorized?reason=unverified_email", async () => {
      const statePayload = JSON.stringify({ state: "xyz123", returnTo: "/dashboard" });
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=good-code&state=xyz123", {
        headers: {
          cookie: `family_budget_oauth_state=${encodeURIComponent(statePayload)}`,
        },
      });

      globalThis.fetch = vi.fn().mockImplementation((url: string | Request) => {
        const urlStr = typeof url === "string" ? url : url.url;
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: "google-access-token" }), { status: 200 }),
          );
        }
        if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                email: "allowed@family.org",
                email_verified: false,
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch to ${urlStr}`));
      });

      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/unauthorized?reason=unverified_email");
    });

    it("redirects non-allowlisted email to /unauthorized", async () => {
      const statePayload = JSON.stringify({ state: "xyz123", returnTo: "/dashboard" });
      const req = new NextRequest("http://localhost:3000/api/auth/callback?code=good-code&state=xyz123", {
        headers: {
          cookie: `family_budget_oauth_state=${encodeURIComponent(statePayload)}`,
        },
      });

      globalThis.fetch = vi.fn().mockImplementation((url: string | Request) => {
        const urlStr = typeof url === "string" ? url : url.url;
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: "google-access-token" }), { status: 200 }),
          );
        }
        if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                email: "stranger@other.com",
                email_verified: true,
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch to ${urlStr}`));
      });

      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/unauthorized");
    });
  });

  describe("logout action", () => {
    it("clears session cookie and redirects to /auth/login", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/logout");
      const res = await GET(req, { params: Promise.resolve({ auth: ["logout"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login");
      const cookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie?.value).toBe("");
      expect(cookie?.maxAge).toBe(0);
    });
  });

  describe("session action", () => {
    it("returns 401 when not authenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session");
      const res = await GET(req, { params: Promise.resolve({ auth: ["session"] }) });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.user).toBeNull();
    });

    it("returns session user when valid session cookie is present", async () => {
      const token = await createSessionToken(
        { email: "allowed@family.org", name: "Family Member" },
        { secret: process.env.AUTH_SECRET },
      );
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });
      const res = await GET(req, { params: Promise.resolve({ auth: ["session"] }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user?.email).toBe("allowed@family.org");
      expect(data.user?.name).toBe("Family Member");
    });
  });

  describe("canonical relay OAuth flow", () => {
    const canonicalUrl = "https://family-budget.vercel.app";
    const previewOrigin = "https://family-budget-git-feat-team.vercel.app";

    beforeEach(() => {
      process.env.AUTH_CANONICAL_URL = canonicalUrl;
      process.env.AUTH_SECRET = "test-auth-secret-minimum-32-chars-long";
    });

    it("login on preview origin sets canonical redirect_uri and encodes origin in signed state", async () => {
      const req = new NextRequest(`${previewOrigin}/api/auth/login?returnTo=/dashboard/custom`);
      const res = await GET(req, { params: Promise.resolve({ auth: ["login"] }) });

      expect(res.status).toBe(302);
      const location = res.headers.get("location") || "";
      const url = new URL(location);

      expect(url.searchParams.get("redirect_uri")).toBe(`${canonicalUrl}/api/auth/callback`);

      const stateParam = url.searchParams.get("state");
      expect(stateParam).toBeDefined();

      const verified = await verifyOAuthStateToken(stateParam || "", {
        secret: process.env.AUTH_SECRET,
      });
      expect(verified).not.toBeNull();
      expect(verified?.origin).toBe(previewOrigin);
      expect(verified?.canonicalUrl).toBe(canonicalUrl);
      expect(verified?.returnTo).toBe("/dashboard/custom");
    });

    it("canonical callback relays code and state to preview origin", async () => {
      const signedState = await createOAuthStateToken(
        {
          state: "nonce-xyz-123",
          returnTo: "/dashboard/family-budget",
          origin: previewOrigin,
          canonicalUrl,
        },
        { secret: process.env.AUTH_SECRET },
      );

      const req = new NextRequest(`${canonicalUrl}/api/auth/callback?code=mock-google-code&state=${signedState}`);
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      const location = res.headers.get("location") || "";
      expect(location).toBe(`${previewOrigin}/api/auth/callback?code=mock-google-code&state=${signedState}`);
    });

    it("canonical callback relays Google error back to preview login page", async () => {
      const signedState = await createOAuthStateToken(
        {
          state: "nonce-xyz-123",
          returnTo: "/dashboard/family-budget",
          origin: previewOrigin,
          canonicalUrl,
        },
        { secret: process.env.AUTH_SECRET },
      );

      const req = new NextRequest(`${canonicalUrl}/api/auth/callback?error=access_denied&state=${signedState}`);
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${previewOrigin}/auth/login?error=access_denied`);
    });

    it("canonical callback rejects relay to disallowed origin", async () => {
      const signedState = await createOAuthStateToken(
        {
          state: "nonce-xyz-123",
          returnTo: "/dashboard",
          origin: "https://evil-attacker.com",
          canonicalUrl,
        },
        { secret: process.env.AUTH_SECRET },
      );

      const req = new NextRequest(`${canonicalUrl}/api/auth/callback?code=mock-code&state=${signedState}`);
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${canonicalUrl}/auth/login?error=disallowed_relay_origin`);
    });

    it("preview callback exchanges code using canonical redirect_uri and sets session cookie", async () => {
      let capturedExchangeParams: URLSearchParams | null = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("oauth2.googleapis.com/token")) {
          capturedExchangeParams = new URLSearchParams(init?.body?.toString());
          return Promise.resolve({
            ok: true,
            json: async () => ({ access_token: "mock-access-token" }),
          });
        }
        if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              email: "allowed@family.org",
              email_verified: true,
              name: "Preview Tester",
              picture: "https://example.com/pic.jpg",
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      const signedState = await createOAuthStateToken(
        {
          state: "nonce-xyz-123",
          returnTo: "/dashboard/family-budget",
          origin: previewOrigin,
          canonicalUrl,
        },
        { secret: process.env.AUTH_SECRET },
      );

      const req = new NextRequest(`${previewOrigin}/api/auth/callback?code=mock-relayed-code&state=${signedState}`);
      const res = await GET(req, { params: Promise.resolve({ auth: ["callback"] }) });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${previewOrigin}/dashboard/family-budget`);

      // Verify that code exchange sent the canonical redirect_uri to Google
      expect(capturedExchangeParams).not.toBeNull();
      const params = capturedExchangeParams as unknown as URLSearchParams;
      expect(params.get("redirect_uri")).toBe(`${canonicalUrl}/api/auth/callback`);
      expect(params.get("code")).toBe("mock-relayed-code");

      // Verify session cookie was attached on preview origin
      const sessionCookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
    });
  });
});
