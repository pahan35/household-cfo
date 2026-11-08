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
  filterTransactionsLocally,
  getBudgetSelection,
  getCategories,
  getCurrencies,
  getExternalProviderClientCacheEntry,
  getSettings,
  getTransactionPage,
  hydrateClientFromIDB,
  invalidateExternalProviderClientCache,
  reorderIncomeCategories,
  resetClientState,
  setClientSnapshot,
  setExternalProviderClientCacheEntry,
  syncClientWithServer,
  unarchiveIncomeSource,
  updateCategoriesOrder,
  updateTransaction,
  updateTransactionTags,
} from "../external-provider-client";
import {
  CategoryType,
  ExchangeKey,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
} from "../external-provider-data";
import {
  clearIDB,
  type ExternalProviderSnapshot,
  loadSnapshotFromIDB,
  saveSnapshotToIDB,
} from "../external-provider-idb";

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

  it("purges entries starting with stat: from client cache upon category update", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isSuccess: true, data: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    setExternalProviderClientCacheEntry("stat:2026-10-01", { dummy: "stat-data" });
    setExternalProviderClientCacheEntry("stat:2026-09-01", { dummy: "stat-data-prev" });
    setExternalProviderClientCacheEntry("unrelated-key", { dummy: "preserved" });

    expect(getExternalProviderClientCacheEntry("stat:2026-10-01")).toBeDefined();
    expect(getExternalProviderClientCacheEntry("stat:2026-09-01")).toBeDefined();
    expect(getExternalProviderClientCacheEntry("unrelated-key")).toBeDefined();

    await updateCategoriesOrder([{ id: "cat-1", name: "_Groceries", categoryType: CategoryType.Expense, order: 10 }]);

    expect(getExternalProviderClientCacheEntry("stat:2026-10-01")).toBeUndefined();
    expect(getExternalProviderClientCacheEntry("stat:2026-09-01")).toBeUndefined();
    expect(getExternalProviderClientCacheEntry("unrelated-key")).toBeDefined();
  });

  it("createTransaction POSTs an array payload [tx] to /api/external-provider/api/transaction/create and invalidates client cache", async () => {
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
    expect(capturedBody).toEqual([txPayload]);
  });

  it("surfaces upstream error message and detail when API request fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "Upstream request failed with 400 Bad Request",
            detail: '{"error":"Invalid ticks"}',
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    await expect(createTransaction({ id: "tx-fail", sourceAmount: 100, destinationAmount: 100 })).rejects.toThrow(
      'Upstream request failed with 400 Bad Request: {"error":"Invalid ticks"}',
    );
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

describe("Category Write Proxy Invalidation", () => {
  beforeEach(() => {
    clearProxyCache();
  });

  afterEach(() => {
    clearProxyCache();
  });

  it("invalidates /Exchange/Ping and /stat/ping upon category write", () => {
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

    invalidateProxyCacheByPathPrefix("/Exchange/Ping");
    invalidateProxyCacheByPathPrefix("/stat/ping");

    expect(getProxyCachedResponse("POST:/Exchange/Ping::h1")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/stat/ping:?data=xyz:h2")).toBeUndefined();
    expect(getProxyCachedResponse("GET:/settings::h3")).toBeDefined();
  });
});

describe("IndexedDB hydration & Unified Local Ledger (external-provider-client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    resetClientState();
    await clearIDB();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    resetClientState();
    await clearIDB();
    vi.restoreAllMocks();
  });

  const mockSnapshot: ExternalProviderSnapshot = {
    syncConfig: {
      id: "default",
      sync_version: 3,
      sync_status: "idle",
      last_synced_at: "2026-11-06T12:00:00Z",
      last_warm_reconcile_at: "2026-11-06T12:00:00Z",
      last_full_reconcile_at: "2026-11-06T12:00:00Z",
      last_cron_run_at: null,
      last_error: null,
      watermark_tx_ticks: 99999,
      hot_pull_months: 3,
      auto_poll_interval_minutes: 0,
      settings_json: { language: "en", defaultCurrency: "c-pln" },
      currencies_json: [{ id: "c-pln", name: "PLN", symbol: "zł" }],
      updated_at: "2026-11-06T12:00:00Z",
    },
    settings: { language: "en", defaultCurrency: "c-pln" },
    currencies: [{ id: "c-pln", name: "PLN", symbol: "zł" }],
    categories: [
      { id: "cat-groceries", name: "Groceries", categoryType: CategoryType.Expense, order: 0 },
      { id: "acc-bank", name: "Bank Account", categoryType: CategoryType.Account, order: 1 },
    ],
    transactions: [
      {
        id: "tx-1",
        dateTimestamp: new Date("2026-11-05T10:00:00Z").getTime(),
        dateTimestampISO: "2026-11-05T10:00:00Z",
        sourceId: "acc-bank",
        destinationId: "cat-groceries",
        sourceAmount: 150,
        destinationAmount: 150,
      },
      {
        id: "tx-2",
        dateTimestamp: new Date("2026-10-15T10:00:00Z").getTime(),
        dateTimestampISO: "2026-10-15T10:00:00Z",
        sourceId: "acc-bank",
        destinationId: "cat-groceries",
        sourceAmount: 200,
        destinationAmount: 200,
      },
      {
        id: "tx-3",
        dateTimestamp: new Date("2026-09-01T10:00:00Z").getTime(),
        dateTimestampISO: "2026-09-01T10:00:00Z",
        sourceId: "acc-bank",
        destinationId: "cat-groceries",
        sourceAmount: 300,
        destinationAmount: 300,
      },
    ],
    statPoints: [
      { id: "sp-2026-11", date: "2026-11-01", categories: [] },
      { id: "sp-2026-10", date: "2026-10-01", categories: [] },
    ],
  };

  it("hydrates from IDB and serves getSettings, getCategories, and getCurrencies without fetch calls", async () => {
    await saveSnapshotToIDB(mockSnapshot);
    const hydrated = await hydrateClientFromIDB();
    expect(hydrated?.syncConfig.sync_version).toBe(3);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const settings = await getSettings();
    const categories = await getCategories();
    const currencies = await getCurrencies();
    const budgetSelection = await getBudgetSelection({ from: "2026-11-01" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(settings.defaultCurrency).toBe("c-pln");
    expect(categories).toHaveLength(2);
    expect(currencies).toHaveLength(1);
    expect(budgetSelection.selection?.points).toHaveLength(2);
  });

  it("getTransactionPage filters transactions locally from unified ledger", async () => {
    setClientSnapshot(mockSnapshot);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const directFiltered = filterTransactionsLocally(mockSnapshot.transactions, { take: 1 });
    expect(directFiltered.transactions).toHaveLength(1);

    // Filter by period
    const novPage = await getTransactionPage({
      period: { from: "2026-11-01", to: "2026-11-30" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(novPage.transactions).toHaveLength(1);
    expect(novPage.transactions?.[0].id).toBe("tx-1");

    // Filter by categoryIds
    const catPage = await getTransactionPage({
      categoryIds: ["cat-groceries"],
      take: 2,
    });
    expect(catPage.transactions).toHaveLength(2);
    expect(catPage.hasMoreData).toBe(true);

    // Pagination
    const page2 = await getTransactionPage({
      categoryIds: ["cat-groceries"],
      skip: 2,
      take: 2,
    });
    expect(page2.transactions).toHaveLength(1);
    expect(page2.transactions?.[0].id).toBe("tx-3");
    expect(page2.hasMoreData).toBe(false);
  });

  it("createTransaction and updateTransaction perform optimistic write-through into local snapshot", async () => {
    setClientSnapshot(mockSnapshot);

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/transaction/create") || urlStr.includes("/api/transaction/update")) {
        return new Response(JSON.stringify({ isSuccess: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const newTx: ExternalProviderTransaction = {
      id: "tx-brand-new",
      dateTimestamp: Date.now(),
      sourceId: "acc-bank",
      destinationId: "cat-groceries",
      sourceAmount: 99,
    };

    await createTransaction(newTx);

    // Verify local snapshot contains newTx immediately
    const localPage = await getTransactionPage({ take: 10 });
    expect(localPage.transactions?.find((t) => t.id === "tx-brand-new")).toBeDefined();

    // Verify updateTransaction updates local snapshot in place
    await updateTransaction({ ...newTx, sourceAmount: 149 });
    const updatedPage = await getTransactionPage({ take: 10 });
    const found = updatedPage.transactions?.find((t) => t.id === "tx-brand-new");
    expect(found?.sourceAmount).toBe(149);
  });

  it("syncClientWithServer handles lightweight upToDate confirmation and full snapshot bootstrap", async () => {
    setClientSnapshot(mockSnapshot);

    // 1. Lightweight upToDate confirmation
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          upToDate: true,
          syncVersion: 3,
          syncConfig: mockSnapshot.syncConfig,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const syncRes1 = await syncClientWithServer();
    expect(syncRes1.upToDate).toBe(true);
    expect(syncRes1.syncVersion).toBe(3);

    // 2. Updated snapshot from server
    const updatedSnapshot: ExternalProviderSnapshot = {
      ...mockSnapshot,
      syncConfig: { ...mockSnapshot.syncConfig, sync_version: 4 },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          upToDate: false,
          syncVersion: 4,
          snapshot: updatedSnapshot,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const syncRes2 = await syncClientWithServer();
    expect(syncRes2.upToDate).toBe(false);
    expect(syncRes2.syncVersion).toBe(4);
    expect(await loadSnapshotFromIDB()).toEqual(updatedSnapshot);
  });
});
