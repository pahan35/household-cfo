import { NextRequest, NextResponse } from "next/server";

import { describe, expect, it } from "vitest";

import { FatalAuthConfigError } from "../config";
import {
  AUTH_COOKIE_NAME,
  attachSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getDashboardUserFromCookies,
  getSessionFromRequest,
  getSessionSecret,
  type SessionUser,
  verifySessionToken,
} from "../session";

describe("session management", () => {
  const secret = "test-secret-that-is-at-least-32-chars-long";
  const env = {
    AUTH_SECRET: secret,
    ALLOWED_USER_EMAILS: "alice@family.org,bob@family.org",
    NODE_ENV: "development",
  };

  const sampleUser: SessionUser = {
    email: "Alice@Family.Org",
    name: "Alice Example",
    picture: "https://example.com/avatar.jpg",
  };

  describe("createSessionToken & verifySessionToken", () => {
    it("creates a signed token and verifies it successfully", async () => {
      const token = await createSessionToken(sampleUser, { secret });
      const verified = await verifySessionToken(token, { secret, env });

      expect(verified).not.toBeNull();
      expect(verified?.email).toBe("alice@family.org");
      expect(verified?.name).toBe("Alice Example");
      expect(verified?.picture).toBe("https://example.com/avatar.jpg");
    });

    it("returns null if token is expired", async () => {
      const now = 1_000_000;
      const token = await createSessionToken(sampleUser, {
        secret,
        now,
        expiresInSeconds: 60,
      });

      // Verification after expiration
      const verified = await verifySessionToken(token, {
        secret,
        env,
        now: now + 61,
      });
      expect(verified).toBeNull();
    });

    it("returns null if signature is tampered with", async () => {
      const token = await createSessionToken(sampleUser, { secret });
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}.badsignature`;

      const verified = await verifySessionToken(tampered, { secret, env });
      expect(verified).toBeNull();
    });

    it("returns null if payload is tampered with", async () => {
      const token = await createSessionToken(sampleUser, { secret });
      const parts = token.split(".");
      const forgedPayload = btoa(JSON.stringify({ email: "bob@family.org", exp: 9_999_999_999 }));
      const tampered = `${parts[0]}.${forgedPayload}.${parts[2]}`;

      const verified = await verifySessionToken(tampered, { secret, env });
      expect(verified).toBeNull();
    });

    it("returns null if session email is no longer in ALLOWED_USER_EMAILS (dynamic re-check)", async () => {
      const token = await createSessionToken(sampleUser, { secret });

      // Alice was revoked:
      const updatedEnv = {
        AUTH_SECRET: secret,
        ALLOWED_USER_EMAILS: "bob@family.org",
        NODE_ENV: "development",
      };

      const verified = await verifySessionToken(token, { secret, env: updatedEnv });
      expect(verified).toBeNull();
    });

    it("returns null for malformed or empty tokens", async () => {
      expect(await verifySessionToken("", { secret, env })).toBeNull();
      expect(await verifySessionToken("one.two", { secret, env })).toBeNull();
      expect(await verifySessionToken("not-a-jwt", { secret, env })).toBeNull();
    });
  });

  describe("getSessionSecret", () => {
    it("returns default secret in local development if AUTH_SECRET is unset", () => {
      expect(getSessionSecret({ NODE_ENV: "development" })).toBeDefined();
    });

    it("throws FatalAuthConfigError in production or Vercel if AUTH_SECRET is missing", () => {
      expect(() => getSessionSecret({ VERCEL: "1" })).toThrow(FatalAuthConfigError);
      expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow(FatalAuthConfigError);
    });
  });

  describe("getSessionFromRequest", () => {
    it("extracts session from NextRequest cookies", async () => {
      const token = await createSessionToken(sampleUser, { secret });
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });

      const session = await getSessionFromRequest(req, env);
      expect(session?.email).toBe("alice@family.org");
    });

    it("returns null if session cookie is absent or invalid", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard");
      const session = await getSessionFromRequest(req, env);
      expect(session).toBeNull();
    });
  });

  describe("attachSessionCookie and clearSessionCookie", () => {
    it("attaches session cookie to response with secure attributes", () => {
      const res = NextResponse.next();
      attachSessionCookie(res, "mock-token-xyz", { NODE_ENV: "production" });

      const cookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe("mock-token-xyz");
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.secure).toBe(true);
      expect(cookie?.sameSite).toBe("lax");
    });

    it("clears session cookie", () => {
      const res = NextResponse.next();
      clearSessionCookie(res);

      const cookie = res.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe("");
      expect(cookie?.maxAge).toBe(0);
    });
  });

  describe("getDashboardUserFromCookies", () => {
    it("resolves authenticated user from valid session cookie", async () => {
      const token = await createSessionToken(sampleUser, { secret });
      const cookieStore = {
        get: (name: string) => (name === AUTH_COOKIE_NAME ? { value: token } : undefined),
      };

      const user = await getDashboardUserFromCookies(cookieStore, env);
      expect(user).toEqual({
        id: "alice@family.org",
        name: "Alice Example",
        email: "alice@family.org",
        avatar: "https://example.com/avatar.jpg",
        role: "Family Member",
      });
    });

    it("falls back to local dev user when cookie is absent and mode is focused", async () => {
      const cookieStore = {
        get: () => undefined,
      };
      const focusedEnv = {
        ...env,
        NEXT_PUBLIC_APP_MODE: "focused",
      };

      const user = await getDashboardUserFromCookies(cookieStore, focusedEnv);
      expect(user).toEqual({
        id: "local-dev",
        name: "Local Dev",
        email: "dev@localhost",
        avatar: "",
        role: "Developer",
      });
    });

    it("falls back to rootUser when cookie is absent and mode is full", async () => {
      const cookieStore = {
        get: () => undefined,
      };
      const fullEnv = {
        ...env,
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_MODE: "full",
      };

      const user = await getDashboardUserFromCookies(cookieStore, fullEnv);
      expect(user.name).toBe("Arham Khan");
      expect(user.email).toBe("hello@arhamkhnz.com");
    });
  });
});
