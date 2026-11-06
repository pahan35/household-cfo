import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  __setKeychainReaderForTesting,
  getActiveSecrets,
  getExternalProviderSecretSource,
  getUpstreamToken,
  getWebCredentials,
  InvalidSecretSourceError,
  invalidateCredentialCache,
  MissingTokenError,
  normalizeCookie,
  normalizeSecret,
} from "../token";

describe("token module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXTERNAL_API_SECRET_SOURCE;
    delete process.env.EXTERNAL_API_WEB_COOKIE;
    delete process.env.EXTERNAL_API_WEB_USER;
    delete process.env.EXTERNAL_API_TOKEN;
    invalidateCredentialCache();
    __setKeychainReaderForTesting(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    invalidateCredentialCache();
    __setKeychainReaderForTesting(null);
    vi.restoreAllMocks();
  });

  describe("getExternalProviderSecretSource", () => {
    it("defaults to 'keychain' when unset", () => {
      expect(getExternalProviderSecretSource()).toBe("keychain");
    });

    it("defaults to 'keychain' when empty or whitespace", () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "";
      expect(getExternalProviderSecretSource()).toBe("keychain");

      process.env.EXTERNAL_API_SECRET_SOURCE = "   ";
      expect(getExternalProviderSecretSource()).toBe("keychain");
    });

    it("returns 'keychain' when explicitly set", () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "keychain";
      expect(getExternalProviderSecretSource()).toBe("keychain");
    });

    it("returns 'env' when explicitly set", () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "env";
      expect(getExternalProviderSecretSource()).toBe("env");
    });

    it("throws InvalidSecretSourceError for unexpected values", () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "vault";
      expect(() => getExternalProviderSecretSource()).toThrow(InvalidSecretSourceError);
      expect(() => getExternalProviderSecretSource()).toThrow('Invalid EXTERNAL_API_SECRET_SOURCE "vault"');
    });
  });

  describe("normalization utilities", () => {
    it("normalizeSecret handles undefined and whitespace", () => {
      expect(normalizeSecret(undefined)).toBeUndefined();
      expect(normalizeSecret("")).toBeUndefined();
      expect(normalizeSecret("   ")).toBeUndefined();
      expect(normalizeSecret("  secret_value  ")).toBe("secret_value");
    });

    it("normalizeSecret strips wrapping quotes", () => {
      expect(normalizeSecret('"secret_value"')).toBe("secret_value");
      expect(normalizeSecret("'secret_value'")).toBe("secret_value");
      expect(normalizeSecret('""')).toBeUndefined();
      expect(normalizeSecret("''")).toBeUndefined();
    });

    it("normalizeCookie strips quotes and Cookie: prefix", () => {
      expect(normalizeCookie(undefined)).toBeUndefined();
      expect(normalizeCookie("session=123")).toBe("session=123");
      expect(normalizeCookie("Cookie: session=123; path=/")).toBe("session=123; path=/");
      expect(normalizeCookie("cookie: session=456")).toBe("session=456");
      expect(normalizeCookie('"Cookie: session=789"')).toBe("session=789");
      expect(normalizeCookie("Cookie:   ")).toBeUndefined();
    });

    it("getActiveSecrets extracts configured env secrets", () => {
      expect(getActiveSecrets()).toEqual([]);

      process.env.EXTERNAL_API_WEB_COOKIE = "cookie_secret";
      process.env.EXTERNAL_API_WEB_USER = "user_123";
      process.env.EXTERNAL_API_TOKEN = "token_456";

      expect(getActiveSecrets()).toEqual(["cookie_secret", "user_123", "token_456"]);
    });
  });

  describe("getWebCredentials in 'env' mode", () => {
    beforeEach(() => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "env";
    });

    it("returns undefined when EXTERNAL_API_WEB_COOKIE is unset", async () => {
      const keychainReader = vi.fn();
      __setKeychainReaderForTesting(keychainReader);

      const creds = await getWebCredentials();
      expect(creds).toBeUndefined();
      expect(keychainReader).not.toHaveBeenCalled();
    });

    it("returns normalized cookie and userId from env without invoking keychain", async () => {
      const keychainReader = vi.fn();
      __setKeychainReaderForTesting(keychainReader);

      process.env.EXTERNAL_API_WEB_COOKIE = '  "Cookie: my_session_cookie=abc"  ';
      process.env.EXTERNAL_API_WEB_USER = "  '98765' ";

      const creds = await getWebCredentials();
      expect(creds).toEqual({
        cookie: "my_session_cookie=abc",
        userId: "98765",
      });
      expect(keychainReader).not.toHaveBeenCalled();
    });

    it("handles missing EXTERNAL_API_WEB_USER with userId undefined", async () => {
      process.env.EXTERNAL_API_WEB_COOKIE = "session=xyz";

      const creds = await getWebCredentials();
      expect(creds).toEqual({
        cookie: "session=xyz",
        userId: undefined,
      });
    });
  });

  describe("getWebCredentials in 'keychain' mode", () => {
    beforeEach(() => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "keychain";
    });

    it("reads cookie and userId from keychain reader", async () => {
      const keychainReader = vi.fn().mockImplementation(async (service: string) => {
        if (service === "external-api-web-cookie") return "keychain_cookie_val";
        if (service === "external-api-web-user") return "112233";
        return undefined;
      });
      __setKeychainReaderForTesting(keychainReader);

      const creds = await getWebCredentials();
      expect(creds).toEqual({
        cookie: "keychain_cookie_val",
        userId: "112233",
      });
      expect(keychainReader).toHaveBeenCalledWith("external-api-web-cookie");
      expect(keychainReader).toHaveBeenCalledWith("external-api-web-user");
    });

    it("returns undefined when keychain has no cookie", async () => {
      const keychainReader = vi.fn().mockResolvedValue(undefined);
      __setKeychainReaderForTesting(keychainReader);

      const creds = await getWebCredentials();
      expect(creds).toBeUndefined();
    });
  });

  describe("getUpstreamToken", () => {
    it("in 'env' mode reads EXTERNAL_API_TOKEN without invoking keychain", async () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "env";
      process.env.EXTERNAL_API_TOKEN = ' "my_env_token" ';

      const keychainReader = vi.fn();
      __setKeychainReaderForTesting(keychainReader);

      const token = await getUpstreamToken();
      expect(token).toBe("my_env_token");
      expect(keychainReader).not.toHaveBeenCalled();
    });

    it("in 'env' mode throws MissingTokenError when EXTERNAL_API_TOKEN is missing", async () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "env";
      await expect(getUpstreamToken()).rejects.toThrow(MissingTokenError);
    });

    it("in 'keychain' mode reads from keychain service", async () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "keychain";
      const keychainReader = vi.fn().mockResolvedValue("keychain_token_secret");
      __setKeychainReaderForTesting(keychainReader);

      const token = await getUpstreamToken();
      expect(token).toBe("keychain_token_secret");
      expect(keychainReader).toHaveBeenCalledWith("external-api-token");
    });

    it("in 'keychain' mode throws MissingTokenError when keychain returns undefined", async () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "keychain";
      const keychainReader = vi.fn().mockResolvedValue(undefined);
      __setKeychainReaderForTesting(keychainReader);

      await expect(getUpstreamToken()).rejects.toThrow(MissingTokenError);
    });
  });

  describe("cache invalidation", () => {
    it("invalidates cache when invalidateCredentialCache() is called", async () => {
      process.env.EXTERNAL_API_SECRET_SOURCE = "env";
      process.env.EXTERNAL_API_WEB_COOKIE = "cookie_one";

      const first = await getWebCredentials();
      expect(first?.cookie).toBe("cookie_one");

      // Change env without cache invalidation
      process.env.EXTERNAL_API_WEB_COOKIE = "cookie_two";
      const cached = await getWebCredentials();
      expect(cached?.cookie).toBe("cookie_one");

      // Invalidate cache
      invalidateCredentialCache();
      const refetched = await getWebCredentials();
      expect(refetched?.cookie).toBe("cookie_two");
    });
  });
});
