import { describe, expect, it } from "vitest";

import {
  computeAccountBreakdown,
  computePeriodSpendSummary,
  filterTransactionsByAccount,
  identifySubcategoryName,
  resolveCategoryIdsForTrace,
  resolveTransactionSpend,
  sortTransactionsReverseChronological,
} from "../category-expense-trace-helpers";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "../external-provider-data";

describe("category-expense-trace-helpers", () => {
  const mockCategories: ExternalProviderCategory[] = [
    { id: "acc-primary-bank", name: "Primary Bank Card", categoryType: CategoryType.BankAccount, icon: "bank" },
    { id: "acc-revolut", name: "Revolut", categoryType: CategoryType.BankAccount, icon: "card" },
    { id: "acc-cash", name: "Cash Wallet", categoryType: CategoryType.Account, icon: "cash" },
    { id: "cat-groceries", name: "Groceries", categoryType: CategoryType.Expense },
    { id: "cat-transport", name: "Transport PLN", categoryType: CategoryType.Expense },
    { id: "cat-taxi", name: "Taxi PLN", categoryType: CategoryType.Expense },
  ];

  const mockCategoryMap = new Map(mockCategories.map((c) => [c.id, c]));

  describe("resolveCategoryIdsForTrace", () => {
    it("returns empty array for null or undefined category", () => {
      expect(resolveCategoryIdsForTrace(null)).toEqual([]);
      expect(resolveCategoryIdsForTrace(undefined)).toEqual([]);
      expect(resolveCategoryIdsForTrace({ id: "" })).toEqual([]);
    });

    it("returns single category id for standard expense categories", () => {
      expect(resolveCategoryIdsForTrace({ id: "cat-groceries", name: "Groceries" })).toEqual(["cat-groceries"]);
    });

    it("resolves both parent and children ids for smart groups", () => {
      const smartGroup = {
        id: "smart-transport-taxi",
        name: "Transport (incl. Taxi)",
        isSmartGroup: true,
        children: [
          { id: "cat-transport", name: "Transport PLN" },
          { id: "cat-taxi", name: "Taxi PLN" },
        ],
      };

      const ids = resolveCategoryIdsForTrace(smartGroup);
      expect(ids).toEqual(["smart-transport-taxi", "cat-transport", "cat-taxi"]);
    });

    it("handles smart group with empty or duplicate child ids safely", () => {
      const smartGroup = {
        id: "smart-transport",
        name: "Transport",
        isSmartGroup: true,
        children: [
          { id: "smart-transport", name: "Transport" },
          { id: "cat-taxi", name: "Taxi PLN" },
        ],
      };

      const ids = resolveCategoryIdsForTrace(smartGroup);
      expect(ids).toEqual(["smart-transport", "cat-taxi"]);
    });
  });

  describe("computeAccountBreakdown", () => {
    it("aggregates totals and counts per paying account, sorted by total spend descending", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-1",
          sourceId: "acc-primary-bank",
          destinationId: "cat-groceries",
          destinationAmount: 250,
          dateTimestampISO: "2026-10-10T12:00:00Z",
        },
        {
          id: "tx-2",
          sourceId: "acc-revolut",
          destinationId: "cat-groceries",
          destinationAmount: 600,
          dateTimestampISO: "2026-10-12T12:00:00Z",
        },
        {
          id: "tx-3",
          sourceId: "acc-primary-bank",
          destinationId: "cat-groceries",
          destinationAmount: 150,
          dateTimestampISO: "2026-10-15T12:00:00Z",
        },
        {
          id: "tx-4",
          sourceId: "acc-cash",
          destinationId: "cat-groceries",
          destinationAmount: 50,
          dateTimestampISO: "2026-10-18T12:00:00Z",
        },
      ];

      const breakdown = computeAccountBreakdown(txs, mockCategoryMap);

      expect(breakdown.allTotalSpend).toBe(1050);
      expect(breakdown.allTransactionCount).toBe(4);
      expect(breakdown.accounts).toHaveLength(3);

      // Highest spend first: Revolut (600), Primary Bank (400), Cash (50)
      expect(breakdown.accounts[0]).toEqual({
        accountId: "acc-revolut",
        accountName: "Revolut",
        totalSpend: 600,
        transactionCount: 1,
        icon: "card",
        nativeSpend: 600,
        nativeCurrency: "PLN",
        hasForeignSpend: false,
      });
      expect(breakdown.accounts[1]).toEqual({
        accountId: "acc-primary-bank",
        accountName: "Primary Bank Card",
        totalSpend: 400,
        transactionCount: 2,
        icon: "bank",
        nativeSpend: 400,
        nativeCurrency: "PLN",
        hasForeignSpend: false,
      });
      expect(breakdown.accounts[2]).toEqual({
        accountId: "acc-cash",
        accountName: "Cash Wallet",
        totalSpend: 50,
        transactionCount: 1,
        icon: "cash",
        nativeSpend: 50,
        nativeCurrency: "PLN",
        hasForeignSpend: false,
      });
    });

    it("ignores deleted transactions in breakdown aggregation", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-active",
          sourceId: "acc-revolut",
          destinationAmount: 100,
        },
        {
          id: "tx-deleted",
          sourceId: "acc-revolut",
          destinationAmount: 500,
          deleted: true,
        },
      ];

      const breakdown = computeAccountBreakdown(txs, mockCategoryMap);
      expect(breakdown.allTotalSpend).toBe(100);
      expect(breakdown.allTransactionCount).toBe(1);
      expect(breakdown.accounts[0].totalSpend).toBe(100);
    });

    it("falls back to tx.sourceName or Unknown Account when account category is not in map", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-ext-1",
          sourceId: "acc-external",
          sourceName: "External Card",
          destinationAmount: 85,
        },
        {
          id: "tx-ext-2",
          destinationAmount: 15,
        },
      ];

      const breakdown = computeAccountBreakdown(txs, mockCategoryMap);
      expect(breakdown.allTotalSpend).toBe(100);
      expect(breakdown.accounts.some((a) => a.accountName === "External Card")).toBe(true);
      expect(breakdown.accounts.some((a) => a.accountName === "Unknown Account")).toBe(true);
    });

    it("normalizes multi-currency account spending into reporting currency and retains native subtotals", () => {
      const categories: ExternalProviderCategory[] = [
        { id: "acc-mono", name: "Monobank UAH", categoryType: CategoryType.BankAccount, currencyId: "UAH" },
        { id: "acc-primary-bank", name: "Primary Bank Card", categoryType: CategoryType.BankAccount, currencyId: "PLN" },
      ];
      const currencies: ExternalProviderCurrency[] = [
        { id: "USD", rate: 1 },
        { id: "PLN", rate: 4 },
        { id: "UAH", rate: 41 },
      ];

      const txs: ExternalProviderTransaction[] = [
        { id: "tx-uah", sourceId: "acc-mono", sourceAmount: 410, dateTimestampISO: "2026-10-10T10:00:00Z" },
        { id: "tx-pln", sourceId: "acc-primary-bank", sourceAmount: 100, dateTimestampISO: "2026-10-11T10:00:00Z" },
      ];

      const breakdown = computeAccountBreakdown(txs, categories, "PLN", currencies);
      // 410 UAH = 40 PLN, plus 100 PLN = 140 PLN total
      expect(breakdown.allTotalSpend).toBeCloseTo(140, 2);
      expect(breakdown.accounts).toHaveLength(2);

      const monoAccount = breakdown.accounts.find((a) => a.accountId === "acc-mono");
      expect(monoAccount).toBeDefined();
      expect(monoAccount?.totalSpend).toBeCloseTo(40, 2);
      expect(monoAccount?.nativeSpend).toBe(410);
      expect(monoAccount?.nativeCurrency).toBe("UAH");
      expect(monoAccount?.hasForeignSpend).toBe(true);

      const primaryBankAccount = breakdown.accounts.find((a) => a.accountId === "acc-primary-bank");
      expect(primaryBankAccount).toBeDefined();
      expect(primaryBankAccount?.totalSpend).toBe(100);
      expect(primaryBankAccount?.nativeSpend).toBe(100);
      expect(primaryBankAccount?.nativeCurrency).toBe("PLN");
      expect(primaryBankAccount?.hasForeignSpend).toBe(false);
    });
  });

  describe("filterTransactionsByAccount", () => {
    const txs: ExternalProviderTransaction[] = [
      { id: "tx-1", sourceId: "acc-primary-bank", destinationAmount: 100 },
      { id: "tx-2", sourceId: "acc-revolut", destinationAmount: 200 },
      { id: "tx-3", sourceId: "acc-primary-bank", destinationAmount: 300 },
      { id: "tx-deleted", sourceId: "acc-primary-bank", destinationAmount: 999, deleted: true },
    ];

    it("returns all non-deleted transactions when no account is selected or 'all' is passed", () => {
      expect(filterTransactionsByAccount(txs, null)).toHaveLength(3);
      expect(filterTransactionsByAccount(txs, undefined)).toHaveLength(3);
      expect(filterTransactionsByAccount(txs, "all")).toHaveLength(3);
    });

    it("filters to selected account ID while excluding deleted transactions", () => {
      const filtered = filterTransactionsByAccount(txs, "acc-primary-bank");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(["tx-1", "tx-3"]);
    });

    it("returns empty array when no transactions match the account", () => {
      const filtered = filterTransactionsByAccount(txs, "acc-nonexistent");
      expect(filtered).toEqual([]);
    });
  });

  describe("computePeriodSpendSummary", () => {
    it("computes spend totals and deltas between active and baseline months", () => {
      const active: ExternalProviderTransaction[] = [
        { id: "a1", destinationAmount: 500 },
        { id: "a2", destinationAmount: 300 },
      ];
      const baseline: ExternalProviderTransaction[] = [{ id: "b1", destinationAmount: 400 }];

      const summary = computePeriodSpendSummary(active, baseline);
      expect(summary.activeSpend).toBe(800);
      expect(summary.baselineSpend).toBe(400);
      expect(summary.deltaAbs).toBe(400);
      expect(summary.deltaPercent).toBe(100); // +100%
    });

    it("handles zero baseline spend without dividing by zero", () => {
      const active: ExternalProviderTransaction[] = [{ id: "a1", destinationAmount: 250 }];
      const summary = computePeriodSpendSummary(active, []);

      expect(summary.activeSpend).toBe(250);
      expect(summary.baselineSpend).toBe(0);
      expect(summary.deltaAbs).toBe(250);
      expect(summary.deltaPercent).toBeNull();
    });

    it("correctly calculates negative spend deltas (spending reduction)", () => {
      const active: ExternalProviderTransaction[] = [{ id: "a1", destinationAmount: 300 }];
      const baseline: ExternalProviderTransaction[] = [{ id: "b1", destinationAmount: 600 }];

      const summary = computePeriodSpendSummary(active, baseline);
      expect(summary.activeSpend).toBe(300);
      expect(summary.baselineSpend).toBe(600);
      expect(summary.deltaAbs).toBe(-300);
      expect(summary.deltaPercent).toBe(-50); // -50%
    });

    it("normalizes mixed-currency period transactions for mathematically sound variance calculation", () => {
      const currencies: ExternalProviderCurrency[] = [
        { id: "USD", rate: 1 },
        { id: "PLN", rate: 4 },
        { id: "UAH", rate: 41 },
      ];
      // Active month: 820 UAH (80 PLN) + 20 PLN = 100 PLN
      const active: ExternalProviderTransaction[] = [
        { id: "a1", sourceCurrencyId: "UAH", sourceAmount: 820 },
        { id: "a2", sourceCurrencyId: "PLN", sourceAmount: 20 },
      ];
      // Baseline month: 60 PLN
      const baseline: ExternalProviderTransaction[] = [{ id: "b1", sourceCurrencyId: "PLN", sourceAmount: 60 }];

      const summary = computePeriodSpendSummary(active, baseline, "PLN", currencies);
      expect(summary.activeSpend).toBeCloseTo(100, 2);
      expect(summary.baselineSpend).toBe(60);
      expect(summary.deltaAbs).toBeCloseTo(40, 2);
      expect(summary.deltaPercent).toBeCloseTo(66.67, 1);
    });
  });

  describe("sortTransactionsReverseChronological", () => {
    it("sorts newest transactions first using dateTimestamp and counter", () => {
      const txs: ExternalProviderTransaction[] = [
        { id: "old", dateTimestamp: 1000, counter: 1 },
        { id: "newest", dateTimestamp: 5000, counter: 1 },
        { id: "middle-late", dateTimestamp: 3000, counter: 2 },
        { id: "middle-early", dateTimestamp: 3000, counter: 1 },
      ];

      const sorted = sortTransactionsReverseChronological(txs);
      expect(sorted.map((t) => t.id)).toEqual(["newest", "middle-late", "middle-early", "old"]);
    });

    it("parses ISO date strings when dateTimestamp is absent", () => {
      const txs: ExternalProviderTransaction[] = [
        { id: "tx-oct-1", dateTimestampISO: "2026-10-01T10:00:00Z" },
        { id: "tx-oct-20", dateTimestampISO: "2026-10-20T10:00:00Z" },
        { id: "tx-oct-10", dateTimestampISO: "2026-10-10T10:00:00Z" },
      ];

      const sorted = sortTransactionsReverseChronological(txs);
      expect(sorted.map((t) => t.id)).toEqual(["tx-oct-20", "tx-oct-10", "tx-oct-1"]);
    });
  });

  describe("identifySubcategoryName", () => {
    it("resolves child subcategory from children array in smart group", () => {
      const children = [
        { id: "cat-taxi", name: "Taxi PLN" },
        { id: "cat-transport", name: "Transport PLN" },
      ];

      expect(identifySubcategoryName("cat-taxi", children)).toBe("Taxi PLN");
      expect(identifySubcategoryName("cat-transport", children)).toBe("Transport PLN");
    });

    it("falls back to category map if not in children", () => {
      expect(identifySubcategoryName("cat-groceries", [], mockCategoryMap)).toBe("Groceries");
    });

    it("returns null when destination is undefined or not found", () => {
      expect(identifySubcategoryName(undefined)).toBeNull();
      expect(identifySubcategoryName("cat-unknown", [], mockCategoryMap)).toBeNull();
    });
  });

  describe("resolveTransactionSpend", () => {
    const mockCurrencies: ExternalProviderCurrency[] = [
      { id: "USD", rate: 1 },
      { id: "PLN", rate: 4 },
      { id: "UAH", rate: 41 },
      { id: "EUR", rate: 0.9 },
    ];

    const multiCurrencyCategories: ExternalProviderCategory[] = [
      { id: "acc-mono-uah", name: "Monobank UAH", categoryType: CategoryType.BankAccount, currencyId: "UAH" },
      { id: "acc-primary-bank", name: "Primary Bank Card", categoryType: CategoryType.BankAccount, currencyId: "PLN" },
      { id: "cat-sport-uah", name: "Sport UAH", categoryType: CategoryType.Expense, currencyId: "UAH" },
      { id: "cat-groceries", name: "Groceries", categoryType: CategoryType.Expense, currencyId: "PLN" },
    ];

    it("returns native PLN amounts without conversion", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-pln",
        sourceId: "acc-primary-bank",
        destinationId: "cat-groceries",
        sourceAmount: 120,
        destinationAmount: 120,
      };

      const result = resolveTransactionSpend(tx, "PLN", mockCurrencies, multiCurrencyCategories);
      expect(result.nativeAmount).toBe(120);
      expect(result.nativeCurrency).toBe("PLN");
      expect(result.convertedAmount).toBe(120);
      expect(result.isConverted).toBe(false);
      expect(result.rate).toBe(1);
    });

    it("resolves foreign account currency from category metadata and converts to reporting currency", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-uah",
        sourceId: "acc-mono-uah",
        destinationId: "cat-groceries",
        sourceAmount: 410,
      };

      const result = resolveTransactionSpend(tx, "PLN", mockCurrencies, multiCurrencyCategories);
      expect(result.nativeAmount).toBe(410);
      expect(result.nativeCurrency).toBe("UAH");
      // 410 UAH / 41 * 4 = 40 PLN
      expect(result.convertedAmount).toBeCloseTo(40, 2);
      expect(result.isConverted).toBe(true);
      expect(result.rate).toBeCloseTo(40 / 410, 4);
    });

    it("resolves explicit transaction foreign source currency", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-eur",
        sourceId: "acc-primary-bank",
        destinationId: "cat-groceries",
        sourceCurrencyId: "EUR",
        sourceAmount: 90,
      };

      const result = resolveTransactionSpend(tx, "PLN", mockCurrencies, multiCurrencyCategories);
      expect(result.nativeAmount).toBe(90);
      expect(result.nativeCurrency).toBe("EUR");
      // 90 EUR / 0.9 * 4 = 400 PLN
      expect(result.convertedAmount).toBeCloseTo(400, 2);
      expect(result.isConverted).toBe(true);
    });

    it("resolves foreign destination category currency", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-dest-uah",
        sourceId: "acc-primary-bank",
        destinationId: "cat-sport-uah",
        destinationAmount: 820,
      };

      const result = resolveTransactionSpend(tx, "PLN", mockCurrencies, multiCurrencyCategories);
      expect(result.nativeAmount).toBe(820);
      expect(result.nativeCurrency).toBe("UAH");
      // 820 UAH / 41 * 4 = 80 PLN
      expect(result.convertedAmount).toBeCloseTo(80, 2);
      expect(result.isConverted).toBe(true);
    });

    it("gracefully falls back to native amount when exchange rate is missing", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-chf",
        sourceCurrencyId: "CHF",
        sourceAmount: 50,
      };

      const result = resolveTransactionSpend(tx, "PLN", mockCurrencies, multiCurrencyCategories);
      expect(result.nativeAmount).toBe(50);
      expect(result.nativeCurrency).toBe("CHF");
      expect(result.convertedAmount).toBe(50);
      expect(result.isConverted).toBe(false);
      expect(result.rate).toBeNull();
    });
  });
});
