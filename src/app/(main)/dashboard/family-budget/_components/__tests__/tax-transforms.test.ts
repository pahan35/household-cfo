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
  computeIncomeTaxTimeline,
  computeTradeSpreadLoss,
  computeVatCurrencyDrag,
  detectUntaggedTaxTransactions,
  findTaxCategories,
  formatMonthLabel,
  getPreviousMonthKey,
  getTransactionMonthKey,
  hasRecognizedTaxTag,
  isPfronCashbackCategory,
  matchTaxBucket,
  normalizeTaxTag,
  TAX_CATEGORY_REGEX,
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
    { id: "cat-taxi-pln", name: "Taxi PLN", categoryType: CategoryType.Expense, currencyId: "PLN" },
    { id: "cat-food", name: "Groceries", categoryType: CategoryType.Expense, currencyId: "PLN" },
    { id: "acc-bank", name: "Bank Account", categoryType: CategoryType.BankAccount, currencyId: "PLN" },
    { id: "inc-salary", name: "Main Job", categoryType: CategoryType.Income, currencyId: "PLN", limitAmount: 30000 },
  ];

  describe("findTaxCategories & Tag matching", () => {
    it("finds expense categories matching tax regex without matching Taxi PLN", () => {
      const found = findTaxCategories(taxCategories);
      expect(found.map((c) => c.id)).toEqual(["cat-tax-pln", "cat-tax-usd"]);
      expect(found.some((c) => c.id === "cat-taxi-pln")).toBe(false);

      expect(TAX_CATEGORY_REGEX.test("Taxi PLN")).toBe(false);
      expect(TAX_CATEGORY_REGEX.test("Taxi")).toBe(false);
      expect(TAX_CATEGORY_REGEX.test("Tax PLN")).toBe(true);
      expect(TAX_CATEGORY_REGEX.test("Taxes & ZUS")).toBe(true);
      expect(TAX_CATEGORY_REGEX.test("Podatki")).toBe(true);
      expect(TAX_CATEGORY_REGEX.test("Налоги")).toBe(true);
    });

    it("normalizes and matches tax tags properly", () => {
      expect(normalizeTaxTag("#PIT")).toBe("pit");
      expect(normalizeTaxTag("#PPE")).toBe("ppe");
      expect(normalizeTaxTag(" #zus ")).toBe("zus");
      expect(normalizeTaxTag("health")).toBe("health");
      expect(normalizeTaxTag("#VAT-7")).toBe("vat-7");

      expect(matchTaxBucket("#ppe")?.id).toBe("ppe");
      expect(matchTaxBucket("#PPE")?.id).toBe("ppe");
      expect(matchTaxBucket("#pit")?.id).toBe("ppe");
      expect(matchTaxBucket("income-tax")?.id).toBe("ppe");
      expect(matchTaxBucket("#ZUS")?.id).toBe("zus");
      expect(matchTaxBucket("nfz")?.id).toBe("health");
      expect(matchTaxBucket("#vat")?.id).toBe("vat");
      expect(matchTaxBucket("#VAT-7")?.id).toBe("vat");
      expect(matchTaxBucket("vat7")?.id).toBe("vat");
      expect(matchTaxBucket("belka")?.id).toBe("capital-gains");
      expect(matchTaxBucket("unknown-tag")).toBeNull();
    });

    it("evaluates hasRecognizedTaxTag", () => {
      expect(hasRecognizedTaxTag({ id: "t1", tags: ["#PPE"] })).toBe(true);
      expect(hasRecognizedTaxTag({ id: "t1b", tags: ["#VAT-7"] })).toBe(true);
      expect(hasRecognizedTaxTag({ id: "t1c", tags: ["#pit"] })).toBe(true);
      expect(hasRecognizedTaxTag({ id: "t1d", tags: ["#vat"] })).toBe(true);
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
        id: "tx-ppe",
        destinationId: "cat-tax-pln",
        destinationAmount: 1500,
        destinationCurrencyId: "PLN",
        tags: ["#PPE"],
        dateTimestamp: 1700000050000,
      },
      {
        id: "tx-vat7",
        destinationId: "cat-tax-pln",
        destinationAmount: 1200,
        destinationCurrencyId: "PLN",
        tags: ["#VAT-7"],
        dateTimestamp: 1700000080000,
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

      const ppeAggregate = result.byTag.find((t) => t.tagId === "ppe");
      expect(ppeAggregate).toBeDefined();
      expect(ppeAggregate?.canonicalTag).toBe("PPE");
      expect(ppeAggregate?.totalConverted).toBe(6000); // 4000 PLN + 2000 PLN
      expect(ppeAggregate?.percentage).toBeCloseTo((6000 / 7500) * 100, 1);
      expect(ppeAggregate?.byCurrency).toEqual([
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
      expect(result.passThroughTags[0].canonicalTag).toBe("VAT-7");
      expect(result.passThroughTags[0].totalConverted).toBe(2000);
      expect(result.passThroughTags[0].isPassThrough).toBe(true);

      // PPE percentage should be relative to personal taxes (4000 / 5000 = 80%)
      const ppeTag = result.personalTags.find((t) => t.tagId === "ppe");
      expect(ppeTag?.percentage).toBe(80);
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

  describe("computeIncomeTaxTimeline", () => {
    const timelineCategories: ExternalProviderCategory[] = [
      ...taxCategories,
      { id: "inc-b2b-client", name: "B2B Client", categoryType: CategoryType.Income, currencyId: "PLN" },
      { id: "inc-pfron", name: "Cashback taxes", categoryType: CategoryType.Income, currencyId: "PLN" },
    ];

    it("extracts monthKey and handles previous month shifts", () => {
      expect(getTransactionMonthKey({ id: "t1", dateTimestampISO: "2024-03-15T10:00:00Z" })).toBe("2024-03");
      expect(getPreviousMonthKey("2024-03")).toBe("2024-02");
      expect(getPreviousMonthKey("2024-01")).toBe("2023-12");
      expect(formatMonthLabel("2024-03")).toBe("Mar 2024");
    });

    it("aggregates monthly points with PFRON netting and isolated client sources in cash mode", () => {
      const transactions: ExternalProviderTransaction[] = [
        // 2024-01: Main Job 30,000 PLN + B2B Client 10,000 PLN = 40,000 PLN gross
        {
          id: "tx-inc-1",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 30000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-10T12:00:00Z",
        },
        {
          id: "tx-inc-2",
          sourceId: "inc-b2b-client",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 10000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-15T12:00:00Z",
        },
        // 2024-01: PFRON cashback 1,200 PLN
        {
          id: "tx-pfron",
          sourceId: "inc-pfron",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 1200,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
        // 2024-01: ZUS 2,000 PLN
        {
          id: "tx-zus",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 2000,
          destinationCurrencyId: "PLN",
          tags: ["#zus"],
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
        // 2024-01: PPE 3,000 PLN
        {
          id: "tx-ppe",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 3000,
          destinationCurrencyId: "PLN",
          tags: ["#PPE"],
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
        // 2024-01: Health 1,000 PLN
        {
          id: "tx-health",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 1000,
          destinationCurrencyId: "PLN",
          tags: ["#health"],
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
        // 2024-01: VAT-7 2,300 PLN
        {
          id: "tx-vat",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 2300,
          destinationCurrencyId: "PLN",
          tags: ["#VAT-7"],
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
      ];

      const result = computeIncomeTaxTimeline({
        transactions,
        categories: timelineCategories,
        currencies,
        defaultCurrency: "PLN",
        timingMode: "cash",
      });

      expect(result.points).toHaveLength(1);
      const pt = result.points[0];
      expect(pt.monthKey).toBe("2024-01");
      expect(pt.grossIncome).toBe(40000);
      expect(pt.incomeBySource["inc-salary"]).toBe(30000);
      expect(pt.incomeBySource["inc-b2b-client"]).toBe(10000);

      expect(pt.grossZus).toBe(2000);
      expect(pt.pfronCashback).toBe(1200);
      expect(pt.netZus).toBe(800); // 2000 - 1200
      expect(pt.ppe).toBe(3000);
      expect(pt.health).toBe(1000);
      expect(pt.passThroughVat).toBe(2300);

      // Total personal taxes = 3000 (PPE) + 1000 (Health) + 800 (Net ZUS) = 4800
      expect(pt.totalPersonalTaxes).toBe(4800);
      // Effective tax rate = 4800 / 40000 = 12%
      expect(pt.effectiveTaxRate).toBe(12);
      expect(pt.netYield).toBe(35200);

      // Available sources
      expect(result.availableSources).toHaveLength(2);
      expect(result.availableSources[0].id).toBe("inc-salary");
      expect(result.availableSources[0].totalConverted).toBe(30000);
      expect(result.availableSources[1].id).toBe("inc-b2b-client");
      expect(result.availableSources[1].totalConverted).toBe(10000);
    });

    it("filters selected income sources and recalculates effective tax rate dynamically", () => {
      const transactions: ExternalProviderTransaction[] = [
        {
          id: "tx-inc-salary",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 30000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-10T12:00:00Z",
        },
        {
          id: "tx-inc-b2b",
          sourceId: "inc-b2b-client",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 10000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-15T12:00:00Z",
        },
        {
          id: "tx-tax",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 3000,
          destinationCurrencyId: "PLN",
          tags: ["#PPE"],
          dateTimestampISO: "2024-01-20T12:00:00Z",
        },
      ];

      // Select only inc-salary
      const result = computeIncomeTaxTimeline({
        transactions,
        categories: timelineCategories,
        currencies,
        defaultCurrency: "PLN",
        selectedSourceIds: ["inc-salary"],
      });

      expect(result.points).toHaveLength(1);
      const pt = result.points[0];
      expect(pt.grossIncome).toBe(30000); // 10,000 from inc-b2b is excluded from gross
      expect(pt.totalPersonalTaxes).toBe(3000);
      // Effective tax rate: 3000 / 30000 = 10%
      expect(pt.effectiveTaxRate).toBe(10);
      expect(pt.netYield).toBe(27000);
    });

    it("shifts tax payments to M - 1 in accrual mode to align with invoice earnings", () => {
      const transactions: ExternalProviderTransaction[] = [
        // Jan 2024: 30,000 PLN earned from client
        {
          id: "tx-inc-jan",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 30000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-01-15T12:00:00Z",
        },
        // Feb 2024: 40,000 PLN earned from client
        {
          id: "tx-inc-feb",
          sourceId: "inc-salary",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 40000,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-02-15T12:00:00Z",
        },
        // Feb 2024: Tax payments for Jan's liability
        {
          id: "tx-ppe-feb",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 3600,
          destinationCurrencyId: "PLN",
          tags: ["#PPE"],
          dateTimestampISO: "2024-02-20T12:00:00Z",
        },
        {
          id: "tx-zus-feb",
          sourceId: "acc-bank",
          destinationId: "cat-tax-pln",
          destinationAmount: 2000,
          destinationCurrencyId: "PLN",
          tags: ["#zus"],
          dateTimestampISO: "2024-02-20T12:00:00Z",
        },
        {
          id: "tx-pfron-feb",
          sourceId: "inc-pfron",
          sourceType: CategoryType.Income,
          destinationId: "acc-bank",
          destinationType: CategoryType.BankAccount,
          destinationAmount: 1200,
          destinationCurrencyId: "PLN",
          dateTimestampISO: "2024-02-20T12:00:00Z",
        },
      ];

      // In Accrual mode, Feb's taxes (PPE 3600, Net ZUS 800 -> 4400) shift to Jan 2024
      const result = computeIncomeTaxTimeline({
        transactions,
        categories: timelineCategories,
        currencies,
        defaultCurrency: "PLN",
        timingMode: "accrual",
      });

      expect(result.points).toHaveLength(2);
      const janPt = result.points.find((p) => p.monthKey === "2024-01");
      const febPt = result.points.find((p) => p.monthKey === "2024-02");

      expect(janPt).toBeDefined();
      expect(janPt?.grossIncome).toBe(30000);
      expect(janPt?.ppe).toBe(3600);
      expect(janPt?.netZus).toBe(800);
      expect(janPt?.totalPersonalTaxes).toBe(4400);
      // Effective tax rate: 4400 / 30000 = 14.67%
      expect(janPt?.effectiveTaxRate).toBeCloseTo(14.67, 1);

      expect(febPt).toBeDefined();
      expect(febPt?.grossIncome).toBe(40000);
      expect(febPt?.totalPersonalTaxes).toBe(0); // March taxes haven't been recorded yet
    });
  });
});
