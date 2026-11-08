import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CategoryType,
  type ExternalProviderTransaction,
  ExchangeKey,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import {
  getExternalProviderAdapter,
  LiveExternalProviderAdapter,
  MockExternalProviderAdapter,
  setTestExternalProviderAdapter,
} from "../adapter";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "../db";
import { MOCK_SEED_IDS } from "../mock-seed";

describe("ExternalProvider adapter module", () => {
  const originalEnv = { ...process.env };
  let memoryStore: LocalFileExternalProviderStore;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXTERNAL_API_ADAPTER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_MOCK_URL;

    // Use clean in-memory store for isolation
    memoryStore = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(memoryStore);
    setTestExternalProviderAdapter(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setTestExternalProviderStore(null);
    setTestExternalProviderAdapter(null);
    vi.restoreAllMocks();
  });

  describe("getExternalProviderAdapter factory", () => {
    it("returns LiveExternalProviderAdapter by default", () => {
      const adapter = getExternalProviderAdapter();
      expect(adapter).toBeInstanceOf(LiveExternalProviderAdapter);
      expect(adapter.mode).toBe("external-provider");
    });

    it("returns MockExternalProviderAdapter when EXTERNAL_API_ADAPTER='mock'", () => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
      const adapter = getExternalProviderAdapter();
      expect(adapter).toBeInstanceOf(MockExternalProviderAdapter);
      expect(adapter.mode).toBe("mock");
    });

    it("respects setTestExternalProviderAdapter override", () => {
      const customMock = new MockExternalProviderAdapter();
      setTestExternalProviderAdapter(customMock);
      expect(getExternalProviderAdapter()).toBe(customMock);
    });
  });

  describe("MockExternalProviderAdapter", () => {
    let adapter: MockExternalProviderAdapter;

    beforeEach(() => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
      adapter = new MockExternalProviderAdapter();
    });

    it("auto-seeds the store on initial access when sync_version is 0", async () => {
      const configBefore = await memoryStore.getSyncConfig();
      expect(configBefore.sync_version).toBe(0);

      const settings = await adapter.getSettings();
      expect(settings.isSuccess).toBe(true);
      expect(settings.data?.userId).toBe(MOCK_SEED_IDS.SETTINGS_USER_ID);

      const configAfter = await memoryStore.getSyncConfig();
      expect(configAfter.sync_version).toBe(1);

      const snapshot = await adapter.getSnapshot();
      expect(snapshot.categories.length).toBe(10);
      expect(snapshot.transactions.length).toBe(7);
      expect(snapshot.statPoints.length).toBeGreaterThanOrEqual(1);
    });

    it("handles exchangePing GET and returns categories, currencies, and user items", async () => {
      const res = await adapter.exchangePing();
      expect(res.isSuccess).toBe(true);
      const items = res.data?.items ?? [];
      expect(items.some((it) => it.key === ExchangeKey.Category)).toBe(true);
      expect(items.some((it) => it.key === ExchangeKey.Currency)).toBe(true);
      expect(items.some((it) => it.key === ExchangeKey.User)).toBe(true);
    });

    it("handles exchangePing category write payload and increments sync_version", async () => {
      await adapter.ensureSeeded();
      const initialConfig = await memoryStore.getSyncConfig();
      const initialVersion = initialConfig.sync_version;

      const currentCats = await memoryStore.getCategories(true);
      const groceryCat = currentCats.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(groceryCat).toBeDefined();

      const updatedCats = currentCats.map((c) =>
        c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES ? { ...c, limitAmount: 3333 } : c,
      );

      const pingResponse = await adapter.exchangePing({
        items: [{ key: ExchangeKey.Category, entityJson: JSON.stringify(updatedCats) }],
      });
      expect(pingResponse.isSuccess).toBe(true);

      const configAfter = await memoryStore.getSyncConfig();
      expect(configAfter.sync_version).toBeGreaterThan(initialVersion);

      // Verify limitAmount updated in store and in monthly stat points
      const savedCats = await memoryStore.getCategories(true);
      const savedGrocery = savedCats.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(savedGrocery?.limitAmount).toBe(3333);

      const statPoints = await memoryStore.getStatPoints();
      const marchPoint = statPoints.find((p) => p.id === "2026-03-01");
      const statGrocery = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(statGrocery?.limitAmount).toBe(3333);
    });

    it("supports getTransactions with pagination and category filtering", async () => {
      const resAll = await adapter.getTransactions({ skip: 0, take: 5 });
      expect(resAll.transactions?.length).toBe(5);
      expect(resAll.hasMoreData).toBe(true);

      const resFiltered = await adapter.getTransactions({
        categoryIds: [MOCK_SEED_IDS.CAT_EXP_HOUSING],
      });
      expect(resFiltered.transactions?.length).toBe(1);
      expect(resFiltered.transactions?.[0].destinationId).toBe(MOCK_SEED_IDS.CAT_EXP_HOUSING);
    });

    it("creates transactions, updates account balances and monthly stats, and increments sync_version", async () => {
      await adapter.ensureSeeded();
      const initialVersion = (await memoryStore.getSyncConfig()).sync_version;

      const newTx: ExternalProviderTransaction = {
        id: "tx-test-add",
        dateTimestamp: new Date("2026-03-15T12:00:00.000Z").getTime(),
        dateTimestampISO: "2026-03-15T12:00:00.000Z",
        sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
        sourceType: CategoryType.Account,
        sourceAmount: 400,
        destinationId: MOCK_SEED_IDS.CAT_EXP_GROCERIES,
        destinationType: CategoryType.Expense,
        destinationAmount: 400,
        comment: "Extra groceries",
      };

      const created = await adapter.createTransactions([newTx]);
      expect(created).toHaveLength(1);
      expect(created[0].id).toBe("tx-test-add");

      const configAfter = await memoryStore.getSyncConfig();
      expect(configAfter.sync_version).toBe(initialVersion + 1);

      // Verify Main Account balance decreased by 400 (was 21280 in seed)
      const mainAcc = (await memoryStore.getCategories(true)).find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      expect(mainAcc?.amount).toBe(21280 - 400);

      // Verify March 2026 grocery spend increased by 400 (was 650 in seed)
      const statPoints = await memoryStore.getStatPoints();
      const marchPoint = statPoints.find((p) => p.id === "2026-03-01");
      const statGrocery = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(statGrocery?.amount).toBe(650 + 400);
    });

    it("updates an existing transaction and reconciles balances", async () => {
      await adapter.ensureSeeded();

      // Soft delete tx-seed-2 (Housing 3200)
      const txToUpdate: ExternalProviderTransaction = {
        id: "tx-seed-2",
        dateTimestamp: new Date("2026-03-02T11:00:00.000Z").getTime(),
        dateTimestampISO: "2026-03-02T11:00:00.000Z",
        sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
        sourceType: CategoryType.Account,
        sourceAmount: 3200,
        destinationId: MOCK_SEED_IDS.CAT_EXP_HOUSING,
        destinationType: CategoryType.Expense,
        destinationAmount: 3200,
        deleted: true, // Marked deleted
      };

      await adapter.updateTransaction(txToUpdate);

      // Main account balance should be credited 3200 back (21280 + 3200 = 24480)
      const mainAcc = (await memoryStore.getCategories(true)).find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      expect(mainAcc?.amount).toBe(24480);

      // March housing spend should now be 0
      const statPoints = await memoryStore.getStatPoints();
      const marchPoint = statPoints.find((p) => p.id === "2026-03-01");
      const statHousing = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_HOUSING);
      expect(statHousing?.amount).toBe(0);
    });

    it("runs mock sync and returns ExternalProviderSyncResult", async () => {
      const syncResult = await adapter.sync();
      expect(syncResult.success).toBe(true);
      expect(syncResult.tier).toBe("hot");
      expect(syncResult.recordsSynced.categories).toBe(10);
      expect(syncResult.recordsSynced.transactions).toBe(7);
    });

    it("resets store to seed state via resetToSeed", async () => {
      await adapter.ensureSeeded();

      // Add dummy transaction
      await adapter.createTransactions([
        {
          id: "tx-will-be-wiped",
          sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
          sourceAmount: 9999,
          destinationId: MOCK_SEED_IDS.CAT_EXP_FEES,
          destinationAmount: 9999,
        },
      ]);

      const resetSnapshot = await adapter.resetToSeed();
      expect(resetSnapshot.syncConfig.sync_version).toBe(1);
      expect(resetSnapshot.transactions.find((t) => t.id === "tx-will-be-wiped")).toBeUndefined();
      expect(resetSnapshot.transactions).toHaveLength(7);

      const mainAcc = resetSnapshot.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      expect(mainAcc?.amount).toBe(21280);
    });
  });

  describe("LiveExternalProviderAdapter", () => {
    it("rejects resetToSeed in live mode", async () => {
      const liveAdapter = new LiveExternalProviderAdapter();
      await expect(liveAdapter.resetToSeed()).rejects.toThrow("forbidden in live external-provider mode");
    });
  });
});
