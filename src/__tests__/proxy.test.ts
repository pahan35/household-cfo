import { NextRequest } from "next/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authConfig from "@/server/auth/config";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/server/auth/session";

import { isPublicPath, proxy } from "../proxy";

describe("Next.js proxy", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_SECRET = "mock-auth-secret-for-proxy-unit-tests-32b";
    process.env.ALLOWED_USER_EMAILS = "family@example.com";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("isPublicPath", () => {
    it("recognizes public endpoints and assets", () => {
      expect(isPublicPath("/auth/login")).toBe(true);
      expect(isPublicPath("/auth/v1/login")).toBe(true);
      expect(isPublicPath("/api/auth/login")).toBe(true);
      expect(isPublicPath("/api/auth/callback")).toBe(true);
      expect(isPublicPath("/unauthorized")).toBe(true);
      expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
      expect(isPublicPath("/logo.svg")).toBe(true);
      expect(isPublicPath("/favicon.ico")).toBe(true);
    });

    it("rejects protected paths", () => {
      expect(isPublicPath("/dashboard")).toBe(false);
      expect(isPublicPath("/dashboard/family-budget")).toBe(false);
      expect(isPublicPath("/api/external-provider/stat/ping")).toBe(false);
      expect(isPublicPath("/api/external-provider/Exchange/Ping")).toBe(false);
    });
  });

  describe("proxy handler", () => {
    it("allows public paths without authentication", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      const req = new NextRequest("http://localhost:3000/auth/login");
      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    });

    it("allows protected requests when local bypass is active", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
      const req = new NextRequest("http://localhost:3000/dashboard/family-budget");
      const res = await proxy(req);

      expect(res.status).toBe(200);
    });

    it("redirects unauthenticated page request to /auth/login with returnTo when bypass is inactive", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      const req = new NextRequest("http://localhost:3000/dashboard/family-budget?tab=runway");
      const res = await proxy(req);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/auth/login?returnTo=%2Fdashboard%2Ffamily-budget%3Ftab%3Drunway",
      );
    });

    it("returns 401 Unauthorized for unauthenticated API requests when bypass is inactive", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      const req = new NextRequest("http://localhost:3000/api/external-provider/stat/ping");
      const res = await proxy(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.message).toBe("Unauthorized");
    });

    it("allows protected requests when a valid session cookie is present", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      const token = await createSessionToken({ email: "family@example.com" }, { secret: process.env.AUTH_SECRET });
      const req = new NextRequest("http://localhost:3000/dashboard/family-budget", {
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });

      const res = await proxy(req);
      expect(res.status).toBe(200);
    });

    describe("focused mode enforcement", () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_APP_MODE = "focused";
      });

      it("redirects authorized requests for template or default routes to /dashboard/family-budget", async () => {
        vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);

        const paths = ["/", "/dashboard", "/dashboard/default", "/dashboard/crm", "/dashboard/finance"];
        for (const path of paths) {
          const req = new NextRequest(`http://localhost:3000${path}`);
          const res = await proxy(req);
          expect(res.status).toBe(307);
          expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard/family-budget");
        }
      });

      it("allows authorized requests to /dashboard/family-budget and nested subpaths in focused mode", async () => {
        vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);

        const paths = [
          "/dashboard/family-budget",
          "/dashboard/family-budget/",
          "/dashboard/family-budget/overview",
          "/dashboard/family-budget/lifestyle/trips-concerts",
        ];
        for (const path of paths) {
          const req = new NextRequest(`http://localhost:3000${path}`);
          const res = await proxy(req);
          expect(res.status).toBe(200);
        }
      });

      it("allows authorized API requests in focused mode", async () => {
        vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
        const req = new NextRequest("http://localhost:3000/api/external-provider/stat/ping");
        const res = await proxy(req);
        expect(res.status).toBe(200);
      });

      it("omits returnTo when unauthenticated user requests a disallowed route in focused mode", async () => {
        vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
        const req = new NextRequest("http://localhost:3000/dashboard/crm");
        const res = await proxy(req);

        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login");
      });
    });

    describe("full mode enforcement", () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_APP_MODE = "full";
      });

      it("allows authorized requests to template routes in full mode", async () => {
        vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
        const req = new NextRequest("http://localhost:3000/dashboard/crm");
        const res = await proxy(req);
        expect(res.status).toBe(200);
      });
    });
  });
});
