import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/external-provider/[...path]/route";
import * as authConfig from "@/server/auth/config";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/server/auth/session";

import { clearProxyCache, getProxyCachedResponse, setProxyCachedResponse } from "../cache";
import { type CredentialIssue, onCredentialIssue, resetCredentialIssueHandlers } from "../credentials";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "../db";
import { injectUserId } from "../http";
import * as tokenModule from "../token";

describe("injectUserId", () => {
  it("injects userId into an object request body for /api/transaction/get", () => {
    const raw = new TextEncoder().encode(JSON.stringify({ skip: 0, take: 20 })).buffer;
    const modified = injectUserId(raw, "12345");
    const parsed = JSON.parse(new TextDecoder().decode(modified));
    expect(parsed).toEqual({ skip: 0, take: 20, userId: 12345 });
  });

  it("handles string non-numeric userId", () => {
    const raw = new TextEncoder().encode(JSON.stringify({ skip: 0 })).buffer;
    const modified = injectUserId(raw, "user_alpha");
    const parsed = JSON.parse(new TextDecoder().decode(modified));
    expect(parsed).toEqual({ skip: 0, userId: "user_alpha" });
  });

  it("passes through array bodies (such as /api/transaction/create) untouched", () => {
    const arrayBody = [{ id: "tx-1", sourceAmount: 100 }];
    const raw = new TextEncoder().encode(JSON.stringify(arrayBody)).buffer;
    const modified = injectUserId(raw, "12345");
    const parsed = JSON.parse(new TextDecoder().decode(modified));
    expect(parsed).toEqual(arrayBody);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("passes through empty or undefined userId untouched", () => {
    const raw = new TextEncoder().encode(JSON.stringify({ skip: 0 })).buffer;
    expect(injectUserId(raw, undefined)).toBe(raw);
    expect(injectUserId(raw, "")).toBe(raw);
  });
});

describe("Proxy Route write logging and request body isolation", () => {
  const originalFetch = globalThis.fetch;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearProxyCache();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(tokenModule, "getWebCredentials").mockResolvedValue({
      cookie: "session_secret_cookie_value_1234567890",
      userId: "998877",
    });
  });

  afterEach(() => {
    clearProxyCache();
    globalThis.fetch = originalFetch;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("does NOT mutate /api/transaction/create request body with userId and logs success", async () => {
    let capturedBodyText = "";

    globalThis.fetch = vi.fn().mockImplementation(async (_target: URL, init?: RequestInit) => {
      capturedBodyText = new TextDecoder().decode(init?.body as ArrayBuffer);
      return new Response(JSON.stringify({ isSuccess: true, data: { id: "tx-1" } }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
      });
    });

    const txArray = [{ id: "tx-1", sourceAmount: 100, destinationAmount: 100 }];
    const req = new NextRequest("http://localhost:3000/api/external-provider/api/transaction/create", {
      method: "POST",
      body: JSON.stringify(txArray),
      headers: {
        "content-type": "application/json",
      },
    });

    const context = { params: Promise.resolve({ path: ["api", "transaction", "create"] }) };
    const response = await POST(req, context);

    expect(response.status).toBe(200);
    expect(JSON.parse(capturedBodyText)).toEqual(txArray);
    expect(logSpy).toHaveBeenCalledWith("[External API Proxy] POST /api/transaction/create -> 200 OK");
  });

  it("logs scrubbed error when upstream fails with non-2xx status", async () => {
    const secretCookie = "session_secret_cookie_value_1234567890";
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ error: `Invalid request with cookie ${secretCookie}` }), {
        status: 400,
        statusText: "Bad Request",
        headers: { "content-type": "application/json" },
      });
    });

    const req = new NextRequest("http://localhost:3000/api/external-provider/api/transaction/create", {
      method: "POST",
      body: JSON.stringify([{ id: "tx-err" }]),
      headers: {
        "content-type": "application/json",
      },
    });

    const context = { params: Promise.resolve({ path: ["api", "transaction", "create"] }) };
    const response = await POST(req, context);

    expect(response.status).toBe(400);
    expect(errorSpy).toHaveBeenCalled();
    const loggedError = errorSpy.mock.calls[0][0] as string;
    expect(loggedError).toContain("[External API Proxy] POST /api/transaction/create -> 400");
    expect(loggedError).toContain("[redacted]");
    expect(loggedError).not.toContain(secretCookie);
  });

  it("invalidates /Exchange/Ping and /stat/ping proxy cache on isExchangeWritePayload category writes", async () => {
    const dummyBody = new Uint8Array([1, 2, 3]);
    setProxyCachedResponse("POST:/Exchange/Ping::h1", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });
    setProxyCachedResponse("GET:/stat/ping:?data=xyz:h2", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });
    setProxyCachedResponse("GET:/settings::h3", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ isSuccess: true, data: { items: [] } }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
      });
    });

    const categoryWriteBody = {
      items: [
        {
          key: 2,
          entityJson: JSON.stringify([{ id: "cat-1", name: "_Groceries", order: 5 }]),
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
      method: "POST",
      body: JSON.stringify(categoryWriteBody),
      headers: {
        "content-type": "application/json",
      },
    });

    const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
    const response = await POST(req, context);

    expect(response.status).toBe(200);
    expect(getProxyCachedResponse("POST:/Exchange/Ping::h1")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/stat/ping:?data=xyz:h2")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/settings::h3")).toBeDefined();
  });

  it("performs write-through upsert into ExternalProviderStore on /api/transaction/create and bumps sync_version", async () => {
    const store = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(store);

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ isSuccess: true, data: { id: "tx-new-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const txPayload = [{ id: "tx-new-1", sourceAmount: 250, timestamp: 99999 }];
    const req = new NextRequest("http://localhost:3000/api/external-provider/api/transaction/create", {
      method: "POST",
      body: JSON.stringify(txPayload),
      headers: { "content-type": "application/json" },
    });

    const context = { params: Promise.resolve({ path: ["api", "transaction", "create"] }) };
    const res = await POST(req, context);

    expect(res.status).toBe(200);

    const savedTxs = await store.getTransactions();
    expect(savedTxs).toHaveLength(1);
    expect(savedTxs[0].id).toBe("tx-new-1");

    const config = await store.getSyncConfig();
    expect(config.sync_version).toBe(1);
    expect(config.sync_status).toBe("reconciling");

    setTestExternalProviderStore(null);
  });

  it("performs write-through upsert into ExternalProviderStore on category reorder /Exchange/Ping", async () => {
    const store = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(store);

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ isSuccess: true, data: { items: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const categoryWriteBody = {
      items: [
        {
          key: 2,
          entityJson: JSON.stringify([{ id: "cat-written", name: "Groceries Reordered", order: 1 }]),
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
      method: "POST",
      body: JSON.stringify(categoryWriteBody),
      headers: { "content-type": "application/json" },
    });

    const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
    const res = await POST(req, context);

    expect(res.status).toBe(200);

    const savedCats = await store.getCategories(true);
    expect(savedCats).toHaveLength(1);
    expect(savedCats[0].id).toBe("cat-written");

    const config = await store.getSyncConfig();
    expect(config.sync_version).toBe(1);
    expect(config.sync_status).toBe("reconciling");

    setTestExternalProviderStore(null);
  });

  describe("defense-in-depth auth enforcement", () => {
    it("rejects unauthenticated request with 401 when bypass is inactive without resolving credentials", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      const getWebCredsSpy = vi.spyOn(tokenModule, "getWebCredentials");

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.message).toBe("Unauthorized");
      expect(getWebCredsSpy).not.toHaveBeenCalled();
    });

    it("allows request when valid session cookie is present and bypass is inactive", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
      process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-abc";
      process.env.ALLOWED_USER_EMAILS = "family@example.com";

      const token = await createSessionToken({ email: "family@example.com" }, { secret: process.env.AUTH_SECRET });

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ isSuccess: true, data: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(200);
    });
  });

  describe("credential source handling and alert notifications", () => {
    let issueSpy = vi.fn<(issue: CredentialIssue) => void>();
    let unsubscribeIssue: () => void;

    beforeEach(() => {
      resetCredentialIssueHandlers();
      issueSpy = vi.fn<(issue: CredentialIssue) => void>();
      unsubscribeIssue = onCredentialIssue(issueSpy);
    });

    afterEach(() => {
      unsubscribeIssue();
      resetCredentialIssueHandlers();
    });

    it("returns 503 and triggers 'missing' notification when credentials cannot be resolved", async () => {
      vi.spyOn(tokenModule, "getWebCredentials").mockResolvedValue(undefined);
      vi.spyOn(tokenModule, "getUpstreamToken").mockRejectedValue(new tokenModule.MissingTokenError("env"));
      vi.spyOn(tokenModule, "getExternalProviderSecretSource").mockReturnValue("env");

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(503);
      expect(issueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "missing",
          source: "env",
          status: 503,
          upstreamPath: "/Exchange/Ping",
        }),
      );
    });

    it("returns 503 when EXTERNAL_API_SECRET_SOURCE is invalid", async () => {
      vi.spyOn(tokenModule, "getExternalProviderSecretSource").mockImplementation(() => {
        throw new tokenModule.InvalidSecretSourceError("unknown_source");
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error.message).toContain('Invalid EXTERNAL_API_SECRET_SOURCE "unknown_source"');
    });

    it("detects 401 stale credentials, notifies issue handler, invalidates cache, and scrubs secrets", async () => {
      const invalidateSpy = vi.spyOn(tokenModule, "invalidateCredentialCache");
      const secretEnvCookie = "super_secret_cookie_998877";
      process.env.EXTERNAL_API_WEB_COOKIE = secretEnvCookie;

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ error: `Unauthorized with cookie ${secretEnvCookie}` }), {
          status: 401,
          statusText: "Unauthorized",
          headers: { "content-type": "application/json" },
        });
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("stale_credentials");
      expect(data.error.detail).toContain("[redacted]");
      expect(data.error.detail).not.toContain(secretEnvCookie);
      expect(invalidateSpy).toHaveBeenCalled();
      expect(issueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "stale",
          status: 401,
          upstreamPath: "/Exchange/Ping",
        }),
      );
    });

    it("detects HTML login page payload (200 text/html) as stale credentials", async () => {
      const invalidateSpy = vi.spyOn(tokenModule, "invalidateCredentialCache");

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response("<!DOCTYPE html><html><body><form action='/login'>Login</form></body></html>", {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("stale_credentials");
      expect(invalidateSpy).toHaveBeenCalled();
      expect(issueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "stale",
          status: 401,
          upstreamPath: "/Exchange/Ping",
        }),
      );
    });

    it("detects unexpected redirect errors as stale credentials", async () => {
      const invalidateSpy = vi.spyOn(tokenModule, "invalidateCredentialCache");

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch: unexpected redirect"));

      const req = new NextRequest("http://localhost:3000/api/external-provider/Exchange/Ping", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      });
      const context = { params: Promise.resolve({ path: ["Exchange", "Ping"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("stale_credentials");
      expect(invalidateSpy).toHaveBeenCalled();
      expect(issueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "stale",
          status: 401,
          upstreamPath: "/Exchange/Ping",
        }),
      );
    });
  });

  describe("when EXTERNAL_API_ADAPTER='mock'", () => {
    let mockStore: LocalFileExternalProviderStore;

    beforeEach(() => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
      mockStore = new LocalFileExternalProviderStore({ inMemory: true });
      setTestExternalProviderStore(mockStore);
    });

    afterEach(() => {
      setTestExternalProviderStore(null);
    });

    it("serves GET /settings/get without calling upstream fetch or credentials", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const getWebCredsSpy = vi.spyOn(tokenModule, "getWebCredentials");

      const req = new NextRequest("http://localhost:3000/api/external-provider/settings/get", {
        method: "GET",
      });
      const context = { params: Promise.resolve({ path: ["settings", "get"] }) };
      const response = await GET(req, context);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.isSuccess).toBe(true);
      expect(json.data.userId).toBe("mock-user-e2e");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getWebCredsSpy).not.toHaveBeenCalled();
    });

    it("serves POST /api/transaction/create and updates mock store", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const newTx = {
        id: "tx-proxy-mock-1",
        sourceId: "cat-acc-main",
        sourceAmount: 150,
        destinationId: "cat-exp-groceries",
        destinationAmount: 150,
      };

      const req = new NextRequest("http://localhost:3000/api/external-provider/api/transaction/create", {
        method: "POST",
        body: JSON.stringify([newTx]),
        headers: { "content-type": "application/json" },
      });
      const context = { params: Promise.resolve({ path: ["api", "transaction", "create"] }) };
      const response = await POST(req, context);

      expect(response.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();

      const txs = await mockStore.getTransactions();
      expect(txs.some((t) => t.id === "tx-proxy-mock-1")).toBe(true);
    });

    it("fails closed with 503 if EXTERNAL_API_ADAPTER is invalid", async () => {
      process.env.EXTERNAL_API_ADAPTER = "invalid_adapter";

      const req = new NextRequest("http://localhost:3000/api/external-provider/settings/get", {
        method: "GET",
      });
      const context = { params: Promise.resolve({ path: ["settings", "get"] }) };
      const response = await GET(req, context);

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error.message).toContain('Invalid EXTERNAL_API_ADAPTER: "invalid_adapter"');
    });
  });
});
