import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CategoryType, ExchangeKey } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "../db";
import { fetchFromExternalProvider, runExternalProviderSync } from "../sync";
import * as tokenModule from "../token";

describe("runExternalProviderSync", () => {
  let store: LocalFileExternalProviderStore;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    store = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(store);

    vi.spyOn(tokenModule, "getWebCredentials").mockResolvedValue({
      cookie: "mock_session_cookie",
      userId: "12345",
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setTestExternalProviderStore(null);
    vi.restoreAllMocks();
  });

  function createMockFetch(overrides?: {
    categories?: unknown[];
    currencies?: unknown[];
    transactions?: unknown[];
    hasMore?: boolean;
    statPoints?: unknown[];
  }) {
    const cats = overrides?.categories ?? [
      { id: "cat-1", name: "Food", categoryType: CategoryType.Expense, amount: 100, order: 1 },
      { id: "acc-1", name: "Bank", categoryType: CategoryType.Account, amount: 5000, order: 2 },
    ];
    const curs = overrides?.currencies ?? [{ id: "cur-1", name: "PLN", symbol: "zł" }];
    const txs = overrides?.transactions ?? [
      { id: "tx-1", dateTimestamp: Date.now() - 1000, timestamp: 100, sourceAmount: 50 },
    ];
    const statPoints = overrides?.statPoints ?? [{ id: "sp-1", date: "2026-11-01", categories: [] }];

    function parseBody(body: unknown): any {
      if (!body) return undefined;
      if (typeof body === "string") return JSON.parse(body);
      if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
        return JSON.parse(new TextDecoder().decode(body));
      }
      return body;
    }

    return vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.endsWith("/Exchange/Ping")) {
        const body = parseBody(init?.body);
        expect(body.items).toEqual([
          { key: ExchangeKey.Category, entityJson: null },
          { key: ExchangeKey.Currency, entityJson: null },
        ]);
        return new Response(
          JSON.stringify({
            isSuccess: true,
            data: {
              items: [
                { key: ExchangeKey.Category, entityJson: JSON.stringify(cats) },
                { key: ExchangeKey.Currency, entityJson: JSON.stringify(curs) },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (urlStr.endsWith("/settings/get")) {
        return new Response(
          JSON.stringify({
            isSuccess: true,
            data: { language: "en", defaultCurrency: "cur-1" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (urlStr.includes("/stat/ping")) {
        const url = new URL(urlStr);
        const dataParam = url.searchParams.get("data");
        if (!dataParam) {
          return new Response("Missing required data parameter", { status: 500 });
        }
        return new Response(
          JSON.stringify({
            isSuccess: true,
            data: { selection: { points: statPoints } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (urlStr.endsWith("/api/transaction/get")) {
        return new Response(
          JSON.stringify({
            transactions: txs,
            hasMoreData: overrides?.hasMore ?? false,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
  }

  it("automatically escalates to 'cold' bootstrap when last_full_reconcile_at is null", async () => {
    globalThis.fetch = createMockFetch();

    const result = await runExternalProviderSync({ tier: "hot" });

    expect(result.success).toBe(true);
    expect(result.tier).toBe("cold");
    expect(result.changed).toBe(true);
    expect(result.syncVersion).toBe(1);

    const config = await store.getSyncConfig();
    expect(config.last_full_reconcile_at).not.toBeNull();
    expect(config.sync_version).toBe(1);
    expect(config.sync_status).toBe("idle");
  });

  it("performs fast no-op hot pull when nothing changed", async () => {
    // 1. Initial full bootstrap
    globalThis.fetch = createMockFetch();
    const firstResult = await runExternalProviderSync();
    expect(firstResult.syncVersion).toBe(1);

    // 2. Second sync with identical data
    const fetchSpy = createMockFetch();
    globalThis.fetch = fetchSpy;

    const noopResult = await runExternalProviderSync({ tier: "hot" });
    expect(noopResult.success).toBe(true);
    expect(noopResult.changed).toBe(false);
    expect(noopResult.syncVersion).toBe(1);
    expect(noopResult.recordsSynced.transactions).toBe(0);

    const config = await store.getSyncConfig();
    expect(config.sync_version).toBe(1);
    expect(config.last_synced_at).not.toBeNull();
  });

  it("coalesces concurrent sync calls via single-flight deduplication", async () => {
    const fetchSpy = createMockFetch();
    globalThis.fetch = fetchSpy;

    const [res1, res2] = await Promise.all([
      runExternalProviderSync({ tier: "hot" }),
      runExternalProviderSync({ tier: "hot" }),
    ]);

    expect(res1).toBe(res2); // Exactly same result promise
    expect(res1.success).toBe(true);
  });

  it("automatically escalates to warm reconcile when account balance changed without new hot transactions", async () => {
    // 1. Seed initial bootstrap
    globalThis.fetch = createMockFetch();
    await runExternalProviderSync();

    // 2. Account balance changes (5000 -> 4200), but transactions remain same
    const updatedCategories = [
      { id: "cat-1", name: "Food", categoryType: CategoryType.Expense, amount: 100, order: 1 },
      { id: "acc-1", name: "Bank", categoryType: CategoryType.Account, amount: 4200, order: 2 },
    ];

    globalThis.fetch = createMockFetch({ categories: updatedCategories });

    const result = await runExternalProviderSync({ tier: "hot" });
    expect(result.success).toBe(true);
    expect(result.escalated).toBe(true);
    expect(result.tier).toBe("warm");
    expect(result.changed).toBe(true);

    const config = await store.getSyncConfig();
    expect(config.last_warm_reconcile_at).not.toBeNull();
  });

  it("records error state and error message in config on upstream failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection dropped"));

    const result = await runExternalProviderSync({ tier: "cold" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection dropped");

    const config = await store.getSyncConfig();
    expect(config.sync_status).toBe("error");
    expect(config.last_error).toContain("Network connection dropped");
  });

  it("invokes /stat/ping with required selection payload in data query parameter", async () => {
    let capturedStatUrl: string | null = null;
    const baseMock = createMockFetch();

    globalThis.fetch = vi.fn().mockImplementation((req: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof req === "string" ? req : req.toString();
      if (urlStr.includes("/stat/ping")) {
        capturedStatUrl = urlStr;
      }
      return baseMock(req, init);
    });

    const result = await runExternalProviderSync({ tier: "hot" });
    expect(result.success).toBe(true);
    expect(capturedStatUrl).not.toBeNull();
    if (!capturedStatUrl) {
      throw new Error("Expected capturedStatUrl to be defined");
    }

    const url = new URL(capturedStatUrl);
    const dataParam = url.searchParams.get("data");
    expect(dataParam).not.toBeNull();
    if (!dataParam) {
      throw new Error("Expected dataParam to be defined");
    }

    const parsed = JSON.parse(dataParam);
    expect(parsed.echo).toBe('{"selfSufficientRequest":true}');
    expect(parsed.selection.period.Before).toBe(40);
    expect(parsed.selection.period.from).toBeDefined();
  });

  describe("when EXTERNAL_API_ADAPTER='mock'", () => {
    beforeEach(() => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
    });

    it("runs mock sync with zero HTTP fetch calls and auto-seeds when sync_version is 0", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const result = await runExternalProviderSync({ tier: "hot" });
      expect(result.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      const config = await store.getSyncConfig();
      expect(config.sync_version).toBeGreaterThan(0);
      expect(config.sync_status).toBe("idle");
    });

    it("fetches settings, ping, and transactions via fetchFromExternalProvider without HTTP calls", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const settings = await fetchFromExternalProvider<{ isSuccess: boolean }>("/settings/get");
      expect(settings.isSuccess).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      const ping = await fetchFromExternalProvider<{ isSuccess: boolean }>("/Exchange/Ping");
      expect(ping.isSuccess).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
