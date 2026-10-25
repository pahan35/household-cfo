import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { POST } from "@/app/api/external-provider/[...path]/route";

import { clearProxyCache, getProxyCachedResponse, setProxyCachedResponse } from "../cache";
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
});
