import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sanitizeLogValue, serverLogger } from "../logger";

describe("serverLogger & sanitizeLogValue", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Mock console implementation
    });
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Mock console implementation
    });
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      // Mock console implementation
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive keys in objects", () => {
    const input = {
      username: "user123",
      token: "secret_token_abc",
      api_key: "api_key_xyz",
      cookie: "session_id=123",
      authorization: "Bearer eyJ...",
      nested: {
        password: "pAssword123!",
        userSecret: "super-secret",
        safeValue: 42,
      },
    };

    const sanitized = sanitizeLogValue(input) as Record<string, unknown>;
    expect(sanitized.username).toBe("user123");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.api_key).toBe("[REDACTED]");
    expect(sanitized.cookie).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.password).toBe("[REDACTED]");
    expect(nested.userSecret).toBe("[REDACTED]");
    expect(nested.safeValue).toBe(42);
  });

  it("scrubs Bearer tokens and cookies embedded in string messages", () => {
    const message = "Request failed with Authorization: Bearer abc123secret and Cookie: session=xyz";
    const sanitized = sanitizeLogValue(message);
    expect(sanitized).toBe("Request failed with Authorization: Bearer [REDACTED] and Cookie: [REDACTED]");
  });

  it("handles circular references gracefully", () => {
    const circular: Record<string, unknown> = { name: "test" };
    circular.self = circular;

    const sanitized = sanitizeLogValue(circular) as Record<string, unknown>;
    expect(sanitized.name).toBe("test");
    expect(sanitized.self).toBe("[Circular]");
  });

  it("safely serializes Error objects without exposing secrets in error message", () => {
    const error = new Error("Connection failed with Bearer secret-value-123");
    const sanitized = sanitizeLogValue(error) as { name: string; message: string };
    expect(sanitized.name).toBe("Error");
    expect(sanitized.message).toBe("Connection failed with Bearer [REDACTED]");
  });

  it("logs structured JSON to console.error when VERCEL is '1'", () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = "1";
      serverLogger.error("Sync test error", { tier: "hot", token: "sensitive-token" });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedStr = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(loggedStr);

      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("Sync test error");
      expect(parsed.context.tier).toBe("hot");
      expect(parsed.context.token).toBe("[REDACTED]");
    } finally {
      process.env.VERCEL = origVercel;
    }
  });

  it("logs warnings and info properly", () => {
    serverLogger.warn("Warning test", { key: "value" });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

    serverLogger.info("Info test", { status: "ok" });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
  });
});
