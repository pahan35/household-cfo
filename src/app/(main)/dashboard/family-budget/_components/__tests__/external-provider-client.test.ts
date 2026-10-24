import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clearProxyCache,
  getProxyCachedResponse,
  invalidateProxyCacheByPathPrefix,
  setProxyCachedResponse,
} from "@/server/external-provider/cache";

import {
  archiveIncomeSource,
  createTransaction,
  getExternalProviderClientCacheEntry,
  invalidateExternalProviderClientCache,
  reorderIncomeCategories,
  unarchiveIncomeSource,
  updateCategoriesOrder,
  updateTransactionTags,
} from "../external-provider-client";
import { CategoryType, type ExternalProviderCategory, type ExternalProviderTransaction, ExchangeKey } from "../external-provider-data";

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

  it("createTransaction POSTs to /api/external-provider/api/transaction/create and invalidates client cache", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Headers | undefined;
    let capturedBody: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedMethod = init?.method ?? "GET";
      capturedHeaders = new Headers(init?.headers);
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;

      return new Response(JSON.stringify({ isSuccess: true, data: { id: "tx-created-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const txPayload: ExternalProviderTransaction = {
      id: "tx-created-1",
      sourceId: "src-1",
      destinationId: "dest-1",
      sourceAmount: 100,
      destinationAmount: 100,
    };

    const result = await createTransaction(txPayload);

    expect(result.isSuccess).toBe(true);
    expect(capturedUrl).toBe("/api/external-provider/api/transaction/create");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders?.get("cache-control")).toBe("no-cache");
    expect(capturedBody).toEqual(txPayload);
  });

  it("updateTransaction and updateTransactionTags POST to /api/external-provider/api/transaction/update and invalidate cache", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Headers | undefined;
    let capturedBody: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedMethod = init?.method ?? "GET";
      capturedHeaders = new Headers(init?.headers);
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;

      return new Response(JSON.stringify({ isSuccess: true, data: { id: "tx-updated-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const txPayload: ExternalProviderTransaction = {
      id: "tx-updated-1",
      destinationId: "cat-tax-pln",
      destinationAmount: 500,
      tags: [],
    };

    const result = await updateTransactionTags(txPayload, ["#pit"]);

    expect(result.isSuccess).toBe(true);
    expect(capturedUrl).toBe("/api/external-provider/api/transaction/update");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders?.get("cache-control")).toBe("no-cache");
    expect(capturedBody).toEqual({ ...txPayload, tags: ["#pit"] });
  });

  it("reorderIncomeCategories, archiveIncomeSource, and unarchiveIncomeSource wire through updateCategoriesOrder", async () => {
    const incomeCategories: ExternalProviderCategory[] = [
      { id: "inc-1", name: "Salary", categoryType: CategoryType.Income, order: 0 },
      { id: "inc-2", name: "Dividends", categoryType: CategoryType.Income, order: 1 },
      { id: "inc-3", name: "_Old", categoryType: CategoryType.Income, order: 2 },
    ];

    let capturedPingPayload: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedPingPayload = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ isSuccess: true, data: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    // 1. Reorder
    await reorderIncomeCategories(incomeCategories, ["inc-2", "inc-1"]);
    expect(capturedPingPayload).not.toBeNull();
    const cachedAfterReorder = getExternalProviderClientCacheEntry<ExternalProviderCategory[]>("categories");
    expect(cachedAfterReorder?.find((c) => c.id === "inc-2")?.order).toBe(0);

    // 2. Archive
    await archiveIncomeSource(incomeCategories, "inc-1");
    const cachedAfterArchive = getExternalProviderClientCacheEntry<ExternalProviderCategory[]>("categories");
    const archived = cachedAfterArchive?.find((c) => c.id === "inc-1");
    expect(archived?.name).toBe("_Salary");
    expect(archived?.order).toBe(2);

    // 3. Unarchive
    await unarchiveIncomeSource(cachedAfterArchive ?? incomeCategories, "inc-1");
    const cachedAfterUnarchive = getExternalProviderClientCacheEntry<ExternalProviderCategory[]>("categories");
    const unarchived = cachedAfterUnarchive?.find((c) => c.id === "inc-1");
    expect(unarchived?.name).toBe("Salary");
  });
});

describe("Transaction Write Proxy Invalidation", () => {
  beforeEach(() => {
    clearProxyCache();
  });

  afterEach(() => {
    clearProxyCache();
  });

  it("invalidates /api/transaction, /Exchange/Ping, and /stat/ping upon transaction write", () => {
    const dummyBody = new Uint8Array([1, 2, 3]);

    setProxyCachedResponse("POST:/api/transaction/get::h1", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("POST:/Exchange/Ping::h2", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("GET:/stat/ping:?data=xyz:h3", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    setProxyCachedResponse("GET:/settings::h4", {
      status: 200,
      headers: [["content-type", "application/json"]],
      body: dummyBody,
    });

    invalidateProxyCacheByPathPrefix("/api/transaction");
    invalidateProxyCacheByPathPrefix("/Exchange/Ping");
    invalidateProxyCacheByPathPrefix("/stat/ping");

    expect(getProxyCachedResponse("POST:/api/transaction/get::h1")).toBeUndefined();
    expect(getProxyCachedResponse("POST:/Exchange/Ping::h2")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/stat/ping:?data=xyz:h3")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/settings::h4")).toBeDefined();
  });
});
