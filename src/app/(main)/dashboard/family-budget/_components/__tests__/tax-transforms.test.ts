import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "../external-provider-data";
import {
  aggregateTaxesByTag,
  computeIncomeTaxMetrics,
  detectUntaggedTaxTransactions,
  findTaxCategories,
  hasRecognizedTaxTag,
  matchTaxBucket,
  normalizeTaxTag,
} from "../tax-transforms";

describe("tax-transforms", () => {
  const currencies: ExternalProviderCurrency[] = [
    { id: "PLN", rate: 4.0 },
    { id: "USD", rate: 1.0 },
    { id: "EUR", rate: 0.9 },
  ];

  const taxCategories: ExternalProviderCategory[] = [
    { id: "cat-tax-pln", name: "Podatki (PLN)", categoryType: CategoryType.Expense, currencyId: "PLN" },
    { id: "cat-tax-usd", name: "Taxes (USD)", categoryType: CategoryType.Expense, currencyId: "USD" },
    { id: "cat-food", name: "Groceries", categoryType: CategoryType.Expense, currencyId: "PLN" },
    { id: "acc-bank", name: "Bank Account", categoryType: CategoryType.BankAccount, currencyId: "PLN" },
    { id: "inc-salary", name: "Main Job", categoryType: CategoryType.Income, currencyId: "PLN", limitAmount: 30000 },
  ];

  describe("findTaxCategories & Tag matching", () => {
    it("finds expense categories matching tax regex", () => {
      const found = findTaxCategories(taxCategories);
      expect(found.map((c) => c.id)).toEqual(["cat-tax-pln", "cat-tax-usd"]);
    });

    it("normalizes and matches tax tags properly", () => {
      expect(normalizeTaxTag("#PIT")).toBe("pit");
      expect(normalizeTaxTag(" #zus ")).toBe("zus");
      expect(normalizeTaxTag("health")).toBe("health");

      expect(matchTaxBucket("#pit")?.id).toBe("pit");
      expect(matchTaxBucket("income-tax")?.id).toBe("pit");
      expect(matchTaxBucket("#ZUS")?.id).toBe("zus");
      expect(matchTaxBucket("nfz")?.id).toBe("health");
      expect(matchTaxBucket("belka")?.id).toBe("capital-gains");
      expect(matchTaxBucket("unknown-tag")).toBeNull();
    });

    it("evaluates hasRecognizedTaxTag", () => {
      expect(hasRecognizedTaxTag({ id: "t1", tags: ["#pit"] })).toBe(true);
      expect(hasRecognizedTaxTag({ id: "t2", tags: ["random"] })).toBe(false);
      expect(hasRecognizedTaxTag({ id: "t3", tags: [] })).toBe(false);
      expect(hasRecognizedTaxTag({ id: "t4" })).toBe(false);
    });
  });

  describe("detectUntaggedTaxTransactions", () => {
    const taxCategoryIds = new Set(["cat-tax-pln", "cat-tax-usd"]);

    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-1",
        destinationId: "cat-tax-pln",
        destinationAmount: 2000,
        destinationCurrencyId: "PLN",
        tags: ["#pit"],
        dateTimestamp: 1700000000000,
      },
      {
        id: "tx-2",
        destinationId: "cat-tax-pln",
        destinationAmount: 500,
        destinationCurrencyId: "PLN",
        tags: [],
        dateTimestamp: 1700000100000,
      },
      {
        id: "tx-3",
        destinationId: "cat-tax-usd",
        destinationAmount: 100,
        destinationCurrencyId: "USD",
        tags: ["lunch"], // Not a recognized tax tag!
        dateTimestamp: 1700000200000,
      },
      {
        id: "tx-4",
        destinationId: "cat-food",
        destinationAmount: 50,
        tags: [],
        dateTimestamp: 1700000300000,
      },
    ];

    it("detects untagged or unrecognized tax transactions only", () => {
      const untagged = detectUntaggedTaxTransactions(transactions, taxCategoryIds);
      expect(untagged.map((t) => t.id)).toEqual(["tx-3", "tx-2"]);
    });
  });

  describe("aggregateTaxesByTag", () => {
    const taxCategoryIds = new Set(["cat-tax-pln", "cat-tax-usd"]);

    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-pit-1",
        destinationId: "cat-tax-pln",
        destinationAmount: 4000,
        destinationCurrencyId: "PLN",
        tags: ["#pit"],
      },
      {
        id: "tx-zus-1",
        destinationId: "cat-tax-pln",
        destinationAmount: 1000,
        destinationCurrencyId: "PLN",
        tags: ["zus"],
      },
      {
        id: "tx-pit-usd",
        destinationId: "cat-tax-usd",
        destinationAmount: 500, // 500 USD = 2000 PLN (4.0 PLN per 1 USD)
        destinationCurrencyId: "USD",
        tags: ["income-tax"],
      },
      {
        id: "tx-untagged",
        destinationId: "cat-tax-pln",
        destinationAmount: 500,
        destinationCurrencyId: "PLN",
        tags: [],
      },
    ];

    it("aggregates across currencies and tags into converted totals and percentages", () => {
      const result = aggregateTaxesByTag({
        transactions,
        taxCategoryIds,
        currencies,
        defaultCurrency: "PLN",
      });

      // Total taxes: 4000 (PIT) + 1000 (ZUS) + 2000 (USD PIT in PLN) + 500 (untagged) = 7500 PLN
      expect(result.totalTaxesConverted).toBe(7500);
      expect(result.untaggedCount).toBe(1);
      expect(result.untaggedTotalConverted).toBe(500);

      const pitAggregate = result.byTag.find((t) => t.tagId === "pit");
      expect(pitAggregate).toBeDefined();
      expect(pitAggregate?.totalConverted).toBe(6000); // 4000 PLN + 2000 PLN
      expect(pitAggregate?.percentage).toBeCloseTo((6000 / 7500) * 100, 1);
      expect(pitAggregate?.byCurrency).toEqual([
        { currency: "PLN", amount: 4000 },
        { currency: "USD", amount: 500 },
      ]);

      const zusAggregate = result.byTag.find((t) => t.tagId === "zus");
      expect(zusAggregate).toBeDefined();
      expect(zusAggregate?.totalConverted).toBe(1000);
      expect(zusAggregate?.percentage).toBeCloseTo((1000 / 7500) * 100, 1);
    });
  });

  describe("computeIncomeTaxMetrics", () => {
    it("computes net disposable income and expense coverage according to spec scenario", () => {
      const transactions: ExternalProviderTransaction[] = [
        // Gross income: 30,000 PLN
        {
          id: "tx-inc-1",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 30000,
          destinationCurrencyId: "PLN",
        },
        // Tax payment: 5,000 PLN
        {
          id: "tx-tax-1",
          sourceId: "acc-bank",
          sourceType: CategoryType.BankAccount,
          destinationId: "cat-tax-pln",
          destinationType: CategoryType.Expense,
          destinationAmount: 5000,
          destinationCurrencyId: "PLN",
          tags: ["#pit"],
        },
      ];

      const metrics = computeIncomeTaxMetrics({
        transactions,
        categories: taxCategories,
        currencies,
        defaultCurrency: "PLN",
        controllableExpenses: 15000,
      });

      expect(metrics.grossIncome).toBe(30000);
      expect(metrics.totalTaxes).toBe(5000);
      expect(metrics.netDisposableIncome).toBe(25000);
      // Effective tax rate: 5000 / 30000 = 16.666...% -> 16.7%
      expect(metrics.effectiveTaxRate).toBeCloseTo(16.67, 1);
      // Expense coverage ratio: 25000 / 15000 = 166.666...% -> 167%
      expect(metrics.coverageRatio).toBeCloseTo(166.67, 1);
      expect(metrics.netSurplus).toBe(10000);

      expect(metrics.incomeSources).toHaveLength(1);
      expect(metrics.incomeSources[0].sourceName).toBe("Main Job");
      expect(metrics.incomeSources[0].totalConverted).toBe(30000);
    });
  });
});
