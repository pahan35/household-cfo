import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type {
  ExternalProviderCategory,
  ExternalProviderTransaction,
  StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import {
  DEFAULT_SYNC_CONFIG,
  getExternalProviderStore,
  LocalFileExternalProviderStore,
  SupabaseRestExternalProviderStore,
  setTestExternalProviderStore,
} from "../db";

describe("LocalFileExternalProviderStore (in-memory mode)", () => {
  let store: LocalFileExternalProviderStore;

  beforeEach(() => {
    store = new LocalFileExternalProviderStore({ inMemory: true });
  });

  it("initializes with default sync config", async () => {
    const config = await store.getSyncConfig();
    expect(config.id).toBe("default");
    expect(config.sync_version).toBe(0);
    expect(config.sync_status).toBe("idle");
    expect(config.hot_pull_months).toBe(3);
    expect(config.auto_poll_interval_minutes).toBe(0);
  });

  it("updates and persists sync config fields", async () => {
    const updated = await store.updateSyncConfig({
      sync_version: 5,
      sync_status: "syncing",
      hot_pull_months: 6,
    });
    expect(updated.sync_version).toBe(5);
    expect(updated.sync_status).toBe("syncing");
    expect(updated.hot_pull_months).toBe(6);

    const retrieved = await store.getSyncConfig();
    expect(retrieved.sync_version).toBe(5);
  });

  it("upserts and queries categories with sorting and deleted flag filtering", async () => {
    const cat1: ExternalProviderCategory = {
      id: "cat-1",
      name: "Food",
      categoryType: 3,
      amount: 50,
      order: 2,
      deleted: false,
    };
    const cat2: ExternalProviderCategory = {
      id: "cat-2",
      name: "Salary",
      categoryType: 1,
      amount: 5000,
      order: 1,
      deleted: false,
    };
    const catDeleted: ExternalProviderCategory = {
      id: "cat-3",
      name: "Old Debt",
      categoryType: 5,
      amount: 0,
      order: 0,
      deleted: true,
    };

    await store.upsertCategories([cat1, cat2, catDeleted]);

    // Excludes deleted by default, sorted by order ascending
    const active = await store.getCategories(false);
    expect(active.map((c) => c.id)).toEqual(["cat-2", "cat-1"]);

    // Includes deleted when requested
    const all = await store.getCategories(true);
    expect(all.map((c) => c.id)).toEqual(["cat-3", "cat-2", "cat-1"]);

    // Atomic update
    await store.upsertCategories([{ ...cat1, amount: 150 }]);
    const refetched = await store.getCategories(false);
    expect(refetched.find((c) => c.id === "cat-1")?.amount).toBe(150);
  });

  it("saves and retrieves currencies and settings", async () => {
    const currencies = [{ id: "c-1", name: "PLN", symbol: "zł" }];
    const settings = { defaultCurrency: "c-1", language: "en" };

    await store.saveCurrencies(currencies);
    await store.saveSettings(settings);

    expect(await store.getCurrencies()).toEqual(currencies);
    expect(await store.getSettings()).toEqual(settings);
  });

  it("upserts and filters transactions by ticks, date ranges, and pagination", async () => {
    const tx1: ExternalProviderTransaction = {
      id: "tx-1",
      dateTimestamp: 1000,
      timestamp: 50000,
      sourceAmount: 10,
    };
    const tx2: ExternalProviderTransaction = {
      id: "tx-2",
      dateTimestamp: 2000,
      timestamp: 60000,
      sourceAmount: 20,
    };
    const tx3: ExternalProviderTransaction = {
      id: "tx-3",
      dateTimestamp: 3000,
      timestamp: 70000,
      sourceAmount: 30,
    };

    await store.upsertTransactions([tx1, tx2, tx3]);

    // All transactions sorted descending by dateTimestamp
    const all = await store.getTransactions();
    expect(all.map((t) => t.id)).toEqual(["tx-3", "tx-2", "tx-1"]);

    // sinceTicks filter
    const newer = await store.getTransactions({ sinceTicks: 55000 });
    expect(newer.map((t) => t.id)).toEqual(["tx-3", "tx-2"]);

    // fromDate / toDate window
    const windowed = await store.getTransactions({ fromDate: 1500, toDate: 2500 });
    expect(windowed.map((t) => t.id)).toEqual(["tx-2"]);

    // Pagination limit & offset
    const page = await store.getTransactions({ offset: 1, limit: 1 });
    expect(page.map((t) => t.id)).toEqual(["tx-2"]);
  });

  it("upserts and queries monthly stat points", async () => {
    const p1: StatPoint = { id: "sp-1", date: "2026-10-01", categories: [] };
    const p2: StatPoint = { id: "sp-2", date: "2026-11-01", categories: [] };

    await store.upsertStatPoints([
      { monthKey: "2026-10-01", point: p1 },
      { monthKey: "2026-11-01", point: p2 },
    ]);

    const all = await store.getStatPoints();
    expect(all).toHaveLength(2);

    const filtered = await store.getStatPoints(["2026-11-01"]);
    expect(filtered).toEqual([p2]);
  });

  it("aggregates full snapshot and resets store", async () => {
    await store.updateSyncConfig({ sync_version: 3 });
    await store.upsertCategories([{ id: "c1", name: "Cat", categoryType: 3 }]);
    await store.upsertTransactions([{ id: "t1", dateTimestamp: 100 }]);

    const snapshot = await store.getFullSnapshot();
    expect(snapshot.syncConfig.sync_version).toBe(3);
    expect(snapshot.categories).toHaveLength(1);
    expect(snapshot.transactions).toHaveLength(1);

    await store.resetStore();
    const fresh = await store.getFullSnapshot();
    expect(fresh.syncConfig.sync_version).toBe(0);
    expect(fresh.categories).toHaveLength(0);
    expect(fresh.transactions).toHaveLength(0);
  });
});

describe("SupabaseRestExternalProviderStore", () => {
  const originalFetch = globalThis.fetch;
  let store: SupabaseRestExternalProviderStore;

  beforeEach(() => {
    store = new SupabaseRestExternalProviderStore("https://example.supabase.co", "test-service-key");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches sync config row or creates default on empty result", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "default", sync_version: 12, hot_pull_months: 6 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const config = await store.getSyncConfig();
    expect(config.sync_version).toBe(12);
    expect(config.hot_pull_months).toBe(6);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/ext_sync_config?id=eq.default&select=*",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "test-service-key",
          Authorization: "Bearer test-service-key",
        }),
      }),
    );
  });

  it("sends merge-duplicates header on categories and transactions upsert", async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = init?.body as string;
      return new Response(JSON.stringify([]), { status: 201 });
    });

    await store.upsertCategories([{ id: "cat-1", name: "Groceries", categoryType: 3, order: 1 }]);

    expect(capturedHeaders["Prefer"]).toBe("resolution=merge-duplicates");
    const parsed = JSON.parse(capturedBody);
    expect(parsed[0].id).toBe("cat-1");
    expect(parsed[0].name).toBe("Groceries");
  });
});

describe("getExternalProviderStore factory", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    setTestExternalProviderStore(null);
  });

  it("returns SupabaseRestExternalProviderStore when credentials are present", () => {
    process.env.SUPABASE_URL = "https://my-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-123";

    setTestExternalProviderStore(null);
    const store = getExternalProviderStore();
    expect(store).toBeInstanceOf(SupabaseRestExternalProviderStore);
  });

  it("returns LocalFileExternalProviderStore when credentials are absent", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    setTestExternalProviderStore(null);
    const store = getExternalProviderStore();
    expect(store).toBeInstanceOf(LocalFileExternalProviderStore);
  });

  it("respects setTestExternalProviderStore override", () => {
    const customStore = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(customStore);
    expect(getExternalProviderStore()).toBe(customStore);
  });
});
