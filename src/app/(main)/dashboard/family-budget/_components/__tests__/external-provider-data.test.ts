import { describe, expect, it } from "vitest";

import {
  buildLastTransactionMap,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  filterAndClassifyAccounts,
  filterAndClassifyCategories,
  getLastTransactionSummaryForCategory,
  isArchivedCategoryName,
  reorderCategoriesSubset,
  sortCategoriesByOrder,
} from "../external-provider-data";

describe("sortCategoriesByOrder", () => {
  it("sorts categories ascending by category.order", () => {
    const categories: Partial<ExternalProviderCategory>[] = [
      { id: "c3", name: "Savings", order: 3 },
      { id: "c1", name: "Main Bank", order: 1 },
      { id: "c2", name: "Cash", order: 2 },
    ];

    const sorted = sortCategoriesByOrder(categories as ExternalProviderCategory[]);
    expect(sorted.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("handles missing order values and tie-breaks by id", () => {
    const categories: Partial<ExternalProviderCategory>[] = [
      { id: "b", name: "Beta" },
      { id: "a", name: "Alpha" },
      { id: "c", name: "Gamma", order: 1 },
    ];

    const sorted = sortCategoriesByOrder(categories as ExternalProviderCategory[]);
    expect(sorted.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("reorderCategoriesSubset", () => {
  it("reorders a full list of categories and normalizes orders sequentially", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Cash", categoryType: CategoryType.Account, order: 0 },
      { id: "acc-2", name: "Bank", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "Revolut", categoryType: CategoryType.BankAccount, order: 2 },
    ];

    // Move Revolut (acc-3) to the top: [acc-3, acc-1, acc-2]
    const result = reorderCategoriesSubset(categories, ["acc-3", "acc-1", "acc-2"]);

    expect(result.updatedCategories.map((c) => ({ id: c.id, order: c.order }))).toEqual([
      { id: "acc-3", order: 0 },
      { id: "acc-1", order: 1 },
      { id: "acc-2", order: 2 },
    ]);

    expect(result.modifiedCategories.map((c) => ({ id: c.id, order: c.order }))).toEqual([
      { id: "acc-3", order: 0 },
      { id: "acc-1", order: 1 },
      { id: "acc-2", order: 2 },
    ]);
  });

  it("reorders a visible subset without scrambling hidden items in intermediate slots", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "a", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "b", name: "Credit Card", categoryType: CategoryType.DebtAccount, order: 1 },
      { id: "_c", name: "_Old Account", categoryType: CategoryType.Account, order: 2, amount: 0 }, // hidden
      { id: "d", name: "Savings", categoryType: CategoryType.BankAccount, order: 3 },
    ];

    // Visible: ["a", "b", "d"]. User moves "d" before "a": ["d", "a", "b"].
    const result = reorderCategoriesSubset(categories, ["d", "a", "b"]);

    // Slot 0 -> d (order 0)
    // Slot 1 -> a (order 1)
    // Slot 2 -> _c (order 2, preserved in its slot!)
    // Slot 3 -> b (order 3)
    expect(result.updatedCategories.map((c) => ({ id: c.id, order: c.order }))).toEqual([
      { id: "d", order: 0 },
      { id: "a", order: 1 },
      { id: "_c", order: 2 },
      { id: "b", order: 3 },
    ]);

    // _c remained order: 2, so only d, a, and b changed
    expect(result.modifiedCategories.map((c) => ({ id: c.id, order: c.order }))).toEqual([
      { id: "d", order: 0 },
      { id: "a", order: 1 },
      { id: "b", order: 3 },
    ]);
  });
});

describe("isArchivedCategoryName", () => {
  it("identifies names starting with underscore as archived", () => {
    expect(isArchivedCategoryName("_Old Cash")).toBe(true);
    expect(isArchivedCategoryName(" _Legacy Bank ")).toBe(true);
    expect(isArchivedCategoryName("Main Checking")).toBe(false);
    expect(isArchivedCategoryName("")).toBe(false);
    expect(isArchivedCategoryName(null)).toBe(false);
  });
});

describe("filterAndClassifyAccounts", () => {
  const accounts: ExternalProviderCategory[] = [
    { id: "acc-1", name: "Main Bank", categoryType: CategoryType.BankAccount, amount: 2500, order: 0 },
    { id: "acc-2", name: "_Old Bank Zero", categoryType: CategoryType.BankAccount, amount: 0, order: 1 },
    { id: "acc-3", name: "_Old Card Leftover", categoryType: CategoryType.DebtAccount, amount: -45.5, order: 2 },
    { id: "acc-4", name: "Wallet Cash", categoryType: CategoryType.Account, amount: 120, order: 3 },
  ];

  it("hides zero-balance '_' accounts by default and keeps non-zero '_' accounts visible with warning", () => {
    const classified = filterAndClassifyAccounts(accounts, { showArchived: false });

    // Should include acc-1, acc-3 (unreconciled non-zero), and acc-4. acc-2 (zero balance) is hidden.
    expect(classified.map((c) => c.account.id)).toEqual(["acc-1", "acc-3", "acc-4"]);

    const unreconciled = classified.find((c) => c.account.id === "acc-3");
    expect(unreconciled?.isArchived).toBe(true);
    expect(unreconciled?.hasUnreconciledBalance).toBe(true);
    expect(unreconciled?.isZeroBalance).toBe(false);
  });

  it("reveals zero-balance '_' accounts when showArchived is true", () => {
    const classified = filterAndClassifyAccounts(accounts, { showArchived: true });

    expect(classified.map((c) => c.account.id)).toEqual(["acc-1", "acc-2", "acc-3", "acc-4"]);

    const zeroArchived = classified.find((c) => c.account.id === "acc-2");
    expect(zeroArchived?.isArchived).toBe(true);
    expect(zeroArchived?.hasUnreconciledBalance).toBe(false);
    expect(zeroArchived?.isZeroBalance).toBe(true);
  });
});

describe("filterAndClassifyCategories", () => {
  it("filters inactive '_' categories when showArchived is false", () => {
    const items = [
      { id: "c1", name: "Groceries", current: 800, limit: 1000 },
      { id: "c2", name: "_Old Hobby", current: 0, limit: 0 },
      { id: "c3", name: "_Legacy Travel", current: 150, limit: 0 },
    ];

    const result = filterAndClassifyCategories(items, { showArchived: false });
    // c1 is active & unarchived; c2 is inactive & archived (hidden); c3 is active & archived (shown)
    expect(result.map((r) => r.item.id)).toEqual(["c1", "c3"]);
  });

  it("shows all '_' categories when showArchived is true", () => {
    const items = [
      { id: "c1", name: "Groceries", current: 800, limit: 1000 },
      { id: "c2", name: "_Old Hobby", current: 0, limit: 0 },
    ];

    const result = filterAndClassifyCategories(items, { showArchived: true });
    expect(result.map((r) => r.item.id)).toEqual(["c1", "c2"]);
  });
});

describe("last transaction indexing & summary", () => {
  const mockTransactions: ExternalProviderTransaction[] = [
    {
      id: "tx-older",
      sourceId: "acc-bank",
      sourceName: "Main Bank",
      sourceType: CategoryType.BankAccount,
      sourceAmount: 100,
      sourceCurrencyId: "PLN",
      destinationId: "cat-groceries",
      destinationName: "Groceries",
      destinationType: CategoryType.Expense,
      destinationAmount: 100,
      dateTimestampISO: "2026-10-20T10:00:00Z",
      dateTimestamp: 1792490400000,
      comment: "  Weekly supermarket run  ",
      tags: ["food", "groceries"],
    },
    {
      id: "tx-deleted",
      sourceId: "acc-bank",
      destinationId: "cat-groceries",
      deleted: true,
      dateTimestampISO: "2026-10-23T12:00:00Z",
      dateTimestamp: 1792756800000,
      sourceAmount: 500,
    },
    {
      id: "tx-transfer-newer",
      sourceId: "acc-bank",
      sourceName: "Main Bank",
      sourceType: CategoryType.BankAccount,
      sourceAmount: 200,
      sourceCurrencyId: "PLN",
      destinationId: "acc-cash",
      destinationName: "Wallet Cash",
      destinationType: CategoryType.Account,
      destinationAmount: 200,
      destinationCurrencyId: "PLN",
      dateTimestampISO: "2026-10-22T14:30:00Z",
      dateTimestamp: 1792679400000,
      comment: "ATM withdrawal",
      tags: [],
    },
  ];

  it("extracts counterpart and direction correctly from source perspective", () => {
    const summary = getLastTransactionSummaryForCategory("acc-bank", mockTransactions[2]);
    expect(summary).not.toBeNull();
    expect(summary?.counterpartLabel).toBe("To");
    expect(summary?.counterpartName).toBe("Wallet Cash");
    expect(summary?.direction).toBe("transfer");
    expect(summary?.amount).toBe(200);
    expect(summary?.currency).toBe("PLN");
    expect(summary?.comment).toBe("ATM withdrawal");
  });

  it("extracts counterpart and direction correctly from destination perspective", () => {
    const summary = getLastTransactionSummaryForCategory("acc-cash", mockTransactions[2]);
    expect(summary).not.toBeNull();
    expect(summary?.counterpartLabel).toBe("From");
    expect(summary?.counterpartName).toBe("Main Bank");
    expect(summary?.direction).toBe("transfer");
    expect(summary?.amount).toBe(200);
  });

  it("builds lookup map excluding deleted transactions and picking the newest entry per category", () => {
    const map = buildLastTransactionMap(mockTransactions);

    // acc-bank's newest non-deleted tx is tx-transfer-newer
    const bankSummary = map.get("acc-bank");
    expect(bankSummary?.transactionId).toBe("tx-transfer-newer");
    expect(bankSummary?.counterpartLabel).toBe("To");
    expect(bankSummary?.counterpartName).toBe("Wallet Cash");

    // cat-groceries has tx-older (tx-deleted is skipped)
    const groceriesSummary = map.get("cat-groceries");
    expect(groceriesSummary?.transactionId).toBe("tx-older");
    expect(groceriesSummary?.counterpartLabel).toBe("From");
    expect(groceriesSummary?.counterpartName).toBe("Main Bank");
    expect(groceriesSummary?.direction).toBe("expense");
    expect(groceriesSummary?.comment).toBe("Weekly supermarket run");
    expect(groceriesSummary?.tags).toEqual(["food", "groceries"]);
  });
});
