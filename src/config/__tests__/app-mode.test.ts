import { describe, expect, it } from "vitest";

import { getAppMode, getHomeUrl, isAllowedFocusedPath, isFocusedMode } from "../app-mode";

describe("app-mode", () => {
  describe("getAppMode and isFocusedMode", () => {
    it("defaults to 'full' in local development", () => {
      const env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("full");
      expect(isFocusedMode(env)).toBe(false);
      expect(getHomeUrl(env)).toBe("/dashboard/default");
    });

    it("defaults to 'focused' when NODE_ENV is production", () => {
      const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("focused");
      expect(isFocusedMode(env)).toBe(true);
      expect(getHomeUrl(env)).toBe("/dashboard/family-budget");
    });

    it("defaults to 'focused' when VERCEL is '1'", () => {
      const env = { NODE_ENV: "development", VERCEL: "1" } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("focused");
      expect(isFocusedMode(env)).toBe(true);
      expect(getHomeUrl(env)).toBe("/dashboard/family-budget");
    });

    it("defaults to 'focused' when VERCEL_ENV is set", () => {
      const env = { NODE_ENV: "development", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("focused");
      expect(isFocusedMode(env)).toBe(true);
      expect(getHomeUrl(env)).toBe("/dashboard/family-budget");
    });

    it("honors NEXT_PUBLIC_APP_MODE='focused' in local development", () => {
      const env = {
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_MODE: "focused",
      } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("focused");
      expect(isFocusedMode(env)).toBe(true);
      expect(getHomeUrl(env)).toBe("/dashboard/family-budget");
    });

    it("honors NEXT_PUBLIC_APP_MODE='full' in production", () => {
      const env = {
        NODE_ENV: "production",
        VERCEL: "1",
        NEXT_PUBLIC_APP_MODE: "full",
      } as NodeJS.ProcessEnv;
      expect(getAppMode(env)).toBe("full");
      expect(isFocusedMode(env)).toBe(false);
      expect(getHomeUrl(env)).toBe("/dashboard/default");
    });

    it("ignores unrecognized NEXT_PUBLIC_APP_MODE values and falls back to env defaults", () => {
      const envProd = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_MODE: "invalid-mode",
      } as NodeJS.ProcessEnv;
      expect(getAppMode(envProd)).toBe("focused");

      const envDev = {
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_MODE: "invalid-mode",
      } as NodeJS.ProcessEnv;
      expect(getAppMode(envDev)).toBe("full");
    });

    it("honors global process.env.NEXT_PUBLIC_APP_MODE when called without arguments", () => {
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
      try {
        process.env.NEXT_PUBLIC_APP_MODE = "focused";
        expect(getAppMode()).toBe("focused");
        expect(isFocusedMode()).toBe(true);
        expect(getHomeUrl()).toBe("/dashboard/family-budget");

        process.env.NEXT_PUBLIC_APP_MODE = "full";
        expect(getAppMode()).toBe("full");
        expect(isFocusedMode()).toBe(false);
        expect(getHomeUrl()).toBe("/dashboard/default");
      } finally {
        process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });
  });

  describe("isAllowedFocusedPath", () => {
    it("returns true for /dashboard/family-budget and nested family budget routes", () => {
      expect(isAllowedFocusedPath("/dashboard/family-budget")).toBe(true);
      expect(isAllowedFocusedPath("/dashboard/family-budget/")).toBe(true);
      expect(isAllowedFocusedPath("/dashboard/family-budget/overview")).toBe(true);
      expect(isAllowedFocusedPath("/dashboard/family-budget/lifestyle/trips-concerts")).toBe(true);
      expect(isAllowedFocusedPath("/dashboard/family-budget/runway")).toBe(true);
    });

    it("returns false for upstream template routes, root, and non-budget paths", () => {
      expect(isAllowedFocusedPath("/")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard/default")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard/crm")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard/finance")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard/products")).toBe(false);
      expect(isAllowedFocusedPath("/dashboard/family-budget-extra")).toBe(false);
    });
  });
});
