import { describe, expect, it } from "vitest";

import { ClientEnvValidationError, getClientEnv, resetClientEnvCache, validateClientEnv } from "../env.client";

describe("validateClientEnv", () => {
  it("defaults to empty client configuration when unset", () => {
    const env = validateClientEnv({});
    expect(env.NEXT_PUBLIC_APP_MODE).toBeUndefined();
  });

  it("normalizes and validates NEXT_PUBLIC_APP_MODE", () => {
    expect(validateClientEnv({ NEXT_PUBLIC_APP_MODE: "focused" }).NEXT_PUBLIC_APP_MODE).toBe("focused");
    expect(validateClientEnv({ NEXT_PUBLIC_APP_MODE: "full" }).NEXT_PUBLIC_APP_MODE).toBe("full");
    expect(validateClientEnv({ NEXT_PUBLIC_APP_MODE: "  FOCUSED  " }).NEXT_PUBLIC_APP_MODE).toBe("focused");
  });

  it("treats empty string NEXT_PUBLIC_APP_MODE as undefined", () => {
    expect(validateClientEnv({ NEXT_PUBLIC_APP_MODE: "   " }).NEXT_PUBLIC_APP_MODE).toBeUndefined();
  });

  it("throws validation error for invalid NEXT_PUBLIC_APP_MODE", () => {
    expect(() => validateClientEnv({ NEXT_PUBLIC_APP_MODE: "invalid" })).toThrow(ClientEnvValidationError);
  });

  it("strips any server secret keys passed into client environment validation", () => {
    const result = validateClientEnv({
      NEXT_PUBLIC_APP_MODE: "focused",
      AUTH_SECRET: "super-secret-server-token-do-not-leak",
      SUPABASE_SECRET_KEY: "secret-key",
    } as Record<string, string | undefined>);

    expect(result).toEqual({ NEXT_PUBLIC_APP_MODE: "focused" });
    expect("AUTH_SECRET" in result).toBe(false);
    expect("SUPABASE_SECRET_KEY" in result).toBe(false);
  });

  describe("getClientEnv", () => {
    it("returns client env and allows cache reset", () => {
      resetClientEnvCache();
      const env = getClientEnv();
      expect(env).toBeDefined();
    });
  });
});
