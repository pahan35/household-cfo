import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CategoryType,
  type ExternalProviderTransaction,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import {
  BASE_ACCOUNT_BALANCES,
  buildMockCurrencies,
  buildMockSeedCategories,
  buildMockSeedSnapshot,
  buildMockSeedTransactions,
  buildMockSettings,
  MOCK_SEED_IDS,
  recomputeMockStatPointsAndBalances,
} from "../mock-seed";

describe("mock-seed module", () => {
  describe("buildMockSettings and buildMockCurrencies", () => {
    it("returns deterministic settings with defaultCurrency PLN", () => {
      const settings = buildMockSettings();
      expect(settings.defaultCurrency).toBe(MOCK_SEED_IDS.CURRENCY_PLN);
      expect(settings.userId).toBe(MOCK_SEED_IDS.SETTINGS_USER_ID);
      expect(settings.language).toBe("en");
    });

    it("returns PLN, EUR, and USD currencies", () => {
      const currencies = buildMockCurrencies();
      expect(currencies).toHaveLength(3);
      expect(currencies.map((c) => c.id)).toEqual([
        MOCK_SEED_IDS.CURRENCY_PLN,
        MOCK_SEED_IDS.CURRENCY_EUR,
        MOCK_SEED_IDS.CURRENCY_USD,
      ]);
    });
  });

  describe("buildMockSeedSnapshot", () => {
    it("returns complete snapshot with sync_version = 1", () => {
      const snapshot = buildMockSeedSnapshot();
      expect(snapshot.syncConfig.sync_version).toBe(1);
      expect(snapshot.syncConfig.sync_status).toBe("idle");
      expect(snapshot.settings.userId).toBe(MOCK_SEED_IDS.SETTINGS_USER_ID);
      expect(snapshot.currencies.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.categories.length).toBe(10);
      expect(snapshot.transactions.length).toBe(7);
      expect(snapshot.statPoints.length).toBeGreaterThanOrEqual(1);

      // Verify recalculated balances on seed
      const mainAcc = snapshot.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      expect(mainAcc).toBeDefined();
      // 15000 + 12000 - 3200 - 650 - 220 - 150 - 500 - 1000 = 21280
      expect(mainAcc?.amount).toBe(21280);
      expect(mainAcc?.currentAmount).toBe(21280);

      const savingsAcc = snapshot.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_SAVINGS);
      // 5000 + 230 = 5230
      expect(savingsAcc?.amount).toBe(5230);

      const debtAcc = snapshot.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_DEBT_FRIEND);
      // -2500 + 500 = -2000
      expect(debtAcc?.amount).toBe(-2000);

      // Verify stat points for March 2026
      const marchPoint = snapshot.statPoints.find((p) => p.id === "2026-03-01");
      expect(marchPoint).toBeDefined();

      const housingStat = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_HOUSING);
      expect(housingStat?.amount).toBe(3200);
      expect(housingStat?.limitAmount).toBe(4000);

      const groceriesStat = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(groceriesStat?.amount).toBe(650);
      expect(groceriesStat?.limitAmount).toBe(2500);
    });
  });

  describe("recomputeMockStatPointsAndBalances", () => {
    it("excludes deleted transactions from balances and stat points", () => {
      const categories = buildMockSeedCategories();
      const transactions = buildMockSeedTransactions();

      // Mark grocery transaction as deleted
      const groceryTx = transactions.find((t) => t.id === "tx-seed-3");
      expect(groceryTx).toBeDefined();
      if (groceryTx) {
        groceryTx.deleted = true;
      }

      const { updatedCategories, statPoints } = recomputeMockStatPointsAndBalances(categories, transactions);

      const mainAcc = updatedCategories.find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      // Without grocery expense (650), balance should be 21280 + 650 = 21930
      expect(mainAcc?.amount).toBe(21930);

      const marchPoint = statPoints.find((p) => p.id === "2026-03-01");
      const groceriesStat = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      expect(groceriesStat?.amount).toBe(0);
    });

    it("recomputes when a new transaction is added", () => {
      const categories = buildMockSeedCategories();
      const transactions = buildMockSeedTransactions();

      const newTx: ExternalProviderTransaction = {
        id: "tx-new-1",
        dateTimestamp: new Date("2026-03-10T12:00:00.000Z").getTime(),
        dateTimestampISO: "2026-03-10T12:00:00.000Z",
        sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
        sourceType: CategoryType.Account,
        sourceAmount: 300,
        destinationId: MOCK_SEED_IDS.CAT_EXP_GROCERIES,
        destinationType: CategoryType.Expense,
        destinationAmount: 300,
        deleted: false,
      };

      const { updatedCategories, statPoints } = recomputeMockStatPointsAndBalances(categories, [
        ...transactions,
        newTx,
      ]);

      const mainAcc = updatedCategories.find((c) => c.id === MOCK_SEED_IDS.CAT_ACC_MAIN);
      // 21280 - 300 = 20980
      expect(mainAcc?.amount).toBe(20980);

      const marchPoint = statPoints.find((p) => p.id === "2026-03-01");
      const groceriesStat = marchPoint?.categories.find((c) => c.id === MOCK_SEED_IDS.CAT_EXP_GROCERIES);
      // 650 + 300 = 950
      expect(groceriesStat?.amount).toBe(950);
    });
  });
});
