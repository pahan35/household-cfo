import { describe, expect, it } from "vitest";

import {
  archiveAccountCategory,
  archiveIncomeCategory,
  buildFeeTransaction,
  buildFxReconciliationTransaction,
  buildLastTransactionMap,
  buildNewDebtAccountCategory,
  buildPrincipalOutflowTransaction,
  buildSettlementTransaction,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  computeAccountLiquiditySummary,
  computeTransactionsWithRunningBalance,
  convertCurrencyAmount,
  filterAndClassifyAccounts,
  filterAndClassifyCategories,
  filterAndClassifyIncomeSources,
  findAccountsBelowArchived,
  findIncomeSourcesBelowArchived,
  formatThrowawayDebtAccountName,
  getLastTransactionSummaryForCategory,
  isArchivedCategoryName,
  isThrowawayDebtAccount,
  moveAccountsAboveArchived,
  moveIncomeSourcesAboveArchived,
  reorderCategoriesSubset,
  resolveTransactionEndpoints,
  sortCategoriesByOrder,
  toDotNetTicks,
  unarchiveAccountCategory,
  unarchiveIncomeCategory,
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

describe("convertCurrencyAmount", () => {
  const rates = [
    { id: "USD", rate: 1 },
    { id: "PLN", rate: 4 },
    { id: "EUR", rate: 0.5 },
  ];
  it("converts through USD base", () => {
    expect(convertCurrencyAmount(8, "PLN", "USD", rates)).toBeCloseTo(2);
    expect(convertCurrencyAmount(8, "PLN", "EUR", rates)).toBeCloseTo(1);
  });
  it("returns amount for same currency and null for unknown rate", () => {
    expect(convertCurrencyAmount(5, "PLN", "PLN", [])).toBe(5);
    expect(convertCurrencyAmount(5, "GBP", "PLN", rates)).toBeNull();
  });
});

describe("computeAccountLiquiditySummary", () => {
  it("converts, groups by currency and respects exceptFromBalance", () => {
    const cats = [
      { id: "a", name: "A", categoryType: CategoryType.Account, amount: 100, currencyId: "PLN" },
      { id: "b", name: "B", categoryType: CategoryType.BankAccount, amount: 10, currencyId: "USD" },
      {
        id: "c",
        name: "C",
        categoryType: CategoryType.Account,
        amount: 999,
        currencyId: "PLN",
        exceptFromBalance: true,
      },
      {
        id: "d",
        name: "_old",
        categoryType: CategoryType.Account,
        amount: 5,
        currencyId: "PLN",
        exceptFromBalance: true,
      },
    ] as ExternalProviderCategory[];
    const summary = computeAccountLiquiditySummary(cats, [{ id: "PLN", rate: 4 }], "PLN");
    expect(summary.totalNetLiquid).toBeCloseTo(140);
    expect(summary.byCurrency).toEqual([
      { currency: "PLN", balance: 1104 },
      { currency: "USD", balance: 10 },
    ]);
    expect(summary.unreconciledCount).toBe(1);
  });
});

describe("resolveTransactionEndpoints", () => {
  it("falls back to category lookup", () => {
    const map = new Map([
      ["s", { id: "s", name: "Bank", categoryType: CategoryType.BankAccount, currencyId: "EUR" }],
      ["d", { id: "d", name: "Food", categoryType: CategoryType.Expense }],
    ] as [string, ExternalProviderCategory][]);
    const r = resolveTransactionEndpoints({ id: "t", sourceId: "s", destinationId: "d" }, map, "PLN");
    expect(r.sourceName).toBe("Bank");
    expect(r.destinationName).toBe("Food");
    expect(r.sourceCurrency).toBe("EUR");
    expect(r.destinationCurrency).toBe("PLN");
    expect(r.isSourceAccount).toBe(true);
    expect(r.isDestinationAccount).toBe(false);
  });
});

describe("computeTransactionsWithRunningBalance", () => {
  it("walks backwards from live balance", () => {
    const cats = [
      { id: "acc", name: "Acc", categoryType: CategoryType.Account, amount: 70, currencyId: "PLN" },
      { id: "inc", name: "Salary", categoryType: CategoryType.Income },
      { id: "exp", name: "Food", categoryType: CategoryType.Expense },
    ] as ExternalProviderCategory[];
    const txs = [
      { id: "t2", sourceId: "acc", destinationId: "exp", sourceAmount: 30, dateTimestamp: 2000 },
      { id: "t1", sourceId: "inc", destinationId: "acc", destinationAmount: 100, dateTimestamp: 1000 },
    ] as ExternalProviderTransaction[];
    const [first, second] = computeTransactionsWithRunningBalance(txs, cats, "PLN");
    expect(first.direction).toBe("expense");
    expect(first.sourceBalanceAfter).toBe(70);
    expect(second.direction).toBe("income");
    expect(second.destinationBalanceAfter).toBe(100);
  });
});

describe("archiveAccountCategory", () => {
  it("prefixes name with '_' and moves to the end of accounts group with re-indexed orders", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "exp-1", name: "Groceries", categoryType: CategoryType.Expense, order: 0 },
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "Savings", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "_Old Account", categoryType: CategoryType.BankAccount, order: 2 },
    ];

    const result = archiveAccountCategory(categories, "acc-1");

    // Accounts order should be: Checking moved to end -> [Savings (0), _Old Account (1), _Checking (2)]
    const updatedAccounts = result.updatedCategories.filter((c) => c.categoryType === CategoryType.BankAccount);
    expect(updatedAccounts.map((c) => c.name)).toEqual(["Savings", "_Old Account", "_Checking"]);
    expect(updatedAccounts.map((c) => c.order)).toEqual([0, 1, 2]);

    // Expense is preserved untouched
    const exp = result.updatedCategories.find((c) => c.id === "exp-1");
    expect(exp).toBeDefined();

    // Modified categories should include all shifted/renamed accounts
    expect(result.modifiedCategories.map((c) => c.id)).toEqual(["acc-2", "acc-3", "acc-1"]);
    const archived = result.modifiedCategories.find((c) => c.id === "acc-1");
    expect(archived?.name).toBe("_Checking");
    expect(archived?.order).toBe(2);
  });

  it("handles accounts already prefixed with underscores gracefully", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "_AlreadyArchived", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "Active", categoryType: CategoryType.BankAccount, order: 1 },
    ];

    const result = archiveAccountCategory(categories, "acc-1");
    const updated = result.updatedCategories.filter((c) => c.categoryType === CategoryType.BankAccount);
    expect(updated.map((c) => c.name)).toEqual(["Active", "_AlreadyArchived"]);
    expect(updated.map((c) => c.order)).toEqual([0, 1]);
  });

  it("returns unchanged categories when account is not found", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
    ];

    const result = archiveAccountCategory(categories, "non-existent");
    expect(result.modifiedCategories).toEqual([]);
    expect(result.updatedCategories).toEqual(categories);
  });
});

describe("unarchiveAccountCategory", () => {
  it("strips leading '_' and places as the last non-archived account before first archived", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Active 1", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "Active 2", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "_Archived 1", categoryType: CategoryType.BankAccount, order: 2 },
      { id: "acc-4", name: "_TargetArchived", categoryType: CategoryType.BankAccount, order: 3 },
      { id: "acc-5", name: "_Archived 2", categoryType: CategoryType.BankAccount, order: 4 },
    ];

    const result = unarchiveAccountCategory(categories, "acc-4");

    const updated = result.updatedCategories;
    expect(updated.map((c) => c.name)).toEqual([
      "Active 1",
      "Active 2",
      "TargetArchived",
      "_Archived 1",
      "_Archived 2",
    ]);
    expect(updated.map((c) => c.order)).toEqual([0, 1, 2, 3, 4]);

    const target = result.modifiedCategories.find((c) => c.id === "acc-4");
    expect(target?.name).toBe("TargetArchived");
    expect(target?.order).toBe(2);
  });

  it("places at the end of accounts group when no other archived accounts exist", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Active 1", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_SoleArchived", categoryType: CategoryType.BankAccount, order: 1 },
    ];

    const result = unarchiveAccountCategory(categories, "acc-2");
    const updated = result.updatedCategories;
    expect(updated.map((c) => c.name)).toEqual(["Active 1", "SoleArchived"]);
    expect(updated.map((c) => c.order)).toEqual([0, 1]);
    expect(result.modifiedCategories.length).toBe(1);
    expect(result.modifiedCategories[0].name).toBe("SoleArchived");
  });

  it("returns unchanged categories when target account is not found", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "_Archived", categoryType: CategoryType.BankAccount, order: 0 },
    ];

    const result = unarchiveAccountCategory(categories, "missing");
    expect(result.modifiedCategories).toEqual([]);
    expect(result.updatedCategories).toEqual(categories);
  });
});

describe("findAccountsBelowArchived", () => {
  it("identifies active accounts positioned below the first archived account", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "Cash", categoryType: CategoryType.Account, order: 2 },
      { id: "acc-4", name: "_Archived2", categoryType: CategoryType.BankAccount, order: 3 },
      { id: "acc-5", name: "Revolut", categoryType: CategoryType.BankAccount, order: 4 },
    ];

    const below = findAccountsBelowArchived(categories);
    expect(below.map((c) => c.id)).toEqual(["acc-3", "acc-5"]);
  });

  it("returns empty array when no archived accounts exist", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "Savings", categoryType: CategoryType.BankAccount, order: 1 },
    ];

    expect(findAccountsBelowArchived(categories)).toEqual([]);
  });

  it("returns empty array when all accounts after the first archived are also archived", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "_Archived2", categoryType: CategoryType.BankAccount, order: 2 },
    ];

    expect(findAccountsBelowArchived(categories)).toEqual([]);
  });
});

describe("moveAccountsAboveArchived", () => {
  it("moves all misplaced active accounts above the first archived account preserving relative order in batch mode", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "Cash", categoryType: CategoryType.Account, order: 2 },
      { id: "acc-4", name: "_Archived2", categoryType: CategoryType.BankAccount, order: 3 },
      { id: "acc-5", name: "Revolut", categoryType: CategoryType.BankAccount, order: 4 },
    ];

    const result = moveAccountsAboveArchived(categories);
    expect(result.updatedCategories.map((c) => c.name)).toEqual([
      "Checking",
      "Cash",
      "Revolut",
      "_Archived1",
      "_Archived2",
    ]);
    expect(result.updatedCategories.map((c) => c.order)).toEqual([0, 1, 2, 3, 4]);
    expect(result.modifiedCategories.map((c) => c.name)).toEqual(["Cash", "Revolut", "_Archived1", "_Archived2"]);
  });

  it("moves a single specified account above the first archived account", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "Cash", categoryType: CategoryType.Account, order: 2 },
      { id: "acc-4", name: "_Archived2", categoryType: CategoryType.BankAccount, order: 3 },
      { id: "acc-5", name: "Revolut", categoryType: CategoryType.BankAccount, order: 4 },
    ];

    const result = moveAccountsAboveArchived(categories, ["acc-5"]);
    expect(result.updatedCategories.map((c) => c.name)).toEqual([
      "Checking",
      "Revolut",
      "_Archived1",
      "Cash",
      "_Archived2",
    ]);
    expect(result.updatedCategories.map((c) => c.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns unchanged when no accounts are below archived", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
    ];

    const result = moveAccountsAboveArchived(categories);
    expect(result.modifiedCategories).toEqual([]);
    expect(result.updatedCategories).toEqual(categories);
  });

  it("returns unchanged when specified accountIds are already above archived", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "_Archived1", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "Cash", categoryType: CategoryType.Account, order: 2 },
    ];

    const result = moveAccountsAboveArchived(categories, ["acc-1"]);
    expect(result.modifiedCategories).toEqual([]);
    expect(result.updatedCategories).toEqual(categories);
  });
});

describe("formatThrowawayDebtAccountName", () => {
  it("formats bare names directly without artificial prefixes", () => {
    expect(formatThrowawayDebtAccountName("Alex")).toBe("Alex");
    expect(formatThrowawayDebtAccountName("Laptop Deal")).toBe("Laptop Deal");
  });

  it("normalizes names that already contain 'Debt:' or leading underscores", () => {
    expect(formatThrowawayDebtAccountName("Debt: Alex")).toBe("Alex");
    expect(formatThrowawayDebtAccountName("debt: Alex")).toBe("Alex");
    expect(formatThrowawayDebtAccountName("_Debt: Alex")).toBe("Alex");
    expect(formatThrowawayDebtAccountName("___debt:  Alex  ")).toBe("Alex");
    expect(formatThrowawayDebtAccountName("_Alex")).toBe("Alex");
  });

  it("falls back to 'Debt' if input is empty or whitespace", () => {
    expect(formatThrowawayDebtAccountName("")).toBe("Debt");
    expect(formatThrowawayDebtAccountName("   ")).toBe("Debt");
  });
});

describe("isThrowawayDebtAccount", () => {
  it("identifies active and archived native debt accounts by categoryType 5", () => {
    expect(
      isThrowawayDebtAccount({
        id: "1",
        name: "Alex",
        categoryType: CategoryType.DebtAccount,
      }),
    ).toBe(true);

    expect(
      isThrowawayDebtAccount({
        id: "2",
        name: "_Alex",
        categoryType: CategoryType.DebtAccount,
      }),
    ).toBe(true);

    expect(
      isThrowawayDebtAccount({
        id: "3",
        name: "Laptop Deal",
        categoryType: 5,
      }),
    ).toBe(true);
  });

  it("returns false for non-debt accounts or non-account categories", () => {
    expect(
      isThrowawayDebtAccount({
        id: "4",
        name: "Debt: Alex",
        categoryType: CategoryType.Account, // synthetic prefix without native enum is not recognized
      }),
    ).toBe(false);

    expect(
      isThrowawayDebtAccount({
        id: "5",
        name: "Alex",
        categoryType: CategoryType.Expense,
      }),
    ).toBe(false);

    expect(
      isThrowawayDebtAccount({
        id: "6",
        name: "Alex",
        categoryType: CategoryType.DebtAccount,
        deleted: true,
      }),
    ).toBe(false);

    expect(isThrowawayDebtAccount(null)).toBe(false);
  });
});

describe("toDotNetTicks", () => {
  it("converts Date to .NET DateTime ticks formula", () => {
    // 1970-01-01T00:00:00.000Z is 0 ms epoch
    const epoch = new Date("1970-01-01T00:00:00.000Z");
    expect(toDotNetTicks(epoch)).toBe(621355968000000000);

    // 1 ms later
    const plus1ms = new Date(1);
    expect(toDotNetTicks(plus1ms)).toBe(621355968000010000);
  });
});

describe("buildNewDebtAccountCategory", () => {
  it("creates native CategoryType.DebtAccount inserted immediately before the first archived account", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
      { id: "acc-2", name: "Savings", categoryType: CategoryType.BankAccount, order: 1 },
      { id: "acc-3", name: "_ArchivedOld", categoryType: CategoryType.Account, order: 2 },
    ];

    const result = buildNewDebtAccountCategory(categories, {
      name: "Alex",
      currencyId: "USD",
      id: "debt-alex-1",
    });

    expect(result.newAccount.name).toBe("Alex");
    expect(result.newAccount.categoryType).toBe(CategoryType.DebtAccount);
    expect(result.newAccount.icon).toBe("debt");
    expect(result.newAccount.exceptFromBalance).toBe(true);
    expect(result.newAccount.currencyId).toBe("USD");
    expect(result.newAccount.amount).toBe(0);
    expect(result.newAccount.order).toBe(2);

    expect(result.updatedCategories.map((c) => ({ name: c.name, order: c.order }))).toEqual([
      { name: "Checking", order: 0 },
      { name: "Savings", order: 1 },
      { name: "Alex", order: 2 },
      { name: "_ArchivedOld", order: 3 },
    ]);

    expect(result.modifiedCategories.map((c) => c.name)).toContain("Alex");
    expect(result.modifiedCategories.map((c) => c.name)).toContain("_ArchivedOld");
  });

  it("normalizes prefixed user input and respects explicit exceptFromBalance option", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Cash", categoryType: CategoryType.Account, order: 0 },
    ];

    const result = buildNewDebtAccountCategory(categories, {
      name: "  _Debt: Laptop Deal  ",
      currencyId: "EUR",
      exceptFromBalance: false,
      id: "debt-deal-2",
    });

    expect(result.newAccount.name).toBe("Laptop Deal");
    expect(result.newAccount.categoryType).toBe(CategoryType.DebtAccount);
    expect(result.newAccount.exceptFromBalance).toBe(false);
    expect(result.newAccount.order).toBe(1);
    expect(result.updatedCategories.map((c) => c.name)).toEqual(["Cash", "Laptop Deal"]);
  });
});

describe("archiveAccountCategory with exceptFromBalance", () => {
  it("updates exceptFromBalance to true when specified in options", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Main", categoryType: CategoryType.Account, order: 0 },
      { id: "debt-1", name: "Alex", categoryType: CategoryType.DebtAccount, order: 1, exceptFromBalance: false },
    ];

    const result = archiveAccountCategory(categories, "debt-1", { exceptFromBalance: true });
    const archived = result.updatedCategories.find((c) => c.id === "debt-1");

    expect(archived?.name).toBe("_Alex");
    expect(archived?.exceptFromBalance).toBe(true);
    expect(result.modifiedCategories.some((c) => c.id === "debt-1" && c.exceptFromBalance === true)).toBe(true);
  });
});

describe("Clearing Transaction Builders", () => {
  const sourceAccount: ExternalProviderCategory = {
    id: "card-pln",
    name: "PLN Card",
    categoryType: CategoryType.BankAccount,
    currencyId: "PLN",
  };

  const debtAccount: ExternalProviderCategory = {
    id: "debt-alex",
    name: "Alex",
    categoryType: CategoryType.DebtAccount,
    currencyId: "USD",
  };

  const feeCategory: ExternalProviderCategory = {
    id: "cat-fees",
    name: "Bank Fees",
    categoryType: CategoryType.Expense,
    currencyId: "PLN",
  };

  const expenseCategory: ExternalProviderCategory = {
    id: "cat-taxi",
    name: "Taxi / Delivery",
    categoryType: CategoryType.Expense,
    currencyId: "PLN",
  };

  const familyAccount: ExternalProviderCategory = {
    id: "acc-wife",
    name: "Wife Card",
    categoryType: CategoryType.BankAccount,
    currencyId: "UAH",
  };

  describe("buildPrincipalOutflowTransaction", () => {
    it("builds a transfer from personal account to debt account with complete timestamps and flags", () => {
      const tx = buildPrincipalOutflowTransaction({
        id: "tx-outflow-1",
        date: "2026-10-15",
        sourceAccount,
        debtAccount,
        sourceAmount: 1000,
        destinationAmount: 250,
        comment: "Monitor purchase",
      });

      expect(tx.id).toBe("tx-outflow-1");
      expect(tx.sourceId).toBe("card-pln");
      expect(tx.sourceType).toBe(CategoryType.BankAccount);
      expect(tx.sourceAmount).toBe(1000);
      expect(tx.sourceCurrencyId).toBe("PLN");
      expect(tx.destinationId).toBe("debt-alex");
      expect(tx.destinationType).toBe(CategoryType.DebtAccount);
      expect(tx.destinationAmount).toBe(250);
      expect(tx.destinationCurrencyId).toBe("USD");
      expect(tx.comment).toBe("Monitor purchase");
      expect(tx.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 15))));
      expect(tx.dateTimestampISO).toBe("2026-10-15T00:00:00.000Z");
      expect(tx.createdTimestamp).toBeGreaterThan(0);
      expect(tx.timestamp).toBeGreaterThan(0);
      expect(tx.isComplete).toBe(true);
      expect(tx.debtPaymentAmount).toBe(0);
    });
  });

  describe("buildFeeTransaction", () => {
    it("builds debtor-absorbed fee as transfer to debt account with complete timestamps", () => {
      const tx = buildFeeTransaction({
        date: "2026-10-20",
        sourceAccount,
        debtAccount,
        absorbedBy: "debtor",
        feeAmount: 120,
        convertedFeeAmount: 30,
        comment: "Wire fee (debtor)",
      });

      expect(tx.sourceId).toBe("card-pln");
      expect(tx.destinationId).toBe("debt-alex");
      expect(tx.destinationType).toBe(CategoryType.DebtAccount);
      expect(tx.sourceAmount).toBe(120);
      expect(tx.destinationAmount).toBe(30);
      expect(tx.comment).toBe("Wire fee (debtor)");
      expect(tx.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 20))));
      expect(tx.dateTimestampISO).toBe("2026-10-20T00:00:00.000Z");
      expect(tx.isComplete).toBe(true);
      expect(tx.debtPaymentAmount).toBe(0);
    });

    it("builds user-absorbed fee as expense to fee expense category with complete timestamps", () => {
      const tx = buildFeeTransaction({
        date: "2026-10-20",
        sourceAccount,
        debtAccount,
        feeExpenseCategory: feeCategory,
        absorbedBy: "me",
        feeAmount: 120,
        comment: "Wire fee (absorbed by me)",
      });

      expect(tx.sourceId).toBe("card-pln");
      expect(tx.destinationId).toBe("cat-fees");
      expect(tx.destinationType).toBe(CategoryType.Expense);
      expect(tx.sourceAmount).toBe(120);
      expect(tx.destinationAmount).toBe(120);
      expect(tx.comment).toBe("Wire fee (absorbed by me)");
      expect(tx.isComplete).toBe(true);
      expect(tx.debtPaymentAmount).toBe(0);
    });
  });

  describe("buildSettlementTransaction", () => {
    it("builds Case A shared expense settlement from debt account to expense category", () => {
      const tx = buildSettlementTransaction({
        date: "2026-10-18",
        debtAccount,
        destinationCategory: expenseCategory,
        deductedDebtAmount: 20,
        settledAmount: 80,
        comment: "Taxi dinner share",
      });

      expect(tx.sourceId).toBe("debt-alex");
      expect(tx.sourceType).toBe(CategoryType.DebtAccount);
      expect(tx.sourceAmount).toBe(20);
      expect(tx.destinationId).toBe("cat-taxi");
      expect(tx.destinationType).toBe(CategoryType.Expense);
      expect(tx.destinationAmount).toBe(80);
      expect(tx.destinationCurrencyId).toBe("PLN");
      expect(tx.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 18))));
      expect(tx.isComplete).toBe(true);
      expect(tx.debtPaymentAmount).toBe(0);
    });

    it("builds Case C transfer settlement from debt account to family account", () => {
      const tx = buildSettlementTransaction({
        date: "2026-10-21",
        debtAccount,
        destinationCategory: familyAccount,
        deductedDebtAmount: 150,
        settledAmount: 6200,
        comment: "Repayment to wife card",
      });

      expect(tx.sourceId).toBe("debt-alex");
      expect(tx.sourceType).toBe(CategoryType.DebtAccount);
      expect(tx.sourceAmount).toBe(150);
      expect(tx.destinationId).toBe("acc-wife");
      expect(tx.destinationType).toBe(CategoryType.BankAccount);
      expect(tx.destinationAmount).toBe(6200);
      expect(tx.destinationCurrencyId).toBe("UAH");
      expect(tx.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 21))));
      expect(tx.isComplete).toBe(true);
      expect(tx.debtPaymentAmount).toBe(0);
    });
  });

  describe("buildFxReconciliationTransaction", () => {
    it("returns null if balance is already 0", () => {
      expect(
        buildFxReconciliationTransaction({
          debtAccount,
          balance: 0,
          reconciliationCategory: feeCategory,
        }),
      ).toBeNull();

      expect(
        buildFxReconciliationTransaction({
          debtAccount,
          balance: 0.002,
          reconciliationCategory: feeCategory,
        }),
      ).toBeNull();
    });

    it("builds expense adjustment when balance > 0 (forgiven remainder / FX loss)", () => {
      const tx = buildFxReconciliationTransaction({
        date: "2026-10-24",
        debtAccount,
        balance: 1.45,
        reconciliationCategory: feeCategory,
      });

      expect(tx).not.toBeNull();
      expect(tx?.sourceId).toBe("debt-alex");
      expect(tx?.sourceType).toBe(CategoryType.DebtAccount);
      expect(tx?.destinationId).toBe("cat-fees");
      expect(tx?.sourceAmount).toBe(1.45);
      expect(tx?.destinationAmount).toBe(1.45);
      expect(tx?.destinationType).toBe(CategoryType.Expense);
      expect(tx?.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 24))));
      expect(tx?.isComplete).toBe(true);
      expect(tx?.debtPaymentAmount).toBe(0);
    });

    it("builds income adjustment when balance < 0 (FX gain / overpayment)", () => {
      const incomeCategory: ExternalProviderCategory = {
        id: "cat-fx-gain",
        name: "FX Gain",
        categoryType: CategoryType.Income,
        currencyId: "USD",
      };

      const tx = buildFxReconciliationTransaction({
        date: "2026-10-24",
        debtAccount,
        balance: -2.1,
        reconciliationCategory: incomeCategory,
      });

      expect(tx).not.toBeNull();
      expect(tx?.sourceId).toBe("cat-fx-gain");
      expect(tx?.sourceType).toBe(CategoryType.Income);
      expect(tx?.destinationId).toBe("debt-alex");
      expect(tx?.destinationType).toBe(CategoryType.DebtAccount);
      expect(tx?.sourceAmount).toBe(2.1);
      expect(tx?.destinationAmount).toBe(2.1);
      expect(tx?.dateTimestamp).toBe(toDotNetTicks(new Date(Date.UTC(2026, 9, 24))));
      expect(tx?.isComplete).toBe(true);
      expect(tx?.debtPaymentAmount).toBe(0);
    });
  });

  describe("Income Source Category Operations", () => {
    const incomeCategories: ExternalProviderCategory[] = [
      { id: "inc-1", name: "Salary", categoryType: CategoryType.Income, order: 0, limitAmount: 20000 },
      { id: "inc-2", name: "Consulting", categoryType: CategoryType.Income, order: 1, limitAmount: 5000 },
      { id: "inc-3", name: "_Old Project", categoryType: CategoryType.Income, order: 2, limitAmount: 0 },
      { id: "inc-4", name: "Dividends", categoryType: CategoryType.Income, order: 3, limitAmount: 1000 },
    ];

    it("reorderCategoriesSubset automatically isolates and reorders CategoryType.Income", () => {
      // Reorder Salary and Consulting and Dividends: [Dividends, Salary, Consulting]
      const mixedCategories: ExternalProviderCategory[] = [
        { id: "acc-1", name: "Bank", categoryType: CategoryType.BankAccount, order: 0 },
        ...incomeCategories,
        { id: "exp-1", name: "Food", categoryType: CategoryType.Expense, order: 0 },
      ];

      const result = reorderCategoriesSubset(mixedCategories, ["inc-4", "inc-1", "inc-2"]);
      const incomeSubset = result.updatedCategories.filter((c) => Number(c.categoryType) === CategoryType.Income);

      expect(incomeSubset.map((c) => ({ id: c.id, order: c.order }))).toEqual([
        { id: "inc-4", order: 0 },
        { id: "inc-1", order: 1 },
        { id: "inc-3", order: 2 }, // preserved slot
        { id: "inc-2", order: 3 },
      ]);
    });

    it("filterAndClassifyIncomeSources hides archived items unless showArchived is true", () => {
      const activeOnly = filterAndClassifyIncomeSources(incomeCategories);
      expect(activeOnly.map((c) => c.source.id)).toEqual(["inc-1", "inc-2", "inc-4"]);
      expect(activeOnly.every((c) => !c.isArchived)).toBe(true);

      const withArchived = filterAndClassifyIncomeSources(incomeCategories, { showArchived: true });
      expect(withArchived.map((c) => c.source.id)).toEqual(["inc-1", "inc-2", "inc-3", "inc-4"]);
      const archivedItem = withArchived.find((c) => c.source.id === "inc-3");
      expect(archivedItem?.isArchived).toBe(true);
    });

    it("archiveIncomeCategory prefixes name with _ and places at end of income group", () => {
      const result = archiveIncomeCategory(incomeCategories, "inc-2");
      const incomeSubset = result.updatedCategories.filter((c) => Number(c.categoryType) === CategoryType.Income);

      expect(incomeSubset.map((c) => ({ id: c.id, name: c.name, order: c.order }))).toEqual([
        { id: "inc-1", name: "Salary", order: 0 },
        { id: "inc-3", name: "_Old Project", order: 1 },
        { id: "inc-4", name: "Dividends", order: 2 },
        { id: "inc-2", name: "_Consulting", order: 3 },
      ]);
      expect(result.modifiedCategories.some((c) => c.id === "inc-2" && c.name === "_Consulting")).toBe(true);
    });

    it("unarchiveIncomeCategory strips leading _ and positions before first archived income source", () => {
      const categoriesWithArchived: ExternalProviderCategory[] = [
        { id: "inc-1", name: "Salary", categoryType: CategoryType.Income, order: 0 },
        { id: "inc-2", name: "Dividends", categoryType: CategoryType.Income, order: 1 },
        { id: "inc-3", name: "_Old Client", categoryType: CategoryType.Income, order: 2 },
        { id: "inc-4", name: "_Inactive Freelance", categoryType: CategoryType.Income, order: 3 },
      ];

      // Unarchive inc-4
      const result = unarchiveIncomeCategory(categoriesWithArchived, "inc-4");
      const incomeSubset = result.updatedCategories.filter((c) => Number(c.categoryType) === CategoryType.Income);

      expect(incomeSubset.map((c) => ({ id: c.id, name: c.name, order: c.order }))).toEqual([
        { id: "inc-1", name: "Salary", order: 0 },
        { id: "inc-2", name: "Dividends", order: 1 },
        { id: "inc-4", name: "Inactive Freelance", order: 2 }, // inserted before first archived (inc-3)
        { id: "inc-3", name: "_Old Client", order: 3 },
      ]);
      expect(result.modifiedCategories.some((c) => c.id === "inc-4" && c.name === "Inactive Freelance")).toBe(true);
    });

    it("findIncomeSourcesBelowArchived and moveIncomeSourcesAboveArchived restores correct order", () => {
      const misordered: ExternalProviderCategory[] = [
        { id: "inc-1", name: "Salary", categoryType: CategoryType.Income, order: 0 },
        { id: "inc-arch", name: "_Archived Source", categoryType: CategoryType.Income, order: 1 },
        { id: "inc-2", name: "New Client", categoryType: CategoryType.Income, order: 2 }, // Active below archived!
      ];

      const below = findIncomeSourcesBelowArchived(misordered);
      expect(below.map((c) => c.id)).toEqual(["inc-2"]);

      const fixed = moveIncomeSourcesAboveArchived(misordered);
      const incomeSubset = fixed.updatedCategories.filter((c) => Number(c.categoryType) === CategoryType.Income);
      expect(incomeSubset.map((c) => ({ id: c.id, name: c.name, order: c.order }))).toEqual([
        { id: "inc-1", name: "Salary", order: 0 },
        { id: "inc-2", name: "New Client", order: 1 },
        { id: "inc-arch", name: "_Archived Source", order: 2 },
      ]);
    });
  });
});
