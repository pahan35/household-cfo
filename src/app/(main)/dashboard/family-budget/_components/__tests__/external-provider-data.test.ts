import { describe, expect, it } from "vitest";

import {
  archiveAccountCategory,
  archiveExpenseCategory,
  archiveIncomeCategory,
  buildCategoryNormalizationPlan,
  buildCategoryOrderDiffItems,
  buildFeeTransaction,
  buildFxReconciliationTransaction,
  buildLastTransactionMap,
  buildNewDebtAccountCategory,
  buildPrincipalOutflowTransaction,
  buildSettlementTransaction,
  buildSmartOrderPreviewItems,
  CategoryType,
  classifyActiveMoversViaLIS,
  classifyCategoryActivity,
  computeAccountLiquiditySummary,
  computeCategoryActivityScores,
  computeTransactionsWithRunningBalance,
  convertCurrencyAmount,
  detectExpenseCategoryDisplacement,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  evaluateCategoryRenameState,
  evaluateZeroSpendCategories,
  extractCanonicalBaseName,
  filterAndClassifyAccounts,
  filterAndClassifyCategories,
  filterAndClassifyIncomeSources,
  filterZeroSpendCategories,
  findAccountsBelowArchived,
  findExpenseCategoriesBelowArchived,
  findIncomeSourcesBelowArchived,
  formatThrowawayDebtAccountName,
  generateProposedCategoryRenames,
  getAccountBalance,
  getAddCurrencyTag,
  getCategoryCurrencyTier,
  getExpenseCategoryHierarchyRank,
  getLastTransactionSummaryForCategory,
  isArchivedCategoryName,
  isCyrillic,
  isInNormalizationScope,
  isPre2022Timestamp,
  isThrowawayDebtAccount,
  KNOWN_FOREIGN_CURRENCY_CODES,
  LOCALIZED_CATEGORY_DICTIONARY,
  moveAccountsAboveArchived,
  moveExpenseCategoriesAboveArchived,
  moveExpenseCategoriesToBottom,
  moveIncomeSourcesAboveArchived,
  optimizeCategoryOrderByActivity,
  organizeExpenseCategoriesByCurrencyTier,
  parseExternalProviderTimestamp,
  RENAME_TAGS,
  reorderCategoriesSubset,
  resolveCategoryCurrency,
  resolveTransactionEndpoints,
  sortCategoriesByOrder,
  sortExpenseCategoriesByHierarchy,
  sortRenamesTopologically,
  toDotNetTicks,
  unarchiveAccountCategory,
  unarchiveExpenseCategory,
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

  it("resolves counterpart account currency from categoryById and populates native and normalizedAmount", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-mono", name: "Monobank", categoryType: CategoryType.BankAccount, currencyId: "UAH" },
      { id: "cat-sport", name: "Sport", categoryType: CategoryType.Expense, currencyId: "PLN" },
    ];
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const currencies = [
      { id: "USD", rate: 1 },
      { id: "PLN", rate: 4 },
      { id: "UAH", rate: 41 },
    ];

    const foreignTx: ExternalProviderTransaction = {
      id: "tx-foreign-expense",
      sourceId: "acc-mono",
      destinationId: "cat-sport",
      sourceAmount: 410,
      destinationAmount: 410,
      dateTimestampISO: "2026-10-24T10:00:00Z",
    };

    const summary = getLastTransactionSummaryForCategory("cat-sport", foreignTx, categoryById, "PLN", currencies);
    expect(summary).not.toBeNull();
    expect(summary?.amount).toBe(410);
    expect(summary?.currency).toBe("UAH");
    expect(summary?.originalAmount).toBe(410);
    expect(summary?.originalCurrency).toBe("UAH");
    expect(summary?.normalizedAmount).toBeCloseTo(40, 2);
  });

  it("builds map with currency normalization across mixed currency transactions", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-mono", name: "Monobank", categoryType: CategoryType.BankAccount, currencyId: "UAH" },
      { id: "cat-sport", name: "Sport", categoryType: CategoryType.Expense, currencyId: "PLN" },
    ];
    const currencies = [
      { id: "USD", rate: 1 },
      { id: "PLN", rate: 4 },
      { id: "UAH", rate: 41 },
    ];

    const txs: ExternalProviderTransaction[] = [
      {
        id: "tx-1",
        sourceId: "acc-mono",
        destinationId: "cat-sport",
        sourceAmount: 820,
        dateTimestampISO: "2026-10-24T12:00:00Z",
      },
    ];

    const map = buildLastTransactionMap(txs, categories, "PLN", currencies);
    const summary = map.get("cat-sport");
    expect(summary).toBeDefined();
    expect(summary?.amount).toBe(820);
    expect(summary?.currency).toBe("UAH");
    expect(summary?.normalizedAmount).toBeCloseTo(80, 2);
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

describe("getAccountBalance", () => {
  it("returns 0 for null or undefined", () => {
    expect(getAccountBalance(null)).toBe(0);
    expect(getAccountBalance(undefined)).toBe(0);
  });

  it("prioritizes amount over currentAmount: 0.0 from upstream ExternalProvider payloads", () => {
    const upstreamCategory = {
      id: "acc-1",
      name: "Main Bank",
      categoryType: CategoryType.BankAccount,
      amount: 814.05,
      currentAmount: 0.0,
    } as ExternalProviderCategory;
    expect(getAccountBalance(upstreamCategory)).toBe(814.05);
  });

  it("preserves negative balances for debt accounts or overdrawn checking", () => {
    const debtCategory = {
      id: "debt-1",
      name: "Credit Card",
      categoryType: CategoryType.DebtAccount,
      amount: -450.25,
      currentAmount: 0.0,
    } as ExternalProviderCategory;
    expect(getAccountBalance(debtCategory)).toBe(-450.25);
  });

  it("returns 0 when amount is 0 even if currentAmount is present", () => {
    const zeroCategory = {
      id: "acc-0",
      name: "Empty Checking",
      categoryType: CategoryType.BankAccount,
      amount: 0,
      currentAmount: 100,
    } as ExternalProviderCategory;
    expect(getAccountBalance(zeroCategory)).toBe(0);
  });

  it("falls back to currentAmount when amount is undefined", () => {
    const fallbackCategory = {
      id: "acc-fallback",
      name: "Legacy Account",
      categoryType: CategoryType.Account,
      currentAmount: 123.45,
    } as ExternalProviderCategory;
    expect(getAccountBalance(fallbackCategory)).toBe(123.45);
  });

  it("returns 0 when neither amount nor currentAmount is defined", () => {
    const emptyCategory = {
      id: "acc-none",
      name: "Blank Account",
      categoryType: CategoryType.Account,
    } as ExternalProviderCategory;
    expect(getAccountBalance(emptyCategory)).toBe(0);
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

  it("anchors running balance to amount when upstream category includes currentAmount: 0.0", () => {
    const cats = [
      {
        id: "bank-1",
        name: "Checking",
        categoryType: CategoryType.BankAccount,
        amount: 814.05,
        currentAmount: 0.0,
        currencyId: "PLN",
      },
      { id: "groceries", name: "Groceries", categoryType: CategoryType.Expense },
      { id: "salary", name: "Work", categoryType: CategoryType.Income },
    ] as ExternalProviderCategory[];

    const txs = [
      { id: "t2", sourceId: "bank-1", destinationId: "groceries", sourceAmount: 14.05, dateTimestamp: 2000 },
      { id: "t1", sourceId: "salary", destinationId: "bank-1", destinationAmount: 300, dateTimestamp: 1000 },
    ] as ExternalProviderTransaction[];

    const [first, second] = computeTransactionsWithRunningBalance(txs, cats, "PLN");
    expect(first.direction).toBe("expense");
    expect(first.sourceBalanceAfter).toBeCloseTo(814.05);
    expect(second.direction).toBe("income");
    expect(second.destinationBalanceAfter).toBeCloseTo(828.1);
  });

  it("tracks running balance across account-to-account transfers with currentAmount: 0.0", () => {
    const cats = [
      {
        id: "acc-source",
        name: "Checking",
        categoryType: CategoryType.BankAccount,
        amount: 500,
        currentAmount: 0.0,
        currencyId: "EUR",
      },
      {
        id: "acc-dest",
        name: "Savings",
        categoryType: CategoryType.Account,
        amount: 1500,
        currentAmount: 0.0,
        currencyId: "EUR",
      },
    ] as ExternalProviderCategory[];

    const txs = [
      {
        id: "tx-transfer",
        sourceId: "acc-source",
        destinationId: "acc-dest",
        sourceAmount: 200,
        destinationAmount: 200,
        dateTimestamp: 5000,
      },
    ] as ExternalProviderTransaction[];

    const [result] = computeTransactionsWithRunningBalance(txs, cats, "EUR");
    expect(result.direction).toBe("transfer");
    expect(result.sourceBalanceAfter).toBe(500);
    expect(result.destinationBalanceAfter).toBe(1500);
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

  it("persists a custom selected icon on new debt account", () => {
    const categories: ExternalProviderCategory[] = [
      { id: "acc-1", name: "Checking", categoryType: CategoryType.BankAccount, order: 0 },
    ];

    const result = buildNewDebtAccountCategory(categories, {
      name: "Mortgage Deal",
      currencyId: "USD",
      icon: "house",
    });

    expect(result.newAccount.name).toBe("Mortgage Deal");
    expect(result.newAccount.categoryType).toBe(CategoryType.DebtAccount);
    expect(result.newAccount.icon).toBe("house");
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

  describe("Category Normalization & Clean Default Helpers", () => {
    describe("extractCanonicalBaseName", () => {
      it("strips trailing default currency suffix (PLN) case-insensitively", () => {
        expect(extractCanonicalBaseName("Medicine PLN", "PLN")).toBe("Medicine");
        expect(extractCanonicalBaseName("Hotels pln", "PLN")).toBe("Hotels");
        expect(extractCanonicalBaseName("Transport (PLN)", "PLN")).toBe("Transport");
      });

      it("strips foreign currency suffixes (UAH, EUR, USD, etc.)", () => {
        expect(extractCanonicalBaseName("Medicine UAH", "PLN")).toBe("Medicine");
        expect(extractCanonicalBaseName("Hotels EUR", "PLN")).toBe("Hotels");
        expect(extractCanonicalBaseName("Freelance (USD)", "PLN")).toBe("Freelance");
      });

      it("translates known Ukrainian dictionary categories to standardized English", () => {
        expect(extractCanonicalBaseName("Ліки")).toBe("Medicine");
        expect(extractCanonicalBaseName("продукти")).toBe("Groceries");
        expect(extractCanonicalBaseName("Кафе")).toBe("Cafes & Restaurants");
        expect(extractCanonicalBaseName("транспорт")).toBe("Transport");
        expect(extractCanonicalBaseName("Таксі")).toBe("Taxi");
        expect(extractCanonicalBaseName("оренда")).toBe("Rent");
        expect(extractCanonicalBaseName("комуналка")).toBe("Utilities");
      });

      it("translates Ukrainian categories with foreign currency suffix", () => {
        expect(extractCanonicalBaseName("Ліки UAH")).toBe("Medicine");
        expect(extractCanonicalBaseName("Продукти (UAH)")).toBe("Groceries");
      });

      it("preserves already clean category names", () => {
        expect(extractCanonicalBaseName("Groceries")).toBe("Groceries");
        expect(extractCanonicalBaseName("Entertainment")).toBe("Entertainment");
      });
    });

    describe("isPre2022Timestamp & parseExternalProviderTimestamp", () => {
      it("identifies pre-2022 dates from .NET ticks", () => {
        const pre2022Ticks = toDotNetTicks(new Date("2021-08-15T12:00:00Z"));
        const post2022Ticks = toDotNetTicks(new Date("2023-05-10T12:00:00Z"));

        expect(isPre2022Timestamp(pre2022Ticks)).toBe(true);
        expect(isPre2022Timestamp(post2022Ticks)).toBe(false);
      });

      it("handles invalid or empty timestamps safely", () => {
        expect(isPre2022Timestamp(undefined)).toBe(false);
        expect(isPre2022Timestamp(0)).toBe(false);
        expect(isPre2022Timestamp(-1)).toBe(false);
      });
    });

    describe("generateProposedCategoryRenames", () => {
      it("proposes stripping default currency suffix with [Strip PLN]", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-med-pln",
            name: "Medicine PLN",
            categoryType: CategoryType.Expense,
          },
          {
            id: "cat-food-clean",
            name: "Groceries",
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(1);
        expect(renames[0]).toMatchObject({
          id: "cat-med-pln",
          currentName: "Medicine PLN",
          proposedName: "Medicine",
          tags: [RENAME_TAGS.STRIP_PLN],
        });
      });

      it("proposes translating Ukrainian categories and appending [Translate UA] and [Add UAH]", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-ua-med",
            name: "Ліки",
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories);
        expect(renames).toHaveLength(1);
        expect(renames[0]).toMatchObject({
          id: "cat-ua-med",
          currentName: "Ліки",
          proposedName: "Medicine UAH",
          tags: [RENAME_TAGS.TRANSLATE_UA, RENAME_TAGS.ADD_UAH],
        });
      });

      it("handles pre-2022 legacy categories without collision against modern PLN categories", () => {
        const legacyTicks = toDotNetTicks(new Date("2021-05-10T00:00:00Z"));
        const modernTicks = toDotNetTicks(new Date("2023-01-15T00:00:00Z"));

        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-hotel-legacy",
            name: "Hotels",
            createdTimestamp: legacyTicks,
            categoryType: CategoryType.Expense,
          },
          {
            id: "cat-hotel-modern",
            name: "Hotels PLN",
            createdTimestamp: modernTicks,
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(2);

        const modernRename = renames.find((r) => r.id === "cat-hotel-modern");
        const legacyRename = renames.find((r) => r.id === "cat-hotel-legacy");

        expect(modernRename?.isCollision).toBeFalsy();
        expect(modernRename).toMatchObject({
          proposedName: "Hotels",
          tags: [RENAME_TAGS.STRIP_PLN],
        });

        expect(legacyRename?.isCollision).toBeFalsy();
        expect(legacyRename).toMatchObject({
          proposedName: "Hotels UAH",
          tags: [RENAME_TAGS.ADD_UAH],
        });
      });

      it("ignores account categories and deleted categories", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "acc-bank",
            name: "Millennium PLN",
            categoryType: CategoryType.BankAccount,
          },
          {
            id: "cat-del",
            name: "Old PLN",
            deleted: true,
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(0);
      });

      it("detects collisions against unchanged categories", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-1",
            name: "Transport PLN",
            categoryType: CategoryType.Expense,
          },
          {
            id: "cat-2",
            name: "Transport",
            categoryType: CategoryType.Expense,
            // Not pre-2022, no counterpart with default suffix, so it remains unchanged
            createdTimestamp: toDotNetTicks(new Date("2024-01-01")),
          },
        ];

        // cat-2 has name "Transport" which matches "Transport PLN" stripped!
        // But cat-2 has counterpart "Transport PLN", so cat-2 is recognized as legacy counterpart or collision
        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        // Since cat-2 has counterpart with PLN suffix, cat-2 becomes "Transport UAH"
        expect(renames.some((r) => r.proposedName === "Transport")).toBe(true);
        expect(renames.some((r) => r.proposedName === "Transport UAH")).toBe(true);
      });

      it("translates Ukrainian category with existing foreign currency suffix preserving suffix without add tag", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-learn-eur",
            name: "Навчання EUR",
            currencyId: "EUR",
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(1);
        expect(renames[0]).toMatchObject({
          id: "cat-learn-eur",
          currentName: "Навчання EUR",
          proposedName: "Learning EUR",
          tags: [RENAME_TAGS.TRANSLATE_UA],
        });
      });

      it("translates Ukrainian category without suffix and appends non-default resolved currency tag", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-learn-eur-untagged",
            name: "Навчання",
            currencyId: "EUR",
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(1);
        expect(renames[0]).toMatchObject({
          id: "cat-learn-eur-untagged",
          currentName: "Навчання",
          proposedName: "Learning EUR",
          tags: [RENAME_TAGS.TRANSLATE_UA, getAddCurrencyTag("EUR")],
        });
      });

      it("proposes appending non-default currency suffix to untagged expense categories", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "cat-hotel-eur",
            name: "Hotels",
            currencyId: "EUR",
            categoryType: CategoryType.Expense,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, { defaultCurrency: "PLN" });
        expect(renames).toHaveLength(1);
        expect(renames[0]).toMatchObject({
          id: "cat-hotel-eur",
          currentName: "Hotels",
          proposedName: "Hotels EUR",
          tags: [getAddCurrencyTag("EUR")],
        });
      });

      it("normalizes income categories with non-default currencies or Ukrainian translations", () => {
        const categories: ExternalProviderCategory[] = [
          {
            id: "inc-b2b",
            name: "B2B Client",
            currencyId: "USD",
            categoryType: CategoryType.Income,
          },
          {
            id: "inc-salary-usd",
            name: "Зарплата USD",
            currencyId: "USD",
            categoryType: CategoryType.Income,
          },
          {
            id: "inc-salary-pln",
            name: "Зарплата",
            currencyId: "PLN",
            categoryType: CategoryType.Income,
          },
        ];

        const renames = generateProposedCategoryRenames(categories, {
          defaultCurrency: "PLN",
          scope: "income",
        });

        expect(renames).toHaveLength(3);

        const b2bRename = renames.find((r) => r.id === "inc-b2b");
        expect(b2bRename).toMatchObject({
          currentName: "B2B Client",
          proposedName: "B2B Client USD",
          tags: [getAddCurrencyTag("USD")],
        });

        const salaryUsdRename = renames.find((r) => r.id === "inc-salary-usd");
        expect(salaryUsdRename).toMatchObject({
          currentName: "Зарплата USD",
          proposedName: "Salary USD",
          tags: [RENAME_TAGS.TRANSLATE_UA],
        });

        const salaryPlnRename = renames.find((r) => r.id === "inc-salary-pln");
        expect(salaryPlnRename).toMatchObject({
          currentName: "Зарплата",
          proposedName: "Salary",
          tags: [RENAME_TAGS.TRANSLATE_UA],
        });
      });
    });

    describe("resolveCategoryCurrency", () => {
      it("resolves category.currencyId first", () => {
        const cat: ExternalProviderCategory = {
          id: "c1",
          name: "Groceries USD",
          currencyId: "EUR",
          categoryType: CategoryType.Expense,
        };
        expect(resolveCategoryCurrency(cat)).toBe("EUR");
      });

      it("resolves trailing currency suffix in name second", () => {
        const cat: ExternalProviderCategory = {
          id: "c2",
          name: "_Hotels EUR",
          categoryType: CategoryType.Expense,
        };
        expect(resolveCategoryCurrency(cat)).toBe("EUR");
      });

      it("resolves pre-2022 timestamp or transaction history third to UAH", () => {
        const cat: ExternalProviderCategory = {
          id: "c3",
          name: "Taxi",
          createdTimestamp: toDotNetTicks(new Date("2021-05-01")),
          categoryType: CategoryType.Expense,
        };
        expect(resolveCategoryCurrency(cat)).toBe("UAH");
      });

      it("falls back to defaultCurrency fourth", () => {
        const cat: ExternalProviderCategory = {
          id: "c4",
          name: "Sport",
          categoryType: CategoryType.Expense,
        };
        expect(resolveCategoryCurrency(cat, { defaultCurrency: "PLN" })).toBe("PLN");
      });
    });
  });
});

describe("scoped category normalization", () => {
  const cat = (id: string, name: string, type: number, order: number, extra?: Partial<ExternalProviderCategory>) =>
    ({ id, name, categoryType: type, order, ...extra }) as ExternalProviderCategory;

  it("partitions strictly by scope", () => {
    const cats = [cat("e1", "Gifts PLN", CategoryType.Expense, 0), cat("i1", "Gifts", CategoryType.Income, 0)];
    const expense = generateProposedCategoryRenames(cats, { scope: "expense" });
    expect(expense.map((r) => r.id)).toEqual(["e1"]);
    expect(expense[0].isCollision).toBeFalsy();
    expect(generateProposedCategoryRenames(cats, { scope: "income" })).toHaveLength(0);
  });

  it("preserves leading underscore archive prefixes", () => {
    const cats = [cat("a", "_Diet PLN", CategoryType.Expense, 0), cat("b", "_Ліки", CategoryType.Expense, 1)];
    const renames = generateProposedCategoryRenames(cats);
    expect(renames.find((r) => r.id === "a")?.proposedName).toBe("_Diet");
    expect(renames.find((r) => r.id === "b")?.proposedName).toBe("_Medicine UAH");
  });

  it("assigns step orders and dependencies for coupled chains", () => {
    const cats = [
      cat("h1", "Hotels", CategoryType.Expense, 12, { createdTimestamp: toDotNetTicks(new Date("2021-05-10")) }),
      cat("h2", "Hotels PLN", CategoryType.Expense, 3),
    ];
    const renames = generateProposedCategoryRenames(cats);
    const vacate = renames.find((r) => r.id === "h1");
    const claim = renames.find((r) => r.id === "h2");
    expect(vacate).toMatchObject({ stepOrder: 1, vacatesBaseName: "hotels" });
    expect(claim).toMatchObject({ stepOrder: 2, claimsBaseName: "hotels", dependsOnCategoryIds: ["h1"] });
    expect(sortRenamesTopologically(renames).map((r) => r.id)).toEqual(["h1", "h2"]);
    expect(buildCategoryNormalizationPlan(cats).groups[0]).toMatchObject({ baseName: "hotels", isCoupled: true });
  });

  it("flags broken chains and collisions reactively", () => {
    const cats = [
      cat("h1", "Hotels", CategoryType.Expense, 12),
      cat("h2", "Hotels PLN", CategoryType.Expense, 3),
      cat("m1", "Medicine UAH", CategoryType.Expense, 6),
      cat("m2", "Medicine PLN", CategoryType.Expense, 7),
    ];
    const items = [
      { id: "h1", currentName: "Hotels", editedName: "Hotels UAH", selected: false },
      { id: "h2", currentName: "Hotels PLN", editedName: "Hotels", selected: true, dependsOnCategoryIds: ["h1"] },
      { id: "m2", currentName: "Medicine PLN", editedName: "Medicine UAH", selected: true },
    ];
    const state = evaluateCategoryRenameState(cats, items);
    expect(state.h2.status).toBe("broken-chain");
    expect(state.m2.status).toBe("collision");
    items[0].selected = true;
    expect(evaluateCategoryRenameState(cats, items).h2.status).toBe("ok");
  });
});

describe("expense category lifecycle", () => {
  const cat = (id: string, name: string, order: number, type: number = CategoryType.Expense) =>
    ({ id, name, categoryType: type, order }) as ExternalProviderCategory;

  it("archives to the end and unarchives above the first archived", () => {
    const cats = [cat("a", "A", 0), cat("b", "B", 1), cat("c", "_C", 2), cat("i", "Salary", 0, CategoryType.Income)];
    const archived = archiveExpenseCategory(cats, "a");
    const names = sortCategoriesByOrder(
      archived.updatedCategories.filter((c) => c.categoryType === CategoryType.Expense),
    );
    expect(names.map((c) => c.name)).toEqual(["B", "_C", "_A"]);
    const restored = unarchiveExpenseCategory(archived.updatedCategories, "a");
    const names2 = sortCategoriesByOrder(
      restored.updatedCategories.filter((c) => c.categoryType === CategoryType.Expense),
    );
    expect(names2.map((c) => c.name)).toEqual(["B", "A", "_C"]);
  });

  it("moves active categories above archived and organizes currency tiers", () => {
    const cats = [cat("a", "A", 0), cat("x", "_X", 1), cat("h", "Hotels CHF", 2), cat("b", "B", 3)];
    const moved = moveExpenseCategoriesAboveArchived(cats);
    expect(sortCategoriesByOrder(moved.updatedCategories).map((c) => c.id)).toEqual(["a", "h", "b", "x"]);
    const tiers = organizeExpenseCategoriesByCurrencyTier(moved.updatedCategories);
    expect(sortCategoriesByOrder(tiers.updatedCategories).map((c) => c.id)).toEqual(["a", "b", "h", "x"]);
  });

  describe("adaptive displacement analysis & minimal-mutation reordering", () => {
    it("detects no displacement when active categories precede archived", () => {
      const cats = [cat("a", "A", 0), cat("b", "B", 1), cat("x", "_X", 2)];
      const res = detectExpenseCategoryDisplacement(cats);
      expect(res.direction).toBe("none");
      expect(res.archivedAbove).toEqual([]);
      expect(res.activeBelow).toEqual([]);
    });

    it("detects move-archived-to-bottom when archived count is less than active below count", () => {
      // 2 archived above, 4 active below
      const cats = [
        cat("x1", "_X1", 0),
        cat("x2", "_X2", 1),
        cat("a1", "A1", 2),
        cat("a2", "A2", 3),
        cat("a3", "A3", 4),
        cat("a4", "A4", 5),
      ];
      const res = detectExpenseCategoryDisplacement(cats);
      expect(res.direction).toBe("move-archived-to-bottom");
      expect(res.archivedAbove.map((c) => c.id)).toEqual(["x1", "x2"]);
      expect(res.activeBelow.map((c) => c.id)).toEqual(["a1", "a2", "a3", "a4"]);
    });

    it("detects move-active-above-archived when active below count is <= archived above count", () => {
      // 3 archived above, 2 active below
      const cats = [
        cat("x1", "_X1", 0),
        cat("x2", "_X2", 1),
        cat("x3", "_X3", 2),
        cat("a1", "A1", 3),
        cat("a2", "A2", 4),
      ];
      const res = detectExpenseCategoryDisplacement(cats);
      expect(res.direction).toBe("move-active-above-archived");
      expect(res.archivedAbove.map((c) => c.id)).toEqual(["x1", "x2", "x3"]);
      expect(res.activeBelow.map((c) => c.id)).toEqual(["a1", "a2"]);
    });

    it("moves archived categories to bottom while strictly preserving active category orders", () => {
      const cats = [
        cat("x1", "_X1", 0),
        cat("x2", "_X2", 1),
        cat("a1", "A1", 10),
        cat("a2", "A2", 20),
        cat("a3", "A3", 30),
      ];
      const result = moveExpenseCategoriesToBottom(cats);
      // Only x1 and x2 should be mutated
      expect(result.modifiedCategories.map((c) => c.id)).toEqual(["x1", "x2"]);
      // Orders of active categories should remain intact
      const updatedMap = new Map(result.updatedCategories.map((c) => [c.id, c.order]));
      expect(updatedMap.get("a1")).toBe(10);
      expect(updatedMap.get("a2")).toBe(20);
      expect(updatedMap.get("a3")).toBe(30);
      // x1 and x2 should be assigned sequential orders after max(remaining) which is 30
      expect(updatedMap.get("x1")).toBe(31);
      expect(updatedMap.get("x2")).toBe(32);
    });

    it("moves a single category to bottom when categoryIds is provided", () => {
      const cats = [cat("x1", "_X1", 0), cat("a1", "A1", 10), cat("x2", "_X2", 20)];
      const result = moveExpenseCategoriesToBottom(cats, ["x1"]);
      expect(result.modifiedCategories.map((c) => c.id)).toEqual(["x1"]);
      const updatedMap = new Map(result.updatedCategories.map((c) => [c.id, c.order]));
      expect(updatedMap.get("x1")).toBe(21);
      expect(updatedMap.get("a1")).toBe(10);
      expect(updatedMap.get("x2")).toBe(20);
    });
  });

  describe("category hierarchy and currency tier sorting", () => {
    it("ranks categories: primary (1) -> foreign (2) -> archived (3) -> removed (4)", () => {
      expect(getExpenseCategoryHierarchyRank(cat("p", "Groceries", 0))).toBe(1);
      expect(getExpenseCategoryHierarchyRank(cat("f", "Hotels CHF", 1))).toBe(2);
      expect(getExpenseCategoryHierarchyRank(cat("a", "_Old Groceries", 2))).toBe(3);
      expect(getExpenseCategoryHierarchyRank({ ...cat("r", "Old Taxi", 3), deleted: true })).toBe(4);
    });

    it("sorts categories by hierarchy strictly placing removed at bottom", () => {
      const cats = [
        { ...cat("r", "Removed Taxi", 0), deleted: true },
        cat("a", "_Archived", 1),
        cat("f", "Hotels CHF", 2),
        cat("p", "Groceries", 3),
      ];
      const sorted = sortExpenseCategoriesByHierarchy(cats);
      expect(sorted.map((c) => c.id)).toEqual(["p", "f", "a", "r"]);
    });

    it("organizes expense categories by currency tier including removed categories at the bottom", () => {
      const cats = [
        cat("f", "Hotels CHF", 0),
        { ...cat("r", "Deleted Category", 1), deleted: true },
        cat("p", "Groceries", 2),
        cat("a", "_Archived", 3),
      ];
      const result = organizeExpenseCategoriesByCurrencyTier(cats);
      expect(sortCategoriesByOrder(result.updatedCategories).map((c) => c.id)).toEqual(["p", "f", "a", "r"]);
      const updatedMap = new Map(result.updatedCategories.map((c) => [c.id, c.order]));
      expect(updatedMap.get("p")).toBe(0);
      expect(updatedMap.get("f")).toBe(1);
      expect(updatedMap.get("a")).toBe(2);
      expect(updatedMap.get("r")).toBe(3);
    });

    it("respects includeDeleted in isInNormalizationScope", () => {
      const activeCat = cat("1", "Food", 0);
      const deletedCat = { ...cat("2", "Old Food", 1), deleted: true };
      expect(isInNormalizationScope(activeCat, "expense")).toBe(true);
      expect(isInNormalizationScope(deletedCat, "expense")).toBe(false);
      expect(isInNormalizationScope(deletedCat, "expense", { includeDeleted: true })).toBe(true);
    });
  });

  describe("Category Activity & Smart Order Optimizer Engine", () => {
    const fixedNow = new Date("2026-03-01T12:00:00Z").getTime();
    const dayMs = 86_400_000;

    const makeCat = (id: string, name: string, order = 0, type = CategoryType.Expense): ExternalProviderCategory => ({
      id,
      name,
      order,
      categoryType: type,
    });

    const makeTx = (
      id: string,
      destId: string,
      daysAgo: number,
      sourceId = "acc-1",
      deleted = false,
    ): ExternalProviderTransaction => ({
      id,
      destinationId: destId,
      sourceId,
      dateTimestamp: fixedNow - daysAgo * dayMs,
      deleted,
    });

    describe("computeCategoryActivityScores", () => {
      it("computes time-decayed activity scores using 30-day exponential half-life", () => {
        const c1 = makeCat("c1", "Groceries");
        const c2 = makeCat("c2", "Rent");
        const c3 = makeCat("c3", "Unused");

        const txs: ExternalProviderTransaction[] = [
          makeTx("tx1", "c1", 0), // age 0 -> 1.0
          makeTx("tx2", "c1", 30), // age 30 -> 0.5
          makeTx("tx3", "c1", 60), // age 60 -> 0.25
          makeTx("tx4", "c2", 15), // age 15 -> ~0.707
        ];

        const scores = computeCategoryActivityScores([c1, c2, c3], txs, { now: fixedNow });

        const s1 = scores.get("c1")!;
        expect(s1.transactionCount).toBe(3);
        expect(s1.score).toBeCloseTo(1.75, 4);
        expect(s1.lastActiveTimestamp).toBe(fixedNow);
        expect(s1.lastActiveDate).toEqual(new Date(fixedNow));

        const s2 = scores.get("c2")!;
        expect(s2.transactionCount).toBe(1);
        expect(s2.score).toBeCloseTo(2 ** (-15 / 30), 4);

        const s3 = scores.get("c3")!;
        expect(s3.transactionCount).toBe(0);
        expect(s3.score).toBe(0);
        expect(s3.lastActiveTimestamp).toBeNull();
        expect(s3.lastActiveDate).toBeNull();
      });

      it("filters transactions strictly by lookback window (90-days and 180-days)", () => {
        const c1 = makeCat("c1", "Shopping");
        const txs: ExternalProviderTransaction[] = [
          makeTx("tx1", "c1", 20),
          makeTx("tx2", "c1", 100),
          makeTx("tx3", "c1", 200),
        ];

        const scoreAllTime = computeCategoryActivityScores([c1], txs, { now: fixedNow, lookbackScope: "all-time" });
        expect(scoreAllTime.get("c1")!.transactionCount).toBe(3);

        const score180 = computeCategoryActivityScores([c1], txs, { now: fixedNow, lookbackScope: "180-days" });
        expect(score180.get("c1")!.transactionCount).toBe(2);

        const score90 = computeCategoryActivityScores([c1], txs, { now: fixedNow, lookbackScope: "90-days" });
        expect(score90.get("c1")!.transactionCount).toBe(1);
      });

      it("ignores deleted transactions", () => {
        const c1 = makeCat("c1", "Food");
        const txs: ExternalProviderTransaction[] = [
          makeTx("tx1", "c1", 5, "acc-1", true), // deleted
          makeTx("tx2", "c1", 10, "acc-1", false),
        ];

        const scores = computeCategoryActivityScores([c1], txs, { now: fixedNow });
        expect(scores.get("c1")!.transactionCount).toBe(1);
      });
    });

    describe("classifyCategoryActivity", () => {
      it("correctly identifies zero-transaction, low-frequency, and active categories", () => {
        const cZero = makeCat("c0", "Old Hobby");
        const cLow = makeCat("cLow", "Concert Tickets");
        const cActive = makeCat("cActive", "Groceries");

        const txs: ExternalProviderTransaction[] = [
          makeTx("tx1", "cLow", 10),
          makeTx("tx2", "cLow", 20),
          makeTx("tx3", "cLow", 30),
          // cActive has 4 tx
          makeTx("tx4", "cActive", 1),
          makeTx("tx5", "cActive", 2),
          makeTx("tx6", "cActive", 3),
          makeTx("tx7", "cActive", 4),
        ];

        const audit = classifyCategoryActivity([cZero, cLow, cActive], txs, { defaultCurrency: "PLN" });

        const aZero = audit.get("c0")!;
        expect(aZero.status).toBe("zero-transaction");
        expect(aZero.lifetimeTransactionCount).toBe(0);
        expect(aZero.isOrphanCandidate).toBe(true);
        expect(aZero.isStandaloneForeign).toBe(false);

        const aLow = audit.get("cLow")!;
        expect(aLow.status).toBe("low-frequency");
        expect(aLow.lifetimeTransactionCount).toBe(3);
        expect(aLow.isOrphanCandidate).toBe(false);

        const aActive = audit.get("cActive")!;
        expect(aActive.status).toBe("active");
        expect(aActive.lifetimeTransactionCount).toBe(4);
        expect(aActive.isOrphanCandidate).toBe(false);
      });

      it("protects standalone foreign currency categories without default currency counterparts", () => {
        const standaloneEur = makeCat("f1", "Hotels EUR");
        const pairedEur = makeCat("f2", "Dining EUR");
        const pairedPln = makeCat("p1", "Dining");

        const txs: ExternalProviderTransaction[] = []; // 0 tx for all

        const audit = classifyCategoryActivity([standaloneEur, pairedEur], txs, {
          defaultCurrency: "PLN",
          allCategories: [standaloneEur, pairedEur, pairedPln],
        });

        // Hotels EUR has no "Hotels" or "Hotels PLN" -> standalone foreign protected
        const aStandalone = audit.get("f1")!;
        expect(aStandalone.status).toBe("standalone-foreign");
        expect(aStandalone.isStandaloneForeign).toBe(true);
        expect(aStandalone.isOrphanCandidate).toBe(false);

        // Dining EUR has a PLN counterpart "Dining" -> normal zero-transaction orphan candidate
        const aPaired = audit.get("f2")!;
        expect(aPaired.status).toBe("zero-transaction");
        expect(aPaired.isStandaloneForeign).toBe(false);
        expect(aPaired.isOrphanCandidate).toBe(true);
        expect(aPaired.hasDefaultCurrencyCounterpart).toBe(true);
        expect(aPaired.counterpartCategoryId).toBe("p1");
      });
    });

    describe("optimizeCategoryOrderByActivity", () => {
      it("sorts active default and foreign tiers by score descending while keeping archived and deleted anchored", () => {
        const p1 = makeCat("p1", "Low Prim", 0); // score 1.0
        const p2 = makeCat("p2", "High Prim", 1); // score 5.0
        const f1 = makeCat("f1", "Low Foreign EUR", 2); // score 0.5
        const f2 = makeCat("f2", "High Foreign EUR", 3); // score 3.0
        const a1 = makeCat("a1", "_Archived Old", 4);
        const a2 = makeCat("a2", "_Archived Recent", 5);
        const d1 = { ...makeCat("d1", "Deleted One", 6), deleted: true };

        const allCats = [p1, p2, f1, f2, a1, a2, d1];
        const scores = new Map<string, number>([
          ["p1", 1.0],
          ["p2", 5.0],
          ["f1", 0.5],
          ["f2", 3.0],
          ["a1", 10.0], // Even with high score, archived stays in Tier 3
        ]);

        const result = optimizeCategoryOrderByActivity(allCats, scores, { defaultCurrency: "PLN" });
        const ordered = sortCategoriesByOrder(result.updatedCategories);

        expect(ordered.map((c) => c.id)).toEqual([
          "p2", // Tier 1: p2 (5.0) > p1 (1.0)
          "p1",
          "f2", // Tier 2: f2 (3.0) > f1 (0.5)
          "f1",
          "a1", // Tier 3: _Archived preserved in relative position
          "a2",
          "d1", // Tier 4: Deleted at bottom
        ]);

        // Sequential 0, 1, 2, ...
        ordered.forEach((cat, idx) => {
          expect(cat.order).toBe(idx);
        });
      });

      it("builds smart order preview items with correct rank delta", () => {
        const p1 = makeCat("p1", "Groceries", 3);
        const p2 = makeCat("p2", "Coffee", 0);

        const original = [p1, p2];
        const optimized = [
          { ...p1, order: 0 }, // moved from 3 to 0 -> delta +3
          { ...p2, order: 1 }, // moved from 0 to 1 -> delta -1
        ];

        const scores = new Map([
          [
            "p1",
            { categoryId: "p1", score: 10, transactionCount: 15, lastActiveTimestamp: null, lastActiveDate: null },
          ],
          ["p2", { categoryId: "p2", score: 2, transactionCount: 3, lastActiveTimestamp: null, lastActiveDate: null }],
        ]);

        const preview = buildSmartOrderPreviewItems(original, optimized, scores);
        expect(preview).toHaveLength(2);
        expect(preview[0].category.id).toBe("p1");
        expect(preview[0].rankDelta).toBe(3);
        expect(preview[1].category.id).toBe("p2");
        expect(preview[1].rankDelta).toBe(-1);
      });
    });

    describe("evaluateZeroSpendCategories & filterZeroSpendCategories", () => {
      const catActive = {
        id: "c-active",
        name: "Groceries",
        categoryType: CategoryType.Expense,
      } as ExternalProviderCategory;
      const catRecent = {
        id: "c-recent",
        name: "Vacation",
        categoryType: CategoryType.Expense,
      } as ExternalProviderCategory;
      const catOld = {
        id: "c-old",
        name: "Hotels CHF",
        categoryType: CategoryType.Expense,
      } as ExternalProviderCategory;
      const catDormant = {
        id: "c-dormant",
        name: "Old Gym",
        categoryType: CategoryType.Expense,
      } as ExternalProviderCategory;
      const allCats = [catActive, catRecent, catOld, catDormant];

      // Points spanning 6 months:
      // Oct 2026: c-active: 100, others: 0
      // Sep 2026: c-active: 120, c-recent: 50, others: 0
      // Aug 2026: c-active: 90, others: 0
      // Jul 2026: c-active: 80, others: 0
      // Jun 2026: c-active: 70, c-old: 200, others: 0
      // May 2026: c-active: 60, others: 0
      const statPoints = [
        {
          id: "2026-05-01",
          categories: [{ id: "c-active", value: 60 }],
        },
        {
          id: "2026-06-01",
          categories: [
            { id: "c-active", value: 70 },
            { id: "c-old", value: 200 },
          ],
        },
        {
          id: "2026-07-01",
          categories: [{ id: "c-active", value: 80 }],
        },
        {
          id: "2026-08-01",
          categories: [{ id: "c-active", value: 90 }],
        },
        {
          id: "2026-09-01",
          categories: [
            { id: "c-active", value: 120 },
            { id: "c-recent", value: 50 },
          ],
        },
        {
          id: "2026-10-01",
          categories: [{ id: "c-active", value: 100 }],
        },
      ];

      const transactions = [
        {
          id: "tx-1",
          destinationId: "c-active",
          destinationAmount: 100,
          dateTimestampISO: "2026-10-15T10:00:00.000Z",
        },
        {
          id: "tx-2",
          destinationId: "c-recent",
          destinationAmount: 50,
          dateTimestampISO: "2026-09-10T10:00:00.000Z",
        },
        {
          id: "tx-3",
          destinationId: "c-old",
          destinationAmount: 200,
          dateTimestampISO: "2026-06-05T10:00:00.000Z",
        },
      ] as ExternalProviderTransaction[];

      it("evaluates current-month zero-spend accurately", () => {
        const evals = evaluateZeroSpendCategories(allCats, statPoints, "current-month", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        expect(evals.get("c-active")?.isZeroSpend).toBe(false);
        expect(evals.get("c-active")?.totalSpend).toBe(100);

        expect(evals.get("c-recent")?.isZeroSpend).toBe(true);
        expect(evals.get("c-recent")?.totalSpend).toBe(0);

        expect(evals.get("c-old")?.isZeroSpend).toBe(true);
        expect(evals.get("c-dormant")?.isZeroSpend).toBe(true);
      });

      it("evaluates 3-months zero-spend accurately", () => {
        const evals = evaluateZeroSpendCategories(allCats, statPoints, "3-months", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        // c-active: 100 (Oct) + 120 (Sep) + 90 (Aug) = 310
        expect(evals.get("c-active")?.isZeroSpend).toBe(false);
        expect(evals.get("c-active")?.totalSpend).toBe(310);

        // c-recent spent 50 in Sep (within 3 months) -> NOT zero-spend
        expect(evals.get("c-recent")?.isZeroSpend).toBe(false);
        expect(evals.get("c-recent")?.totalSpend).toBe(50);

        // c-old only spent in Jun (4 months ago) -> IS zero-spend in 3-months window
        expect(evals.get("c-old")?.isZeroSpend).toBe(true);
        expect(evals.get("c-old")?.totalSpend).toBe(0);

        // c-dormant -> IS zero-spend
        expect(evals.get("c-dormant")?.isZeroSpend).toBe(true);
      });

      it("evaluates 6-months zero-spend accurately", () => {
        const evals = evaluateZeroSpendCategories(allCats, statPoints, "6-months", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        // c-old spent 200 in Jun (5 months ago) -> NOT zero-spend in 6-months window
        expect(evals.get("c-old")?.isZeroSpend).toBe(false);
        expect(evals.get("c-old")?.totalSpend).toBe(200);

        // c-dormant -> IS zero-spend
        expect(evals.get("c-dormant")?.isZeroSpend).toBe(true);
      });

      it("evaluates all-time and distinguishes lifetime dormancy", () => {
        const evals = evaluateZeroSpendCategories(allCats, statPoints, "all-time", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        expect(evals.get("c-active")?.isZeroSpend).toBe(false);
        expect(evals.get("c-recent")?.isZeroSpend).toBe(false);
        expect(evals.get("c-old")?.isZeroSpend).toBe(false);

        // c-dormant has 0 spend across all points and 0 lifetime transactions
        expect(evals.get("c-dormant")?.isZeroSpend).toBe(true);
        expect(evals.get("c-dormant")?.isLifetimeDormant).toBe(true);
        expect(evals.get("c-dormant")?.lifetimeTransactionCount).toBe(0);
      });

      it("filters categories with zero spend using filterZeroSpendCategories", () => {
        const filtered3m = filterZeroSpendCategories(allCats, statPoints, "3-months", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        expect(filtered3m.map((c) => c.id)).toEqual(["c-old", "c-dormant"]);

        const filteredAllTime = filterZeroSpendCategories(allCats, statPoints, "all-time", {
          activeMonthDateStr: "2026-10-01",
          transactions,
        });

        expect(filteredAllTime.map((c) => c.id)).toEqual(["c-dormant"]);
      });
    });

    describe("Smart Order & Tier Reorganization Diff Engine (LIS & Tier Context)", () => {
      describe("classifyActiveMoversViaLIS", () => {
        it("identifies a single moved-to-top item as active mover and shifts as passive", () => {
          // Original: [A, B, C, D, E] (origIndex 0, 1, 2, 3, 4)
          // New: [E, A, B, C, D] (origIndex 4, 0, 1, 2, 3)
          const items = [
            { id: "E", origIndex: 4, newIndex: 0 },
            { id: "A", origIndex: 0, newIndex: 1 },
            { id: "B", origIndex: 1, newIndex: 2 },
            { id: "C", origIndex: 2, newIndex: 3 },
            { id: "D", origIndex: 3, newIndex: 4 },
          ];

          const activeMovers = classifyActiveMoversViaLIS(items);
          expect(Array.from(activeMovers)).toEqual(["E"]);
        });

        it("identifies a single moved-to-bottom item as active mover and shifts as passive", () => {
          // Original: [A, B, C, D, E] (origIndex 0, 1, 2, 3, 4)
          // New: [B, C, D, E, A] (origIndex 1, 2, 3, 4, 0)
          const items = [
            { id: "B", origIndex: 1, newIndex: 0 },
            { id: "C", origIndex: 2, newIndex: 1 },
            { id: "D", origIndex: 3, newIndex: 2 },
            { id: "E", origIndex: 4, newIndex: 3 },
            { id: "A", origIndex: 0, newIndex: 4 },
          ];

          const activeMovers = classifyActiveMoversViaLIS(items);
          expect(Array.from(activeMovers)).toEqual(["A"]);
        });

        it("returns empty set when no items moved", () => {
          const items = [
            { id: "A", origIndex: 0, newIndex: 0 },
            { id: "B", origIndex: 1, newIndex: 1 },
            { id: "C", origIndex: 2, newIndex: 2 },
          ];

          const activeMovers = classifyActiveMoversViaLIS(items);
          expect(activeMovers.size).toBe(0);
        });
      });

      describe("buildCategoryOrderDiffItems with 4 categories out of tier", () => {
        it("flags exactly 4 out-of-tier categories as isActiveMove: true, remaining as passive shifts, and formats tier realignment reasons", () => {
          // 10 Primary categories (PLN default)
          // 8 in primary tier, 2 out-of-tier placed in foreign section (indices 14 and 16)
          // 10 Foreign categories
          // 8 in foreign tier, 2 out-of-tier placed in primary section (indices 2 and 4)
          const createCat = (id: string, name: string, order: number): ExternalProviderCategory => ({
            id,
            name,
            categoryType: CategoryType.Expense,
            order,
          });

          const originalCategories: ExternalProviderCategory[] = [
            createCat("p0", "Groceries", 0),
            createCat("p1", "Dining", 1),
            createCat("f_out1", "Kyiv Trips UAH", 2), // Out of tier (foreign in primary tier)
            createCat("p2", "Transport", 3),
            createCat("f_out2", "US Hosting USD", 4), // Out of tier (foreign in primary tier)
            createCat("p3", "Utilities", 5),
            createCat("p4", "Health", 6),
            createCat("p5", "Home", 7),
            createCat("p6", "Shopping", 8),
            createCat("p7", "Entertainment", 9),
            // Foreign range (indices 10..19)
            createCat("f0", "Berlin EUR", 10),
            createCat("f1", "London GBP", 11),
            createCat("f2", "Rome EUR", 12),
            createCat("f3", "Paris EUR", 13),
            createCat("p_out1", "Coffee", 14), // Out of tier (primary in foreign tier)
            createCat("f4", "Tokyo EUR", 15),
            createCat("p_out2", "Gym Subscription", 16), // Out of tier (primary in foreign tier)
            createCat("f5", "Swiss CHF", 17),
            createCat("f6", "Prague CZK", 18),
            createCat("f7", "Vienna EUR", 19),
          ];

          // Organize by currency tier (or optimize by activity with tier preservation)
          const result = organizeExpenseCategoriesByCurrencyTier(originalCategories, "PLN");

          // Build diff items
          const diffItems = buildCategoryOrderDiffItems(originalCategories, result.updatedCategories, {
            defaultCurrency: "PLN",
            strategy: "tier-cleanup",
          });

          expect(diffItems).toHaveLength(20);

          // Find the active movers
          const activeMovers = diffItems.filter((item) => item.isActiveMove);
          const passiveOrStationary = diffItems.filter((item) => !item.isActiveMove);

          // Exactly 4 categories must be flagged as active movers
          expect(activeMovers.map((m) => m.category.id).sort()).toEqual(
            ["f_out1", "f_out2", "p_out1", "p_out2"].sort(),
          );

          // Remaining 16 categories must be passive shifts (or stationary)
          expect(passiveOrStationary).toHaveLength(16);
          passiveOrStationary.forEach((item) => {
            expect(item.isActiveMove).toBe(false);
          });

          // Verify contextual reason texts for tier realignment
          const fOut1 = diffItems.find((item) => item.category.id === "f_out1");
          expect(fOut1?.isActiveMove).toBe(true);
          expect(fOut1?.reason).toBe("Moved to Foreign tier (UAH)");

          const fOut2 = diffItems.find((item) => item.category.id === "f_out2");
          expect(fOut2?.isActiveMove).toBe(true);
          expect(fOut2?.reason).toBe("Moved to Foreign tier (USD)");

          const pOut1 = diffItems.find((item) => item.category.id === "p_out1");
          expect(pOut1?.isActiveMove).toBe(true);
          expect(pOut1?.reason).toBe("Promoted to Primary tier (PLN)");

          const pOut2 = diffItems.find((item) => item.category.id === "p_out2");
          expect(pOut2?.isActiveMove).toBe(true);
          expect(pOut2?.reason).toBe("Promoted to Primary tier (PLN)");

          // In-tier categories retain their normal tier reason
          const p0 = diffItems.find((item) => item.category.id === "p0");
          expect(p0?.isActiveMove).toBe(false);
          expect(p0?.reason).toBe("Primary default currency tier");

          const f0 = diffItems.find((item) => item.category.id === "f0");
          expect(f0?.isActiveMove).toBe(false);
          expect(f0?.reason).toBe("Foreign currency tier");
        });

        it("works with smart-order strategy keeping activity decay scores for in-tier categories and tier realignment for movers", () => {
          const createCat = (id: string, name: string, order: number): ExternalProviderCategory => ({
            id,
            name,
            categoryType: CategoryType.Expense,
            order,
          });

          const originalCategories: ExternalProviderCategory[] = [
            createCat("p0", "Groceries", 0),
            createCat("f_out1", "Travel UAH", 1),
            createCat("p1", "Dining", 2),
            createCat("p_out1", "Coffee", 3),
            createCat("f0", "Hotels EUR", 4),
          ];

          // scores map
          const scores = new Map([
            [
              "p0",
              { categoryId: "p0", score: 20, transactionCount: 10, lastActiveTimestamp: null, lastActiveDate: null },
            ],
            [
              "p1",
              { categoryId: "p1", score: 10, transactionCount: 5, lastActiveTimestamp: null, lastActiveDate: null },
            ],
            [
              "p_out1",
              { categoryId: "p_out1", score: 5, transactionCount: 2, lastActiveTimestamp: null, lastActiveDate: null },
            ],
            [
              "f0",
              { categoryId: "f0", score: 8, transactionCount: 4, lastActiveTimestamp: null, lastActiveDate: null },
            ],
            [
              "f_out1",
              { categoryId: "f_out1", score: 0, transactionCount: 0, lastActiveTimestamp: null, lastActiveDate: null },
            ],
          ]);

          const result = optimizeCategoryOrderByActivity(originalCategories, scores, { defaultCurrency: "PLN" });
          const diffItems = buildCategoryOrderDiffItems(originalCategories, result.updatedCategories, {
            defaultCurrency: "PLN",
            scores,
            strategy: "smart-order",
          });

          const fOut1 = diffItems.find((item) => item.category.id === "f_out1");
          expect(fOut1?.isActiveMove).toBe(true);
          expect(fOut1?.reason).toBe("Moved to Foreign tier (UAH)");

          // In-tier category p0 should retain score reason
          const p0 = diffItems.find((item) => item.category.id === "p0");
          expect(p0?.reason).toBe("10 transactions, score 20.0");
        });
      });
    });
  });
});
