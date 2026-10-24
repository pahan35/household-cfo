import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clearProxyCache,
  getProxyCachedResponse,
  invalidateProxyCacheByPathPrefix,
  setProxyCachedResponse,
} from "@/server/external-provider/cache";

import {
  getExternalProviderClientCacheEntry,
  invalidateExternalProviderClientCache,
  updateCategoriesOrder,
} from "../external-provider-client";
import { CategoryType, type ExternalProviderCategory, ExchangeKey } from "../external-provider-data";

describe("Proxy Cache Invalidation (invalidateProxyCacheByPathPrefix)", () => {
  beforeEach(() => {
    clearProxyCache();
  });

  afterEach(() => {
    clearProxyCache();
  });

  it("invalidates cached entries matching the path prefix while preserving unrelated entries", () => {
    const dummyBody = new Uint8Array([1, 2, 3]);

    // Seed mock entries
    setProxyCachedResponse("POST:/Exchange/Ping::hash1", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("POST:/Exchange/Ping:?foo=bar:hash2", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("GET:/stat/ping:?data=xyz:hash3", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("GET:/api/transaction/get::hash4", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    // Invalidate /Exchange/Ping
    invalidateProxyCacheByPathPrefix("/Exchange/Ping");

    expect(getProxyCachedResponse("POST:/Exchange/Ping::hash1")).toBeUndefined();
    expect(getProxyCachedResponse("POST:/Exchange/Ping:?foo=bar:hash2")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/stat/ping:?data=xyz:hash3")).toBeDefined();
    expect(getProxyCachedResponse("GET:/api/transaction/get::hash4")).toBeDefined();
  });
});

describe("Client updateCategoriesOrder", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    invalidateExternalProviderClientCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    invalidateExternalProviderClientCache();
    vi.restoreAllMocks();
  });

  it("sends POST /api/external-provider/Exchange/Ping with double-encoded entityJson and updates client cache", async () => {
    const modifiedCategories: ExternalProviderCategory[] = [
      { id: "cat-1", name: "Groceries", categoryType: CategoryType.Expense, order: 0 },
      { id: "cat-2", name: "Transport", categoryType: CategoryType.Expense, order: 1 },
    ];

    const allCategories: ExternalProviderCategory[] = [
      ...modifiedCategories,
      { id: "cat-3", name: "Rent", categoryType: CategoryType.Expense, order: 2 },
    ];

    let interceptedRequest: { url: string; method: string; headers: Headers; body: unknown } | null = null;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(init.body as string) : null;
      interceptedRequest = { url, method: init?.method ?? "GET", headers, body };

      return new Response(
        JSON.stringify({
          isSuccess: true,
          data: {
            items: [
              {
                key: ExchangeKey.Category,
                entityJson: JSON.stringify(modifiedCategories),
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const result = await updateCategoriesOrder(modifiedCategories, {
      allUpdatedCategories: allCategories,
    });

    expect(result.isSuccess).toBe(true);
    expect(interceptedRequest).not.toBeNull();
    if (!interceptedRequest) {
      throw new Error("Request was not intercepted");
    }
    const captured = interceptedRequest as {
      url: string;
      method: string;
      headers: Headers;
      body: { items: Array<{ key: number; entityJson: string }> };
    };
    expect(captured.url).toBe("/api/external-provider/Exchange/Ping");
    expect(captured.method).toBe("POST");
    expect(captured.headers.get("cache-control")).toBe("no-cache");

    // Payload verification
    const requestPayload = captured.body;
    expect(requestPayload.items).toHaveLength(1);
    expect(requestPayload.items[0].key).toBe(ExchangeKey.Category);
    expect(JSON.parse(requestPayload.items[0].entityJson)).toEqual(modifiedCategories);

    // Verify client cache was populated with allUpdatedCategories
    const cached = getExternalProviderClientCacheEntry<ExternalProviderCategory[]>("categories");
    expect(cached).toEqual(allCategories);
  });

  it("invalidates client categories cache when allUpdatedCategories is not supplied", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isSuccess: true, data: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateCategoriesOrder([{ id: "cat-1", name: "Groceries", categoryType: CategoryType.Expense, order: 5 }]);

    const cached = getExternalProviderClientCacheEntry<ExternalProviderCategory[]>("categories");
    expect(cached).toBeUndefined();
  });
});
