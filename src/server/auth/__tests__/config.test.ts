import { describe, expect, it } from "vitest";

import {
  FatalAuthConfigError,
  getAllowedUserEmails,
  getAuthConfig,
  isAuthBypassActive,
  isEmailAllowed,
  isVercelOrProd,
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

  describe("getAuthConfig", () => {
    it("extracts config fields and bypass state", () => {
      const env = {
        GOOGLE_CLIENT_ID: "client-id-123",
        GOOGLE_CLIENT_SECRET: "secret-abc",
        AUTH_SECRET: "super-secret-key-32-chars-minimum",
        ALLOWED_USER_EMAILS: "alice@test.com",
        AUTH_BYPASS_LOCAL: "false",
        NODE_ENV: "development",
      };
      const cfg = getAuthConfig(env);
      expect(cfg.clientId).toBe("client-id-123");
      expect(cfg.clientSecret).toBe("secret-abc");
      expect(cfg.authSecret).toBe("super-secret-key-32-chars-minimum");
      expect(cfg.allowedEmails).toEqual(new Set(["alice@test.com"]));
      expect(cfg.isBypassActive).toBe(false);
      expect(cfg.isVercelOrProd).toBe(false);
    });
  });
});
