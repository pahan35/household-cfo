import { describe, expect, it } from "vitest";

import { EnvValidationError, getServerEnv, resetServerEnvCache, validateServerEnv } from "../env.server";

describe("validateServerEnv", () => {
  it("defaults to safe development values when empty", () => {
    const env = validateServerEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.EXTERNAL_API_ADAPTER).toBe("external-provider");
    expect(env.EXTERNAL_API_SECRET_SOURCE).toBe("keychain");
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_MOCK_URL).toBeUndefined();
    expect(env.AUTH_SECRET).toBeUndefined();
  });

  it("normalizes whitespace and case for enum properties", () => {
    const env = validateServerEnv({
      EXTERNAL_API_ADAPTER: "  MOCK  ",
      EXTERNAL_API_SECRET_SOURCE: "  ENV  ",
      NODE_ENV: "  TEST  ",
    });
    expect(env.EXTERNAL_API_ADAPTER).toBe("mock");
    expect(env.EXTERNAL_API_SECRET_SOURCE).toBe("env");
    expect(env.NODE_ENV).toBe("test");
  });

  it("treats empty or whitespace-only optional strings as undefined", () => {
    const env = validateServerEnv({
      DATABASE_URL: "   ",
      SUPABASE_URL: "",
      AUTH_SECRET: "   ",
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.AUTH_SECRET).toBeUndefined();
  });

  it("throws validation error for unrecognized adapter mode", () => {
    expect(() => validateServerEnv({ EXTERNAL_API_ADAPTER: "invalid" })).toThrow(EnvValidationError);
  });

  describe("E2E branch guard", () => {
    it("mandates mock adapter mode when VERCEL_GIT_COMMIT_REF is 'e2e'", () => {
      expect(() =>
        validateServerEnv({
          VERCEL_GIT_COMMIT_REF: "e2e",
          EXTERNAL_API_ADAPTER: "external-provider",
        }),
      ).toThrowError(/VERCEL_GIT_COMMIT_REF is 'e2e' but EXTERNAL_API_ADAPTER is not 'mock'/);
    });

    it("succeeds on 'e2e' branch when EXTERNAL_API_ADAPTER is 'mock'", () => {
      const env = validateServerEnv({
        VERCEL_GIT_COMMIT_REF: "e2e",
        EXTERNAL_API_ADAPTER: "mock",
      });
      expect(env.EXTERNAL_API_ADAPTER).toBe("mock");
    });
  });

  describe("Blast-radius database collision guard", () => {
    it("rejects when mock URL is identical to production URL in mock adapter mode", () => {
      expect(() =>
        validateServerEnv({
          EXTERNAL_API_ADAPTER: "mock",
          SUPABASE_URL: "https://db.prod.supabase.co",
          SUPABASE_MOCK_URL: "https://db.prod.supabase.co",
        }),
      ).toThrowError(/SUPABASE_MOCK_URL cannot be identical to production SUPABASE_URL/);
    });

    it("detects database URL collision case-insensitively and with trailing whitespace", () => {
      expect(() =>
        validateServerEnv({
          EXTERNAL_API_ADAPTER: "mock",
          SUPABASE_URL: "https://db.prod.supabase.co",
          SUPABASE_MOCK_URL: "  HTTPS://DB.PROD.SUPABASE.CO/  ",
        }),
      ).toThrowError(/SUPABASE_MOCK_URL cannot be identical to production SUPABASE_URL/);
    });

    it("allows distinct mock and production database URLs in mock mode", () => {
      const env = validateServerEnv({
        EXTERNAL_API_ADAPTER: "mock",
        SUPABASE_URL: "https://db.prod.supabase.co",
        SUPABASE_MOCK_URL: "https://db.mock.supabase.co",
      });
      expect(env.SUPABASE_MOCK_URL).toBe("https://db.mock.supabase.co");
    });

    it("allows mock URL without production URL in mock mode", () => {
      const env = validateServerEnv({
        EXTERNAL_API_ADAPTER: "mock",
        SUPABASE_MOCK_URL: "https://db.mock.supabase.co",
      });
      expect(env.SUPABASE_MOCK_URL).toBe("https://db.mock.supabase.co");
    });
  });

  describe("Production deployment guards", () => {
    const validSecret32 = "a".repeat(32);

    it("forbids mock adapter mode in NODE_ENV=production", () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: "production",
          EXTERNAL_API_ADAPTER: "mock",
          AUTH_SECRET: validSecret32,
        }),
      ).toThrowError(/EXTERNAL_API_ADAPTER cannot be 'mock' in production deployments/);
    });

    it("forbids mock adapter mode in VERCEL_ENV=production", () => {
      expect(() =>
        validateServerEnv({
          VERCEL_ENV: "production",
          EXTERNAL_API_ADAPTER: "mock",
          AUTH_SECRET: validSecret32,
        }),
      ).toThrowError(/EXTERNAL_API_ADAPTER cannot be 'mock' in production deployments/);
    });

    it("requires AUTH_SECRET in production", () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: "production",
          EXTERNAL_API_ADAPTER: "external-provider",
        }),
      ).toThrowError(/AUTH_SECRET must be at least 32 characters long in production/);
    });

    it("rejects AUTH_SECRET shorter than 32 characters in production", () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: "production",
          EXTERNAL_API_ADAPTER: "external-provider",
          AUTH_SECRET: "too-short-secret",
        }),
      ).toThrowError(/AUTH_SECRET must be at least 32 characters long in production/);
    });

    it("allows valid production configuration", () => {
      const env = validateServerEnv({
        NODE_ENV: "production",
        EXTERNAL_API_ADAPTER: "external-provider",
        AUTH_SECRET: validSecret32,
      });
      expect(env.AUTH_SECRET).toBe(validSecret32);
    });
  });

  describe("Auth bypass guards", () => {
    it("forbids AUTH_BYPASS_LOCAL on VERCEL=1", () => {
      expect(() =>
        validateServerEnv({
          VERCEL: "1",
          AUTH_BYPASS_LOCAL: "true",
        }),
      ).toThrowError(/AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/);
    });

    it("forbids AUTH_BYPASS_LOCAL on VERCEL_ENV=preview", () => {
      expect(() =>
        validateServerEnv({
          VERCEL_ENV: "preview",
          AUTH_BYPASS_LOCAL: "true",
        }),
      ).toThrowError(/AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/);
    });

    it("forbids AUTH_BYPASS_LOCAL in production", () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: "production",
          AUTH_SECRET: "a".repeat(32),
          AUTH_BYPASS_LOCAL: "true",
        }),
      ).toThrowError(/AUTH_BYPASS_LOCAL cannot be enabled on Vercel or in production/);
    });

    it("allows AUTH_BYPASS_LOCAL=true in local development outside Vercel", () => {
      const env = validateServerEnv({
        NODE_ENV: "development",
        AUTH_BYPASS_LOCAL: "true",
      });
      expect(env.AUTH_BYPASS_LOCAL).toBe("true");
    });
  });

  describe("getServerEnv and cache", () => {
    it("returns parsed environment from process.env", () => {
      resetServerEnvCache();
      const env = getServerEnv();
      expect(env).toBeDefined();
      expect(env.EXTERNAL_API_ADAPTER).toBeDefined();
    });
  });
});
