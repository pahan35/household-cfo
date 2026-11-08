import { describe, expect, it } from "vitest";

import nextConfig, { validateNextConfigAuth } from "../../../next.config.mjs";

describe("next.config headers", () => {
  it("defines global X-Robots-Tag header for all routes", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) {
      throw new Error("headers() is not defined on nextConfig");
    }
    const headersConfig = await nextConfig.headers();
    const globalHeader = headersConfig.find((item: { source: string }) => item.source === "/:path*");
    expect(globalHeader).toBeDefined();
    expect(globalHeader?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
    });
  });

  it("defines redirects for dashboard and legacy auth paths", async () => {
    expect(nextConfig.redirects).toBeDefined();
    if (!nextConfig.redirects) {
      throw new Error("redirects() is not defined on nextConfig");
    }
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual({
      source: "/dashboard",
      destination: "/dashboard/default",
      permanent: false,
    });
    expect(redirects).toContainEqual({
      source: "/auth/v1/:path*",
      destination: "/auth/login",
      permanent: false,
    });
    expect(redirects).toContainEqual({
      source: "/auth/v2/:path*",
      destination: "/auth/login",
      permanent: false,
    });
  });
});

describe("next.config auth validation", () => {
  it("allows normal local development configurations", () => {
    expect(() => validateNextConfigAuth({})).not.toThrow();
    expect(() => validateNextConfigAuth({ AUTH_BYPASS_LOCAL: "true" })).not.toThrow();
    expect(() => validateNextConfigAuth({ AUTH_BYPASS_LOCAL: "false" })).not.toThrow();
  });

  it("allows Vercel deployment when bypass is unset or false", () => {
    expect(() => validateNextConfigAuth({ VERCEL: "1" })).not.toThrow();
    expect(() => validateNextConfigAuth({ VERCEL: "1", AUTH_BYPASS_LOCAL: "false" })).not.toThrow();
    expect(() => validateNextConfigAuth({ VERCEL_ENV: "production", AUTH_SECRET: "a".repeat(32) })).not.toThrow();
  });

  it("throws fatal build error when AUTH_BYPASS_LOCAL is true on Vercel", () => {
    expect(() => validateNextConfigAuth({ VERCEL: "1", AUTH_BYPASS_LOCAL: "true" })).toThrow(
      /AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/,
    );
    expect(() => validateNextConfigAuth({ VERCEL_ENV: "preview", AUTH_BYPASS_LOCAL: "true" })).toThrow(
      /AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/,
    );
  });
});
