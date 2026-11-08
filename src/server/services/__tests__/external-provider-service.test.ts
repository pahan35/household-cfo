import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setTestExternalProviderAdapter } from "@/server/external-provider/adapter";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "@/server/external-provider/db";

import {
  createTransactions,
  getSnapshot,
  resetMockExternalProvider,
  triggerSync,
  updateSyncConfig,
  updateTransaction,
  upsertCategories,
} from "../external-provider-service";
import { type AuthContext, ServiceError } from "../types";

const mockCtx: AuthContext = {
  subject: "test@example.com",
  source: "bearer",
};

describe("external-provider-service", () => {
  const originalEnv = { ...process.env };
  let memoryStore: LocalFileExternalProviderStore;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXTERNAL_API_ADAPTER;
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

  describe("in mock adapter mode", () => {
    beforeEach(() => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
    });

    it("gets snapshot on initial access", async () => {
      const snapshot = await getSnapshot(mockCtx);
      expect(snapshot.syncConfig.sync_version).toBe(1);
      expect(snapshot.categories.length).toBeGreaterThan(0);
      expect(snapshot.transactions.length).toBeGreaterThan(0);
    });

    it("triggers sync", async () => {
      const result = await triggerSync(mockCtx, { tier: "hot" });
      expect(result.success).toBe(true);
      expect(result.recordsSynced.categories).toBeGreaterThan(0);
    });

    it("updates sync config", async () => {
      const updated = await updateSyncConfig(mockCtx, { hotPullMonths: 6, autoPollIntervalMinutes: 15 });
      expect(updated.hot_pull_months).toBe(6);
      expect(updated.auto_poll_interval_minutes).toBe(15);
    });

    it("creates transactions and updates categories", async () => {
      const txs = await createTransactions(mockCtx, {
        sourceId: "cat-acc-main",
        sourceAmount: 50,
        destinationId: "cat-exp-groceries",
        destinationAmount: 50,
      });
      expect(txs).toHaveLength(1);
      expect(txs[0].sourceAmount).toBe(50);

      const cats = await upsertCategories(mockCtx, [
        { id: "cat-exp-groceries", name: "Groceries Updated", categoryType: 3, limitAmount: 3000 },
      ]);
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe("Groceries Updated");
    });

    it("updates an existing transaction", async () => {
      const updated = await updateTransaction(mockCtx, {
        id: "tx-seed-1",
        comment: "Updated salary comment",
      });
      expect(updated.comment).toBe("Updated salary comment");
    });

    it("resets mock state to seed snapshot", async () => {
      // Modify state
      await createTransactions(mockCtx, {
        id: "tx-to-wipe",
        sourceAmount: 1000,
      });

      const reset = await resetMockExternalProvider(mockCtx);
      expect(reset.syncConfig.sync_version).toBe(1);
      expect(reset.transactions.find((t) => t.id === "tx-to-wipe")).toBeUndefined();
    });
  });

  describe("in live externalProvider mode (default)", () => {
    it("forbids resetMockExternalProvider with 403 ServiceError", async () => {
      delete process.env.EXTERNAL_API_ADAPTER;

      await expect(resetMockExternalProvider(mockCtx)).rejects.toThrowError(
        new ServiceError("forbidden", "Resetting ExternalProvider is forbidden when not in mock mode"),
      );
    });
  });
});
