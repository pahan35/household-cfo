import { describe, expect, it } from "vitest";

import {
  FatalAuthConfigError,
  getAllowedPreviewOrigins,
  getAllowedUserEmails,
  getAuthConfig,
  getCanonicalAuthUrl,
  isAllowedPreviewOrigin,
  isAuthBypassActive,
  isEmailAllowed,
  isVercelOrProd,
  normalizeOrigin,
} from "../config";

describe("auth config", () => {
  describe("isVercelOrProd", () => {
    it("returns true when VERCEL is '1'", () => {
      expect(isVercelOrProd({ VERCEL: "1" })).toBe(true);
    });

    it("returns true when VERCEL_ENV is set", () => {
      expect(isVercelOrProd({ VERCEL_ENV: "preview" })).toBe(true);
      expect(isVercelOrProd({ VERCEL_ENV: "production" })).toBe(true);
    });

    it("returns true when NODE_ENV is 'production'", () => {
      expect(isVercelOrProd({ NODE_ENV: "production" })).toBe(true);
    });

    it("returns false in local development", () => {
      expect(isVercelOrProd({ NODE_ENV: "development" })).toBe(false);
      expect(isVercelOrProd({})).toBe(false);
    });
  });

  describe("isAuthBypassActive", () => {
    it("defaults to true in local development when AUTH_BYPASS_LOCAL is unset", () => {
      expect(isAuthBypassActive({ NODE_ENV: "development" })).toBe(true);
      expect(isAuthBypassActive({})).toBe(true);
    });

    it("returns true in local development when AUTH_BYPASS_LOCAL is 'true'", () => {
      expect(isAuthBypassActive({ NODE_ENV: "development", AUTH_BYPASS_LOCAL: "true" })).toBe(true);
      expect(isAuthBypassActive({ NODE_ENV: "development", AUTH_BYPASS_LOCAL: "TRUE" })).toBe(true);
    });

    it("returns false in local development when AUTH_BYPASS_LOCAL is 'false'", () => {
      expect(isAuthBypassActive({ NODE_ENV: "development", AUTH_BYPASS_LOCAL: "false" })).toBe(false);
      expect(isAuthBypassActive({ NODE_ENV: "development", AUTH_BYPASS_LOCAL: "FALSE" })).toBe(false);
    });

    it("returns false on Vercel when AUTH_BYPASS_LOCAL is unset or 'false'", () => {
      expect(isAuthBypassActive({ VERCEL: "1" })).toBe(false);
      expect(isAuthBypassActive({ VERCEL: "1", AUTH_BYPASS_LOCAL: "false" })).toBe(false);
      expect(isAuthBypassActive({ VERCEL_ENV: "production" })).toBe(false);
      expect(isAuthBypassActive({ NODE_ENV: "production" })).toBe(false);
    });

    it("throws FatalAuthConfigError if AUTH_BYPASS_LOCAL is 'true' on Vercel or in production", () => {
      expect(() => isAuthBypassActive({ VERCEL: "1", AUTH_BYPASS_LOCAL: "true" })).toThrow(FatalAuthConfigError);
      expect(() => isAuthBypassActive({ VERCEL_ENV: "preview", AUTH_BYPASS_LOCAL: "true" })).toThrow(
        FatalAuthConfigError,
      );
      expect(() => isAuthBypassActive({ NODE_ENV: "production", AUTH_BYPASS_LOCAL: "true" })).toThrow(
        FatalAuthConfigError,
      );
    });
  });

  describe("getAllowedUserEmails and isEmailAllowed", () => {
    it("returns an empty set when ALLOWED_USER_EMAILS is unset or empty", () => {
      expect(getAllowedUserEmails({})).toEqual(new Set());
      expect(getAllowedUserEmails({ ALLOWED_USER_EMAILS: "" })).toEqual(new Set());
      expect(getAllowedUserEmails({ ALLOWED_USER_EMAILS: "  " })).toEqual(new Set());
    });

    it("parses, trims, and normalizes comma-separated emails to lowercase", () => {
      const parsed = getAllowedUserEmails({
        ALLOWED_USER_EMAILS: " User.One@gmail.com, USER.TWO@DOMAIN.ORG , ,",
      });
      expect(parsed).toEqual(new Set(["user.one@gmail.com", "user.two@domain.org"]));
    });

    it("checks email against allowlist correctly (case-insensitive)", () => {
      const env = { ALLOWED_USER_EMAILS: "alice@family.org,bob@family.org" };
      expect(isEmailAllowed("alice@family.org", env)).toBe(true);
      expect(isEmailAllowed("Alice@Family.Org", env)).toBe(true);
      expect(isEmailAllowed("BOB@FAMILY.ORG", env)).toBe(true);
      expect(isEmailAllowed("eve@intruder.com", env)).toBe(false);
      expect(isEmailAllowed("", env)).toBe(false);
      expect(isEmailAllowed(null, env)).toBe(false);
      expect(isEmailAllowed(undefined, env)).toBe(false);
    });
  });

  describe("canonical URL and preview origins", () => {
    it("normalizes origins properly", () => {
      expect(normalizeOrigin("https://family-budget.vercel.app/")).toBe("https://family-budget.vercel.app");
      expect(normalizeOrigin("  HTTPS://PREVIEW.EXAMPLE.COM:8080/path?query=1  ")).toBe(
        "https://preview.example.com:8080",
      );
      expect(normalizeOrigin("not-a-valid-url")).toBeNull();
      expect(normalizeOrigin("")).toBeNull();
      expect(normalizeOrigin(null)).toBeNull();
    });

    it("extracts canonical auth URL", () => {
      expect(getCanonicalAuthUrl({})).toBeNull();
      expect(getCanonicalAuthUrl({ AUTH_CANONICAL_URL: "https://budget.family.org/" })).toBe(
        "https://budget.family.org",
      );
    });

    it("parses allowed preview origins list", () => {
      expect(getAllowedPreviewOrigins({})).toEqual([]);
      expect(
        getAllowedPreviewOrigins({
          ALLOWED_PREVIEW_ORIGINS: " https://preview.org , *.domain.com/ , ",
        }),
      ).toEqual(["https://preview.org", "*.domain.com"]);
    });

    it("validates allowed preview origins correctly", () => {
      const env = {
        AUTH_CANONICAL_URL: "https://canonical.family.org",
        ALLOWED_PREVIEW_ORIGINS: "https://custom-preview.org, *.staging.family.org",
        VERCEL: "1",
      };

      // Canonical origin matches
      expect(isAllowedPreviewOrigin("https://canonical.family.org", env)).toBe(true);

      // Vercel deployment URLs match
      expect(isAllowedPreviewOrigin("https://family-budget-git-feat-team.vercel.app", env)).toBe(true);
      expect(isAllowedPreviewOrigin("https://preview-123.vercel.app", env)).toBe(true);

      // Explicit custom origins match
      expect(isAllowedPreviewOrigin("https://custom-preview.org", env)).toBe(true);
      expect(isAllowedPreviewOrigin("https://pr-5.staging.family.org", env)).toBe(true);

      // Disallowed origins reject
      expect(isAllowedPreviewOrigin("https://evil-attacker.com", env)).toBe(false);
      expect(isAllowedPreviewOrigin("http://insecure.vercel.app", env)).toBe(false); // HTTP rejected on vercel
      expect(isAllowedPreviewOrigin("https://not-staging.family.org", env)).toBe(false);
      expect(isAllowedPreviewOrigin("", env)).toBe(false);
      expect(isAllowedPreviewOrigin(null, env)).toBe(false);
    });

    it("allows localhost in local development", () => {
      const localEnv = { NODE_ENV: "development" };
      expect(isAllowedPreviewOrigin("http://localhost:3000", localEnv)).toBe(true);
      expect(isAllowedPreviewOrigin("http://127.0.0.1:3000", localEnv)).toBe(true);

      const vercelEnv = { VERCEL: "1" };
      expect(isAllowedPreviewOrigin("http://localhost:3000", vercelEnv)).toBe(false);
    });
  });

  describe("getAuthConfig", () => {
    it("extracts config fields and bypass state", () => {
      const env = {
        GOOGLE_CLIENT_ID: "client-id-123",
        GOOGLE_CLIENT_SECRET: "secret-abc",
        AUTH_SECRET: "super-secret-key-32-chars-minimum",
        AUTH_CANONICAL_URL: "https://family.budget.org",
        ALLOWED_PREVIEW_ORIGINS: "https://preview.org",
        ALLOWED_USER_EMAILS: "alice@test.com",
        AUTH_BYPASS_LOCAL: "false",
        NODE_ENV: "development",
      };
      const cfg = getAuthConfig(env);
      expect(cfg.clientId).toBe("client-id-123");
      expect(cfg.clientSecret).toBe("secret-abc");
      expect(cfg.authSecret).toBe("super-secret-key-32-chars-minimum");
      expect(cfg.canonicalUrl).toBe("https://family.budget.org");
      expect(cfg.allowedPreviewOrigins).toEqual(["https://preview.org"]);
      expect(cfg.allowedEmails).toEqual(new Set(["alice@test.com"]));
      expect(cfg.isBypassActive).toBe(false);
      expect(cfg.isVercelOrProd).toBe(false);
    });
  });
});
