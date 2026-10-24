import { describe, expect, it } from "vitest";

import {
  computeAccountBreakdown,
  computePeriodSpendSummary,
  filterTransactionsByAccount,
  identifySubcategoryName,
  resolveCategoryIdsForTrace,
  sortTransactionsReverseChronological,
} from "../category-expense-trace-helpers";
import { CategoryType, type ExternalProviderCategory, type ExternalProviderTransaction } from "../external-provider-data";

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
      });
      expect(breakdown.accounts[1]).toEqual({
        accountId: "acc-primary-bank",
        accountName: "Primary Bank Card",
        totalSpend: 400,
        transactionCount: 2,
        icon: "bank",
      });
      expect(breakdown.accounts[2]).toEqual({
        accountId: "acc-cash",
        accountName: "Cash Wallet",
        totalSpend: 50,
        transactionCount: 1,
        icon: "cash",
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
});
