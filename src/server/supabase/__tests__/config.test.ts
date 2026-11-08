import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getExternalProviderAdapterMode,
  InvalidAdapterModeError,
  isMockAdapterMode,
  resolveSupabaseCredentials,
} from "../config";

describe("supabase config module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXTERNAL_API_ADAPTER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_MOCK_URL;
    delete process.env.SUPABASE_MOCK_SECRET_KEY;
    delete process.env.SUPABASE_MOCK_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getExternalProviderAdapterMode & isMockAdapterMode", () => {
    it("defaults to 'external-provider' when unset", () => {
      expect(getExternalProviderAdapterMode()).toBe("external-provider");
      expect(isMockAdapterMode()).toBe(false);
    });

    it("defaults to 'external-provider' when empty or whitespace", () => {
      process.env.EXTERNAL_API_ADAPTER = "";
      expect(getExternalProviderAdapterMode()).toBe("external-provider");
      expect(isMockAdapterMode()).toBe(false);

      process.env.EXTERNAL_API_ADAPTER = "   ";
      expect(getExternalProviderAdapterMode()).toBe("external-provider");
      expect(isMockAdapterMode()).toBe(false);
    });

    it("accepts 'external-provider' case-insensitively", () => {
      process.env.EXTERNAL_API_ADAPTER = "External-Provider";
      expect(getExternalProviderAdapterMode()).toBe("external-provider");
      expect(isMockAdapterMode()).toBe(false);
    });

    it("accepts 'mock' case-insensitively", () => {
      process.env.EXTERNAL_API_ADAPTER = " MOCK ";
      expect(getExternalProviderAdapterMode()).toBe("mock");
      expect(isMockAdapterMode()).toBe(true);
    });

    it("throws InvalidAdapterModeError for unsupported mode", () => {
      process.env.EXTERNAL_API_ADAPTER = "unsupported";
      expect(() => getExternalProviderAdapterMode()).toThrow(InvalidAdapterModeError);
      try {
        getExternalProviderAdapterMode();
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidAdapterModeError);
        expect((err as InvalidAdapterModeError).statusCode).toBe(503);
        expect((err as InvalidAdapterModeError).message).toContain('Invalid EXTERNAL_API_ADAPTER: "unsupported"');
      }
    });
  });

  describe("resolveSupabaseCredentials", () => {
    describe("in 'external-provider' mode (default)", () => {
      it("resolves SUPABASE_URL and SUPABASE_SECRET_KEY", () => {
        process.env.SUPABASE_URL = "https://prod.supabase.co";
        process.env.SUPABASE_SECRET_KEY = "sb_secret_prod";

        expect(resolveSupabaseCredentials()).toEqual({
          url: "https://prod.supabase.co",
          key: "sb_secret_prod",
        });
      });

      it("falls back to SUPABASE_SERVICE_ROLE_KEY if SUPABASE_SECRET_KEY is missing", () => {
        process.env.SUPABASE_URL = "https://prod.supabase.co";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_service_prod";

        expect(resolveSupabaseCredentials()).toEqual({
          url: "https://prod.supabase.co",
          key: "sb_service_prod",
        });
      });

      it("returns null if either url or key is missing", () => {
        process.env.SUPABASE_URL = "https://prod.supabase.co";
        expect(resolveSupabaseCredentials()).toBeNull();

        delete process.env.SUPABASE_URL;
        process.env.SUPABASE_SECRET_KEY = "sb_secret_prod";
        expect(resolveSupabaseCredentials()).toBeNull();
      });

      it("ignores SUPABASE_MOCK_URL in externalProvider mode", () => {
        process.env.SUPABASE_MOCK_URL = "https://mock.supabase.co";
        process.env.SUPABASE_MOCK_SECRET_KEY = "sb_secret_mock";
        expect(resolveSupabaseCredentials()).toBeNull();
      });
    });

    describe("in 'mock' mode", () => {
      beforeEach(() => {
        process.env.EXTERNAL_API_ADAPTER = "mock";
      });

      it("resolves SUPABASE_MOCK_URL and SUPABASE_MOCK_SECRET_KEY", () => {
        process.env.SUPABASE_MOCK_URL = "https://mock.supabase.co";
        process.env.SUPABASE_MOCK_SECRET_KEY = "sb_secret_mock";

        expect(resolveSupabaseCredentials()).toEqual({
          url: "https://mock.supabase.co",
          key: "sb_secret_mock",
        });
      });

      it("falls back to SUPABASE_MOCK_SERVICE_ROLE_KEY", () => {
        process.env.SUPABASE_MOCK_URL = "https://mock.supabase.co";
        process.env.SUPABASE_MOCK_SERVICE_ROLE_KEY = "sb_service_mock";

        expect(resolveSupabaseCredentials()).toEqual({
          url: "https://mock.supabase.co",
          key: "sb_service_mock",
        });
      });

      it("NEVER reads production SUPABASE_URL or SUPABASE_SECRET_KEY", () => {
        process.env.SUPABASE_URL = "https://prod.supabase.co";
        process.env.SUPABASE_SECRET_KEY = "sb_secret_prod";

        // SUPABASE_MOCK_URL is unset, so it MUST return null and NOT connect to prod
        expect(resolveSupabaseCredentials()).toBeNull();
      });

      it("uses mock credentials even when prod credentials are also present", () => {
        process.env.SUPABASE_URL = "https://prod.supabase.co";
        process.env.SUPABASE_SECRET_KEY = "sb_secret_prod";
        process.env.SUPABASE_MOCK_URL = "https://mock.supabase.co";
        process.env.SUPABASE_MOCK_SECRET_KEY = "sb_secret_mock";

        expect(resolveSupabaseCredentials()).toEqual({
          url: "https://mock.supabase.co",
          key: "sb_secret_mock",
        });
      });
    });
  });
});
