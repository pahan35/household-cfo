import { describe, expect, it } from "vitest";

import { validateNextConfigAuth } from "../../../next.config.mjs";

describe("build-time environment validation in next.config.mjs", () => {
  const validSecret32 = "x".repeat(32);

  it("succeeds for valid development build configuration", () => {
    expect(() => validateNextConfigAuth({})).not.toThrow();
  });

  it("succeeds for valid production build configuration", () => {
    expect(() =>
      validateNextConfigAuth({
        NODE_ENV: "production",
        EXTERNAL_API_ADAPTER: "external-provider",
        AUTH_SECRET: validSecret32,
      }),
    ).not.toThrow();
  });

  it("halts build if production deployment is configured with mock adapter", () => {
    expect(() =>
      validateNextConfigAuth({
        NODE_ENV: "production",
        EXTERNAL_API_ADAPTER: "mock",
        AUTH_SECRET: validSecret32,
      }),
    ).toThrowError(/EXTERNAL_API_ADAPTER cannot be 'mock' in production deployments/);
  });

  it("halts build if production deployment is missing AUTH_SECRET", () => {
    expect(() =>
      validateNextConfigAuth({
        NODE_ENV: "production",
        EXTERNAL_API_ADAPTER: "external-provider",
      }),
    ).toThrowError(/AUTH_SECRET must be at least 32 characters long in production/);
  });

  it("halts build on Vercel e2e branch if EXTERNAL_API_ADAPTER is not mock", () => {
    expect(() =>
      validateNextConfigAuth({
        VERCEL_GIT_COMMIT_REF: "e2e",
        EXTERNAL_API_ADAPTER: "external-provider",
      }),
    ).toThrowError(/VERCEL_GIT_COMMIT_REF is 'e2e' but EXTERNAL_API_ADAPTER is not 'mock'/);
  });

  it("halts build if mock database URL collides with production database URL", () => {
    expect(() =>
      validateNextConfigAuth({
        EXTERNAL_API_ADAPTER: "mock",
        SUPABASE_URL: "https://db.prod.supabase.co",
        SUPABASE_MOCK_URL: "https://db.prod.supabase.co",
      }),
    ).toThrowError(/SUPABASE_MOCK_URL cannot be identical to production SUPABASE_URL/);
  });

  it("halts build if AUTH_BYPASS_LOCAL is enabled on Vercel", () => {
    expect(() =>
      validateNextConfigAuth({
        VERCEL: "1",
        AUTH_BYPASS_LOCAL: "true",
      }),
    ).toThrowError(/AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/);
  });
});
