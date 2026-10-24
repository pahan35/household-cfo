import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "../external-provider-data";
import {
  aggregateTaxesByTag,
  computeFxFriction,
  computeIncomeTaxMetrics,
  computeTradeSpreadLoss,
  computeVatCurrencyDrag,
  detectUntaggedTaxTransactions,
  findTaxCategories,
  hasRecognizedTaxTag,
  isPfronCashbackCategory,
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

  describe("PFRON cashback identification & ZUS contra-rebate netting", () => {
    it("identifies Cashback taxes via regex", () => {
      expect(isPfronCashbackCategory("Cashback taxes")).toBe(true);
      expect(isPfronCashbackCategory("cashback_taxes")).toBe(true);
      expect(isPfronCashbackCategory("Cashback - Taxes")).toBe(true);
      expect(isPfronCashbackCategory("Salary")).toBe(false);
    });

    it("nets PFRON cashback against ZUS and excludes it from gross income", () => {
      const pfronCategories: ExternalProviderCategory[] = [
        ...taxCategories,
        { id: "inc-pfron", name: "Cashback taxes", categoryType: CategoryType.Income, currencyId: "PLN" },
      ];

      const transactions: ExternalProviderTransaction[] = [
        // Gross client revenue: 30,000 PLN
        {
          id: "tx-client-rev",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 30000,
          destinationCurrencyId: "PLN",
        },
        // PFRON refund ("Cashback taxes"): 1,200 PLN
        {
          id: "tx-pfron-inflow",
          sourceId: "inc-pfron",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 1200,
          destinationCurrencyId: "PLN",
        },
        // ZUS payment: 2,000 PLN
        {
          id: "tx-zus",
          sourceId: "acc-bank",
          sourceType: CategoryType.BankAccount,
          destinationId: "cat-tax-pln",
          destinationType: CategoryType.Expense,
          destinationAmount: 2000,
          destinationCurrencyId: "PLN",
          tags: ["#zus"],
        },
        // PIT payment: 3,000 PLN
        {
          id: "tx-pit",
          sourceId: "acc-bank",
          sourceType: CategoryType.BankAccount,
          destinationId: "cat-tax-pln",
          destinationType: CategoryType.Expense,
          destinationAmount: 3000,
          destinationCurrencyId: "PLN",
          tags: ["#pit"],
        },
      ];

      const metrics = computeIncomeTaxMetrics({
        transactions,
        categories: pfronCategories,
        currencies,
        defaultCurrency: "PLN",
      });

      // Total Gross Income excludes 1,200 PLN cashback
      expect(metrics.grossIncome).toBe(30000);
      expect(metrics.pfronCashback).toBe(1200);
      expect(metrics.grossZus).toBe(2000);
      // Net ZUS: 2,000 - 1,200 = 800 PLN
      expect(metrics.netZus).toBe(800);
      // Total personal taxes: 3,000 (PIT) + 800 (Net ZUS) = 3,800 PLN
      expect(metrics.totalTaxes).toBe(3800);
      // Net disposable income: 30,000 - 3,800 = 26,200 PLN
      expect(metrics.netDisposableIncome).toBe(26200);
      // Effective tax rate: 3,800 / 30,000 = 12.67%
      expect(metrics.effectiveTaxRate).toBeCloseTo(12.67, 1);

      // Verify income sources mark PFRON as tax rebate
      const pfronSource = metrics.incomeSources.find((s) => s.sourceId === "inc-pfron");
      expect(pfronSource).toBeDefined();
      expect(pfronSource?.isTaxRebate).toBe(true);
      expect(pfronSource?.percentageOfGross).toBe(0);
    });
  });

  describe("VAT-7 neutral business pass-through segregation", () => {
    it("segregates VAT-7 from personal taxes in aggregateTaxesByTag", () => {
      const taxCategoryIds = new Set(["cat-tax-pln"]);
      const transactions: ExternalProviderTransaction[] = [
        {
          id: "tx-pit",
          destinationId: "cat-tax-pln",
          destinationAmount: 4000,
          destinationCurrencyId: "PLN",
          tags: ["#pit"],
        },
        {
          id: "tx-zus",
          destinationId: "cat-tax-pln",
          destinationAmount: 1000,
          destinationCurrencyId: "PLN",
          tags: ["#zus"],
        },
        {
          id: "tx-vat",
          destinationId: "cat-tax-pln",
          destinationAmount: 2000,
          destinationCurrencyId: "PLN",
          tags: ["#vat"],
        },
      ];

      const result = aggregateTaxesByTag({
        transactions,
        taxCategoryIds,
        currencies,
        defaultCurrency: "PLN",
      });

      // Total personal taxes excludes VAT-7: 4,000 + 1,000 = 5,000 PLN
      expect(result.totalTaxesConverted).toBe(5000);
      expect(result.totalPersonalTaxesConverted).toBe(5000);
      expect(result.totalPassThroughConverted).toBe(2000);

      expect(result.personalTags).toHaveLength(2);
      expect(result.passThroughTags).toHaveLength(1);
      expect(result.passThroughTags[0].tagId).toBe("vat");
      expect(result.passThroughTags[0].totalConverted).toBe(2000);
      expect(result.passThroughTags[0].isPassThrough).toBe(true);

      // PIT percentage should be relative to personal taxes (4000 / 5000 = 80%)
      const pitTag = result.personalTags.find((t) => t.tagId === "pit");
      expect(pitTag?.percentage).toBe(80);
    });
  });

  describe("USD FX friction & VAT currency drag", () => {
    it("computes trade spread loss against NBP rate correctly", () => {
      // 3,000 USD exchanged at 3.98 PLN/USD vs 4.02 NBP rate -> 120 PLN loss
      const spread = computeTradeSpreadLoss(3000, 11940, 4.02);
      expect(spread.realizedRate).toBe(3.98);
      expect(spread.tradeSpreadLossPln).toBe(120);
      expect(spread.tradeSpreadLossUsd).toBeCloseTo(120 / 4.02, 2);
    });

    it("computes VAT currency drag correctly", () => {
      // VAT 9,430 PLN invoiced at 4.10 NBP rate (2,300 USD) remitted at 3.95 realized rate
      // 9430 / 3.95 = 2387.34 USD -> 87.34 USD (345 PLN) drag
      const drag = computeVatCurrencyDrag(9430, 4.1, 3.95);
      expect(drag.vatDragLossUsd).toBe(87.34);
      expect(drag.vatDragLossPln).toBe(345);
    });

    it("computes overall FX friction from account transfer transactions", () => {
      const categories: ExternalProviderCategory[] = [
        { id: "acc-usd", name: "USD Business", categoryType: CategoryType.BankAccount, currencyId: "USD" },
        { id: "acc-pln", name: "PLN Account", categoryType: CategoryType.BankAccount, currencyId: "PLN" },
        { id: "cat-tax-pln", name: "Podatki", categoryType: CategoryType.Expense, currencyId: "PLN" },
      ];

      const transactions: ExternalProviderTransaction[] = [
        {
          id: "tx-fx-1",
          sourceId: "acc-usd",
          sourceCurrencyId: "USD",
          sourceAmount: 3000,
          destinationId: "acc-pln",
          destinationCurrencyId: "PLN",
          destinationAmount: 11940, // 3.98
          dateTimestampISO: "2024-01-15T10:00:00Z", // 2024-01 in macro-data has usdPlnRate: 4.0
        },
      ];

      const friction = computeFxFriction({
        transactions,
        categories,
        monthKey: "2024-01",
      });

      // At 2024-01, macro-data rate is 4.0. Realized rate is 3.98. Spread loss is 3000 * (4.0 - 3.98) = 60 PLN
      expect(friction.transfers).toHaveLength(1);
      expect(friction.transfers[0].realizedRate).toBe(3.98);
      expect(friction.tradeSpreadLossPln).toBe(60);
      expect(friction.totalFxFrictionPln).toBe(60);
    });
  });
});
