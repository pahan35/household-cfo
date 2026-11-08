import { describe, expect, it } from "vitest";

import { computeBudgetSummaryItems } from "./budget-summary-card";
import {
  computePeriodComparison,
  detectSliceCurrency,
  type ExclusionPreset,
  groupSmallSlices,
  groupSmartSlices,
  isTaxiCategory,
  isTransportOrTaxi,
  transformExpenses,
} from "./expense-transforms";
import {
  buildCategoryOrderDiffItems,
  CategoryType,
  ExchangeKey,
  type ExchangePingItem,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  extractExchangeEntities,
  isExpenseCategory,
  optimizeCategoryOrderByActivity,
  organizeExpenseCategoriesByCurrencyTier,
  type StatCategoryPoint,
  type StatPingData,
  type StatPoint,
} from "./external-provider-data";
import { evaluateMonthCompleteness, getMonthIncompleteDescription } from "./month-completeness";
import { BUILT_IN_PRESET_IDS, buildDefaultPresets, findCategoryIdsByPattern } from "./use-exclusion-presets";
import {
  computeTotalNetWorth,
  extractAvailableMonths,
  filterChronologicalTrends,
  getNextMonth,
  getPrevMonth,
  normalizeMonthDate,
  parsePointDate,
  resolveBaselineMonth,
  stepZoomRange,
  transformChronologicalTrends,
  transformYoYPoints,
} from "./yoy-transforms";

/**
 * Realistic fixtures modeling ExternalProvider /Exchange/Ping and /stat/ping responses.
 * Note that /stat/ping returns `currentAmount: 0.0` while placing real spending in `amount` and `value`,
 * and formats `point.date` as "M-yyyy" alongside `point.id` as "yyyy-MM-dd".
 */
const MOEXT_CATEGORIES: ExternalProviderCategory[] = [
  {
    id: "cat-income-salary",
    name: "Salary",
    categoryType: CategoryType.Income,
    amount: 0,
    limitAmount: 0,
  },
  {
    id: "cat-tax",
    name: "Taxes & ZUS",
    categoryType: CategoryType.Expense,
    amount: 0,
    limitAmount: 4000,
  },
  {
    id: "cat-rent",
    name: "Apartment Rent",
    categoryType: CategoryType.Expense,
    amount: 0,
    limitAmount: 4500,
  },
  {
    id: "cat-groceries",
    name: "Groceries",
    categoryType: CategoryType.Expense,
    amount: 0,
    limitAmount: 3000,
  },
  {
    id: "cat-dining",
    name: "Dining Out",
    categoryType: CategoryType.Expense,
    amount: 0,
    limitAmount: 1000,
  },
];

const MOEXT_EXCHANGE_PING_ITEMS: ExchangePingItem[] = [
  {
    key: ExchangeKey.Category,
    entityJson: JSON.stringify(MOEXT_CATEGORIES),
  },
];

const MOCK_PRESET: ExclusionPreset = {
  id: "standard-household",
  name: "Standard Household",
  incomeDeductions: ["cat-tax"],
  expenseExclusions: ["cat-rent"],
  isBuiltIn: true,
};

const MOEXT_OCTOBER_STAT_CATEGORIES: StatCategoryPoint[] = [
  {
    id: "cat-income-salary",
    title: "Salary",
    amount: 25000,
    value: 25000,
    currentAmount: 0.0,
    limitAmount: 0,
  },
  {
    id: "cat-tax",
    title: "Taxes & ZUS",
    amount: 3500,
    value: 3500,
    currentAmount: 0.0,
    limitAmount: 4000,
  },
  {
    id: "cat-rent",
    title: "Apartment Rent",
    amount: 4500,
    value: 4500,
    currentAmount: 0.0,
    limitAmount: 4500,
  },
  {
    id: "cat-groceries",
    title: "Groceries",
    amount: 2450.75,
    value: 2450.75,
    currentAmount: 0.0,
    limitAmount: 3000,
  },
  {
    id: "cat-dining",
    title: "Dining Out",
    amount: 1250.25,
    value: 1250.25,
    currentAmount: 0.0,
    limitAmount: 1000,
  },
  {
    id: "cat-unmapped-metadata",
    title: "Pharmacy & Health",
    amount: 300,
    value: 300,
    currentAmount: 0.0,
    limitAmount: 500,
  },
];

const MOEXT_STAT_POINTS: StatPoint[] = [
  {
    id: "2026-10-01",
    date: "10-2026",
    categories: MOEXT_OCTOBER_STAT_CATEGORIES,
  },
  {
    id: "2026-09-01",
    date: "9-2026",
    categories: [
      {
        id: "cat-groceries",
        title: "Groceries",
        amount: 2450.75, // Static current-month snapshot
        value: 2100, // Historical month spending
        currentAmount: 0.0,
        limitAmount: 3000,
      },
    ],
  },
  {
    id: "2025-10-01",
    date: "10-2025",
    categories: [
      {
        id: "cat-groceries",
        title: "Groceries",
        amount: 2450.75, // Static current-month snapshot
        value: 2000, // Historical month spending
        currentAmount: 0.0,
        limitAmount: 2800,
      },
      {
        id: "cat-dining",
        title: "Dining Out",
        amount: 1250.25, // Static current-month snapshot
        value: 1000, // Historical month spending
        currentAmount: 0.0,
        limitAmount: 1000,
      },
    ],
  },
];

const MOEXT_STAT_PING_DATA: StatPingData = {
  selection: {
    params: { currency: "PLN" },
    points: MOEXT_STAT_POINTS,
  },
};

describe("Exchange/Ping fixture extraction", () => {
  it("extracts category metadata from double-encoded Exchange/Ping items", () => {
    const extracted = extractExchangeEntities<ExternalProviderCategory>(
      MOEXT_EXCHANGE_PING_ITEMS,
      ExchangeKey.Category,
    );
    expect(extracted).toHaveLength(5);
    expect(extracted[0]?.id).toBe("cat-income-salary");
  });
});

describe("transformExpenses", () => {
  it("extracts non-zero spending from `amount` when `currentAmount` is 0.0", () => {
    const result = transformExpenses({
      statCategories: MOEXT_OCTOBER_STAT_CATEGORIES,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
    });

    expect(result.grossIncome).toBe(25000);
    expect(result.totalTaxDeductions).toBe(3500);
    expect(result.netDisposableIncome).toBe(21500);
    expect(result.excludedExpenseSum).toBe(4500);
    expect(result.totalControllableExpense).toBe(4001);
    expect(result.totalGrossExpense).toBe(12001);
    expect(result.netCashFlowMargin).toBe(12999);
    expect(result.availableControllablePool).toBe(17000);
    expect(result.controllableCashLeft).toBe(12999);
    expect(result.controllableCategories).toHaveLength(3);
    expect(result.controllableCategories[0]?.name).toBe("Groceries");
    expect(result.controllableCategories[0]?.amount).toBe(2450.75);
    expect(result.controllableCategories[1]?.name).toBe("Dining Out");
    expect(result.controllableCategories[1]?.isOverrun).toBe(true);
  });

  it("maintains invariant netCashFlowMargin regardless of category exclusions", () => {
    // Preset with no expense exclusions (All Living)
    const allLivingPreset: ExclusionPreset = {
      id: "all-living",
      name: "All Living",
      incomeDeductions: ["cat-tax"],
      expenseExclusions: [],
      isBuiltIn: true,
    };

    // Preset with rent excluded (Controllable Expenses)
    const controllablePreset: ExclusionPreset = {
      id: "controllable",
      name: "Controllable Expenses",
      incomeDeductions: ["cat-tax"],
      expenseExclusions: ["cat-rent"],
      isBuiltIn: true,
    };

    const allLivingResult = transformExpenses({
      statCategories: MOEXT_OCTOBER_STAT_CATEGORIES,
      categories: MOEXT_CATEGORIES,
      activePreset: allLivingPreset,
    });

    const controllableResult = transformExpenses({
      statCategories: MOEXT_OCTOBER_STAT_CATEGORIES,
      categories: MOEXT_CATEGORIES,
      activePreset: controllablePreset,
    });

    // Net disposable income is identical (21,500 PLN)
    expect(allLivingResult.netDisposableIncome).toBe(21500);
    expect(controllableResult.netDisposableIncome).toBe(21500);

    // Controllable spending differs due to exclusion
    expect(allLivingResult.totalControllableExpense).toBe(8501); // 4001 + 4500 rent
    expect(controllableResult.totalControllableExpense).toBe(4001);
    expect(controllableResult.excludedExpenseSum).toBe(4500);

    // Invariant Net Cash Margin: both must equal 12,999 PLN
    expect(allLivingResult.netCashFlowMargin).toBe(12999);
    expect(controllableResult.netCashFlowMargin).toBe(12999);

    // Available pool and cash left
    expect(controllableResult.availableControllablePool).toBe(17000); // 21500 - 4500
    expect(controllableResult.controllableCashLeft).toBe(12999); // 17000 - 4001
  });

  it("falls back to `currentAmount` or `value` when `amount` is undefined", () => {
    const fallbackCategories: StatCategoryPoint[] = [
      {
        id: "cat-groceries",
        currentAmount: 850,
        limitAmount: 1000,
      },
      {
        id: "cat-dining",
        value: 420,
        limitAmount: 500,
      },
    ];

    const result = transformExpenses({
      statCategories: fallbackCategories,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
      rawGrossIncome: 10000,
    });

    expect(result.totalControllableExpense).toBe(1270);
    expect(result.controllableCategories[0]?.amount).toBe(850);
    expect(result.controllableCategories[0]?.name).toBe("Groceries");
    expect(result.controllableCategories[1]?.amount).toBe(420);
    expect(result.controllableCategories[1]?.name).toBe("Dining Out");
  });

  it("prioritizes `value` over static `amount` and prefers `/stat/ping` reporting-currency `computedIncome` when non-zero", () => {
    const historicalCategories: StatCategoryPoint[] = [
      {
        id: "cat-income-salary",
        title: "Salary",
        amount: 25000, // static current month
        value: 18000, // historical month value
      },
      {
        id: "cat-groceries",
        title: "Groceries",
        amount: 3000, // static current month
        value: 1250, // historical month value
      },
    ];

    const result = transformExpenses({
      statCategories: historicalCategories,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
      rawGrossIncome: 5000, // should be overridden by computedIncome (18000)
    });

    expect(result.grossIncome).toBe(18000);
    expect(result.totalControllableExpense).toBe(1250);
    expect(result.controllableCategories[0]?.amount).toBe(1250);
  });

  it("resolves category names from `statCat.title` when category metadata is missing", () => {
    const result = transformExpenses({
      statCategories: MOEXT_OCTOBER_STAT_CATEGORIES,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
    });

    const unmapped = result.controllableCategories.find((c) => c.id === "cat-unmapped-metadata");
    expect(unmapped).toBeDefined();
    expect(unmapped?.name).toBe("Pharmacy & Health");
    expect(unmapped?.amount).toBe(300);
  });

  it("groups small slices under threshold when more than 4 categories exist", () => {
    const slices = [
      { id: "1", name: "A", amount: 500, percentage: 50 },
      { id: "2", name: "B", amount: 300, percentage: 30 },
      { id: "3", name: "C", amount: 160, percentage: 16 },
      { id: "4", name: "D", amount: 20, percentage: 2 },
      { id: "5", name: "E", amount: 20, percentage: 2 },
    ];
    const grouped = groupSmallSlices(slices, 3);
    expect(grouped).toHaveLength(4);
    expect(grouped[3]?.id).toBe("other-grouped");
    expect(grouped[3]?.amount).toBe(40);
  });

  describe("smart grouping for Transport & Taxi (groupSmartSlices)", () => {
    it("identifies transport and taxi category names correctly", () => {
      expect(isTransportOrTaxi("Transport PLN")).toBe(true);
      expect(isTransportOrTaxi("Transport")).toBe(true);
      expect(isTransportOrTaxi("Taxi PLN")).toBe(true);
      expect(isTransportOrTaxi("Taxi / Delivery")).toBe(true);
      expect(isTransportOrTaxi("Uber")).toBe(true);
      expect(isTransportOrTaxi("Bolt")).toBe(true);
      expect(isTransportOrTaxi("Groceries")).toBe(false);
      expect(isTransportOrTaxi("Apartment Rent")).toBe(false);

      expect(isTaxiCategory("Taxi PLN")).toBe(true);
      expect(isTaxiCategory("Uber Ride")).toBe(true);
      expect(isTaxiCategory("Bolt")).toBe(true);
      expect(isTaxiCategory("Transport PLN")).toBe(false);
      expect(isTaxiCategory("Public Transport")).toBe(false);
    });

    it("links Transport and Taxi into a unified slice when either is below threshold (< 3%)", () => {
      const slices = [
        { id: "cat-groceries", name: "Groceries", amount: 2400, percentage: 60 },
        { id: "cat-dining", name: "Dining Out", amount: 1200, percentage: 30 },
        { id: "cat-transport", name: "Transport PLN", amount: 60, percentage: 1.5 },
        { id: "cat-taxi", name: "Taxi PLN", amount: 40, percentage: 1.0 },
        { id: "cat-misc-1", name: "Misc Subscriptions", amount: 50, percentage: 1.25 },
        { id: "cat-misc-2", name: "Office Supplies", amount: 50, percentage: 1.25 },
      ];

      const grouped = groupSmartSlices(slices, 3);

      // Expect Transport + Taxi combined into a smart group slice
      const transportGroup = grouped.find((s) => s.id === "group-transport");
      expect(transportGroup).toBeDefined();
      expect(transportGroup?.name).toBe("Transport (incl. Taxi)");
      expect(transportGroup?.amount).toBe(100); // 60 + 40
      expect(transportGroup?.isSmartGroup).toBe(true);
      expect(transportGroup?.children).toHaveLength(2);
      expect(transportGroup?.children?.map((c) => c.name)).toEqual(["Transport PLN", "Taxi PLN"]);

      // Smart group must NOT be collapsed into "other-grouped", while misc-1 & misc-2 ARE collapsed
      const otherGroup = grouped.find((s) => s.id === "other-grouped");
      expect(otherGroup).toBeDefined();
      expect(otherGroup?.amount).toBe(100); // 50 + 50

      // Total grouped slices: Groceries, Dining Out, Transport (incl. Taxi), Other Categories
      expect(grouped).toHaveLength(4);
    });

    it("retains independent slices when both Transport and Taxi are >= 3%", () => {
      const slices = [
        { id: "cat-groceries", name: "Groceries", amount: 2000, percentage: 50 },
        { id: "cat-dining", name: "Dining Out", amount: 1200, percentage: 30 },
        { id: "cat-transport", name: "Transport PLN", amount: 400, percentage: 10 },
        { id: "cat-taxi", name: "Taxi PLN", amount: 200, percentage: 5 },
        { id: "cat-misc", name: "Misc", amount: 200, percentage: 5 },
      ];

      const grouped = groupSmartSlices(slices, 3);
      expect(grouped.some((s) => s.id === "group-transport")).toBe(false);
      expect(grouped.some((s) => s.id === "cat-transport")).toBe(true);
      expect(grouped.some((s) => s.id === "cat-taxi")).toBe(true);
    });

    it("rolls up multi-currency categories sharing canonical base name into a smart group", () => {
      const slices = [
        { id: "cat-med-clean", name: "Medicine", amount: 400, percentage: 40 },
        { id: "cat-med-uah", name: "Medicine UAH", amount: 100, percentage: 10 },
        { id: "cat-groceries", name: "Groceries", amount: 500, percentage: 50 },
      ];

      const grouped = groupSmartSlices(slices, 3);

      const medGroup = grouped.find((s) => s.name === "Medicine");
      expect(medGroup).toBeDefined();
      expect(medGroup?.amount).toBe(500); // 400 + 100
      expect(medGroup?.isSmartGroup).toBe(true);
      expect(medGroup?.hasForeignCurrency).toBe(true);
      expect(medGroup?.foreignCurrencies).toEqual(["UAH"]);
      expect(medGroup?.children).toHaveLength(2);
      expect(medGroup?.children?.map((c) => c.name)).toEqual(["Medicine", "Medicine UAH"]);

      // Total slices: Groceries, Medicine
      expect(grouped).toHaveLength(2);
    });

    it("rolls up Ukrainian Cyrillic categories with canonical English counterparts", () => {
      const slices = [
        { id: "cat-med-pln", name: "Medicine PLN", amount: 300, percentage: 60 },
        { id: "cat-med-ua", name: "Ліки", amount: 100, percentage: 20 },
        { id: "cat-other", name: "Groceries", amount: 100, percentage: 20 },
      ];

      const grouped = groupSmartSlices(slices, 3);

      const medGroup = grouped.find((s) => s.name === "Medicine");
      expect(medGroup).toBeDefined();
      expect(medGroup?.amount).toBe(400); // 300 + 100
      expect(medGroup?.isSmartGroup).toBe(true);
      expect(medGroup?.hasForeignCurrency).toBe(true);
      expect(medGroup?.foreignCurrencies).toEqual(["UAH"]);
      expect(medGroup?.children).toHaveLength(2);
    });

    it("detects foreign currency on standalone foreign slices", () => {
      expect(detectSliceCurrency("Hotels UAH")).toEqual({ currency: "UAH", isForeign: true });
      expect(detectSliceCurrency("Sport EUR")).toEqual({ currency: "EUR", isForeign: true });
      expect(detectSliceCurrency("Medicine")).toEqual({ currency: "PLN", isForeign: false });
      expect(detectSliceCurrency("Medicine PLN")).toEqual({ currency: "PLN", isForeign: false });
      expect(detectSliceCurrency("Ліки")).toEqual({ currency: "UAH", isForeign: true });
    });

    it("normalizes foreign amounts when currencies are provided to groupSmartSlices", () => {
      const mockCurrencies: ExternalProviderCurrency[] = [
        { id: "PLN", rate: 4.0 },
        { id: "USD", rate: 1.0 },
        { id: "UAH", rate: 40.0 },
      ];
      const slices = [
        { id: "cat-med-clean", name: "Medicine", amount: 400, percentage: 80 },
        { id: "cat-med-uah", name: "Medicine UAH", amount: 400, percentage: 20 },
      ];

      const grouped = groupSmartSlices(slices, 3, "PLN", mockCurrencies);
      const medGroup = grouped.find((s) => s.name === "Medicine");
      expect(medGroup).toBeDefined();
      // 400 PLN + (400 UAH / 40 * 4 = 40 PLN) = 440 PLN
      expect(medGroup?.amount).toBe(440);
    });
  });
});

describe("computeBudgetSummaryItems (budget-summary-card)", () => {
  const categoryNameMap = new Map(MOEXT_CATEGORIES.map((c) => [c.id, c.name]));

  it("extracts spent amounts from `amount` and flags overruns", () => {
    const items = computeBudgetSummaryItems(MOEXT_STAT_PING_DATA, "2026-10-01", categoryNameMap);

    expect(items.length).toBeGreaterThanOrEqual(4);
    const dining = items.find((item) => item.id === "cat-dining");
    expect(dining).toBeDefined();
    expect(dining?.current).toBe(1250.25);
    expect(dining?.limit).toBe(1000);
    expect(dining?.isOverrun).toBe(true);
    expect(dining?.rawPercent).toBe(125);

    const pharmacy = items.find((item) => item.id === "cat-unmapped-metadata");
    expect(pharmacy).toBeDefined();
    expect(pharmacy?.name).toBe("Pharmacy & Health");
    expect(pharmacy?.current).toBe(300);
  });

  it("matches point by normalized month-start when mid-month date is passed and returns empty array without fallback when month is absent", () => {
    // 2026-10-24 normalizes to 2026-10-01 and matches October point
    const items = computeBudgetSummaryItems(MOEXT_STAT_PING_DATA, "2026-10-24", categoryNameMap);
    const groceries = items.find((item) => item.id === "cat-groceries");
    expect(groceries).toBeDefined();
    expect(groceries?.current).toBe(2450.75);

    // 2026-11-01 is absent from points and must resolve strictly to empty array without falling back to points[0]
    const emptyItems = computeBudgetSummaryItems(MOEXT_STAT_PING_DATA, "2026-11-01", categoryNameMap);
    expect(emptyItems).toEqual([]);
  });

  it("prioritizes `value` over static `amount` and resolves point by normalized `parsePointDate(p)?.dateStr === fromDate`", () => {
    const multiMonthData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            date: "10-2026",
            categories: [
              {
                id: "cat-groceries",
                title: "Groceries",
                amount: 3000,
                value: 3000,
                limitAmount: 3000,
              },
            ],
          },
          {
            id: "9-2026",
            date: "9-2026",
            categories: [
              {
                id: "cat-groceries",
                title: "Groceries",
                amount: 3000, // static snapshot
                value: 1950, // actual historical spend
                limitAmount: 3000,
              },
            ],
          },
        ],
      },
    };

    const items = computeBudgetSummaryItems(multiMonthData, "2026-09-01", categoryNameMap);
    const groceries = items.find((item) => item.id === "cat-groceries");
    expect(groceries).toBeDefined();
    expect(groceries?.current).toBe(1950);
  });

  it("filters strictly by CategoryType.Expense, excluding CategoryType.Income and account types", () => {
    const categoryTypeMap = new Map(MOEXT_CATEGORIES.map((c) => [c.id, c.categoryType]));
    const items = computeBudgetSummaryItems(MOEXT_STAT_PING_DATA, "2026-10-01", categoryNameMap, categoryTypeMap);

    // Verify cat-income-salary is excluded
    const incomeItem = items.find((item) => item.id === "cat-income-salary");
    expect(incomeItem).toBeUndefined();

    // Verify expense categories are included
    const dining = items.find((item) => item.id === "cat-dining");
    expect(dining).toBeDefined();
    const groceries = items.find((item) => item.id === "cat-groceries");
    expect(groceries).toBeDefined();

    // Verify account types are excluded if present in statData
    const statDataWithAccount: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-dining", amount: 500, value: 500, limitAmount: 1000 },
              { id: "acc-bank", amount: 10000, value: 10000, limitAmount: 0 },
              { id: "cat-salary", amount: 20000, value: 20000, limitAmount: 0 },
            ],
          },
        ],
      },
    };
    const testTypeMap = new Map([
      ["cat-dining", CategoryType.Expense],
      ["acc-bank", CategoryType.BankAccount],
      ["cat-salary", CategoryType.Income],
    ]);
    const filtered = computeBudgetSummaryItems(statDataWithAccount, "2026-10-01", categoryNameMap, testTypeMap);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("cat-dining");
  });

  it("strictly filters out deleted categories by default", () => {
    const statDataWithDeleted: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-active", amount: 100, value: 100, limitAmount: 500 },
              { id: "cat-deleted", amount: 200, value: 200, limitAmount: 500, deleted: true },
            ],
          },
        ],
      },
    };
    const testNameMap = new Map([
      ["cat-active", "Groceries"],
      ["cat-deleted", "Old Gym"],
    ]);
    const items = computeBudgetSummaryItems(statDataWithDeleted, "2026-10-01", testNameMap);
    expect(items.map((i) => i.id)).toEqual(["cat-active"]);

    const withDeleted = computeBudgetSummaryItems(statDataWithDeleted, "2026-10-01", testNameMap, {
      includeDeleted: true,
    });
    expect(withDeleted.map((i) => i.id)).toEqual(["cat-deleted", "cat-active"]);
  });

  it("filters out deleted categories via deletedCategoryIds set", () => {
    const statData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-1", amount: 100, value: 100, limitAmount: 500 },
              { id: "cat-2", amount: 200, value: 200, limitAmount: 500 },
            ],
          },
        ],
      },
    };
    const testNameMap = new Map([
      ["cat-1", "Cat 1"],
      ["cat-2", "Cat 2"],
    ]);
    const items = computeBudgetSummaryItems(statData, "2026-10-01", testNameMap, {
      deletedCategoryIds: new Set(["cat-2"]),
    });
    expect(items.map((i) => i.id)).toEqual(["cat-1"]);
  });

  it("does not leak unarchived zero-spend categories when includeArchivedInactive is enabled", () => {
    const statData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-active", amount: 50, value: 50, limitAmount: 100 },
              { id: "cat-archived-inactive", amount: 0, value: 0, limitAmount: 0 },
              { id: "cat-unarchived-inactive", amount: 0, value: 0, limitAmount: 0 },
              { id: "cat-deleted", amount: 0, value: 0, limitAmount: 0, deleted: true },
            ],
          },
        ],
      },
    };
    const testNameMap = new Map([
      ["cat-active", "Active Spent"],
      ["cat-archived-inactive", "_Archived Inactive"],
      ["cat-unarchived-inactive", "Zero Spend Unarchived"],
      ["cat-deleted", "_Deleted Inactive"],
    ]);
    const items = computeBudgetSummaryItems(statData, "2026-10-01", testNameMap, {
      includeArchivedInactive: true,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("cat-active");
    expect(ids).toContain("cat-archived-inactive");
    expect(ids).not.toContain("cat-unarchived-inactive");
    expect(ids).not.toContain("cat-deleted");
  });

  it("prioritizes categoryNameMap over snapshot cat.title and cat.name when renamed or archived", () => {
    const statData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-archived", title: "Groceries", name: "Groceries", amount: 0, value: 0, limitAmount: 0 },
              {
                id: "cat-renamed",
                title: "Old Utilities",
                name: "Old Utilities",
                amount: 150,
                value: 150,
                limitAmount: 200,
              },
              {
                id: "cat-unmapped",
                title: "Fallback Snapshot",
                name: "Fallback Snapshot",
                amount: 50,
                value: 50,
                limitAmount: 100,
              },
            ],
          },
        ],
      },
    };
    const testNameMap = new Map([
      ["cat-archived", "_Groceries"],
      ["cat-renamed", "Electricity & Gas"],
    ]);

    const items = computeBudgetSummaryItems(statData, "2026-10-01", testNameMap, {
      includeArchivedInactive: true,
    });

    const archivedItem = items.find((i) => i.id === "cat-archived");
    expect(archivedItem).toBeDefined();
    expect(archivedItem?.name).toBe("_Groceries");

    const renamedItem = items.find((i) => i.id === "cat-renamed");
    expect(renamedItem).toBeDefined();
    expect(renamedItem?.name).toBe("Electricity & Gas");

    const unmappedItem = items.find((i) => i.id === "cat-unmapped");
    expect(unmappedItem).toBeDefined();
    expect(unmappedItem?.name).toBe("Fallback Snapshot");
  });

  it("supports standalone foreign categories by calculating convertedCurrent and convertedLimit", () => {
    const mockCurrencies: ExternalProviderCurrency[] = [
      { id: "PLN", rate: 4.0 },
      { id: "USD", rate: 1.0 },
      { id: "UAH", rate: 40.0 },
    ];
    const statData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            // Upstream /stat/ping pre-converts spend to reporting currency PLN: 400 PLN (= 4000 UAH)
            categories: [{ id: "cat-foreign-uah", amount: 400, value: 400, limitAmount: 5000 }],
          },
        ],
      },
    };
    const testNameMap = new Map([["cat-foreign-uah", "Ukraine Utilities"]]);
    const categoryCurrencyMap = new Map([["cat-foreign-uah", "UAH"]]);

    const items = computeBudgetSummaryItems(statData, "2026-10-01", testNameMap, {
      categoryCurrencyMap,
      defaultCurrency: "PLN",
      currencies: mockCurrencies,
    });

    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.id).toBe("cat-foreign-uah");
    expect(item.nativeCurrency).toBe("UAH");
    expect(item.isForeign).toBe(true);
    expect(item.current).toBe(4000); // native amount
    expect(item.limit).toBe(5000); // native limit
    // 4000 UAH / 40 * 4 = 400 PLN
    expect(item.convertedCurrent).toBe(400);
    // 5000 UAH / 40 * 4 = 500 PLN
    expect(item.convertedLimit).toBe(500);
  });

  it("normalizes Smart Category Groups into default reporting currency while keeping children in native currencies", () => {
    const mockCurrencies: ExternalProviderCurrency[] = [
      { id: "PLN", rate: 4.0 },
      { id: "USD", rate: 1.0 },
      { id: "UAH", rate: 40.0 },
    ];
    const statData: StatPingData = {
      selection: {
        points: [
          {
            id: "2026-10-01",
            categories: [
              { id: "cat-uber-pln", amount: 100, value: 100, limitAmount: 200 },
              // Upstream /stat/ping pre-converts spend to reporting currency PLN: 40 PLN (= 400 UAH)
              { id: "cat-uber-uah", amount: 40, value: 40, limitAmount: 800 },
            ],
          },
        ],
      },
    };
    const testNameMap = new Map([
      ["cat-uber-pln", "Uber (PLN)"],
      ["cat-uber-uah", "Uber (UAH)"],
    ]);
    const categoryCurrencyMap = new Map([
      ["cat-uber-pln", "PLN"],
      ["cat-uber-uah", "UAH"],
    ]);

    const items = computeBudgetSummaryItems(statData, "2026-10-01", testNameMap, {
      categoryCurrencyMap,
      defaultCurrency: "PLN",
      currencies: mockCurrencies,
      enableSmartGroups: true,
    });

    expect(items).toHaveLength(1);
    const group = items[0];
    expect(group.isSmartGroup).toBe(true);
    expect(group.name).toBe("Uber");
    expect(group.nativeCurrency).toBe("PLN");
    // cat-uber-pln: 100 current, 200 limit
    // cat-uber-uah: 400 UAH -> 40 PLN current, 800 UAH -> 80 PLN limit
    // combined current = 140 PLN, combined limit = 280 PLN
    expect(group.current).toBe(140);
    expect(group.limit).toBe(280);
    expect(group.rawPercent).toBe(50);
    expect(group.children).toHaveLength(2);

    const childPln = group.children?.find((c) => c.id === "cat-uber-pln");
    expect(childPln?.current).toBe(100);
    expect(childPln?.limit).toBe(200);
    expect(childPln?.nativeCurrency).toBe("PLN");
    expect(childPln?.isForeign).toBe(false);

    const childUah = group.children?.find((c) => c.id === "cat-uber-uah");
    expect(childUah?.current).toBe(400);
    expect(childUah?.limit).toBe(800);
    expect(childUah?.nativeCurrency).toBe("UAH");
    expect(childUah?.isForeign).toBe(true);
    expect(childUah?.convertedCurrent).toBe(40);
    expect(childUah?.convertedLimit).toBe(80);
  });
});

describe("parsePointDate & transformYoYPoints", () => {
  it("prioritizes ISO `point.id` even when `point.date` is in `M-yyyy` format", () => {
    const parsed = parsePointDate({
      id: "2026-09-01",
      date: "9-2026",
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.year).toBe(2026);
    expect(parsed?.monthIndex).toBe(8);
    expect(parsed?.dateStr).toBe("2026-09-01");
  });

  it("parses `M-yyyy` and `MM-yyyy` fallback when `point.id` is absent or non-ISO", () => {
    const singleDigitMonth = parsePointDate({
      id: "",
      date: "9-2026",
    });
    expect(singleDigitMonth).not.toBeNull();
    expect(singleDigitMonth?.year).toBe(2026);
    expect(singleDigitMonth?.monthIndex).toBe(8);
    expect(singleDigitMonth?.dateStr).toBe("2026-09-01");

    const doubleDigitMonth = parsePointDate({
      id: "invalid-id",
      date: "12-2025",
    });
    expect(doubleDigitMonth).not.toBeNull();
    expect(doubleDigitMonth?.year).toBe(2025);
    expect(doubleDigitMonth?.monthIndex).toBe(11);
    expect(doubleDigitMonth?.dateStr).toBe("2025-12-01");
  });

  it("aggregates multi-year points and computes YoY deltas without dropping `M-yyyy` points", () => {
    const yoy = transformYoYPoints({
      points: MOEXT_STAT_POINTS,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
    });

    expect(yoy.totalPointsParsed).toBe(3);
    expect(yoy.availableYears).toEqual([2025, 2026]);

    // October is monthIndex 9
    const october = yoy.monthlyData[9];
    expect(october).toBeDefined();
    expect(october?.years[2025]?.controllableExpense).toBe(3000);
    expect(october?.years[2026]?.controllableExpense).toBe(4001);
    expect(october?.deltas[2026]).toBeDefined();
    expect(october?.deltas[2026]?.controllableDeltaAbs).toBe(1001);
  });

  it("computes YoY metrics from historical `value` when `amount` holds static current-month snapshot across all points", () => {
    const staticAmountMultiYearPoints: StatPoint[] = [
      {
        id: "2026-05-01",
        date: "5-2026",
        categories: [
          {
            id: "cat-groceries",
            title: "Groceries",
            amount: 8451.47, // Constant current-month snapshot
            value: 5000, // May 2026 spending
            limitAmount: 6000,
          },
        ],
      },
      {
        id: "2025-05-01",
        date: "5-2025",
        categories: [
          {
            id: "cat-groceries",
            title: "Groceries",
            amount: 8451.47, // Constant current-month snapshot (identical to 2026)
            value: 4000, // May 2025 spending
            limitAmount: 6000,
          },
        ],
      },
    ];

    const yoy = transformYoYPoints({
      points: staticAmountMultiYearPoints,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
    });

    const may = yoy.monthlyData[4]; // May is monthIndex 4
    expect(may?.years[2026]?.controllableExpense).toBe(5000);
    expect(may?.years[2025]?.controllableExpense).toBe(4000);
    expect(may?.deltas[2026]?.controllableDeltaAbs).toBe(1000);
    expect(may?.deltas[2026]?.controllableDeltaPercent).toBe(25); // +25% YoY, not 0.0%
  });
});

describe("transformChronologicalTrends & Timeline Zoom Helpers", () => {
  it("derives chronological trend points from `value` when `amount` is constant across historical periods", () => {
    const staticAmountPoints: StatPoint[] = [
      {
        id: "2026-01-01",
        date: "1-2026",
        categories: [
          {
            id: "cat-groceries",
            title: "Groceries",
            amount: 8451.47,
            value: 3200,
            limitAmount: 5000,
          },
        ],
      },
      {
        id: "2026-02-01",
        date: "2-2026",
        categories: [
          {
            id: "cat-groceries",
            title: "Groceries",
            amount: 8451.47,
            value: 4100,
            limitAmount: 5000,
          },
        ],
      },
    ];

    const trends = transformChronologicalTrends({
      points: staticAmountPoints,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
      currentLiquidBalance: 50000,
      currentNetWorth: 100000,
    });

    expect(trends.points[0]?.controllableExpense).toBe(3200);
    expect(trends.points[1]?.controllableExpense).toBe(4100);
  });
  it("builds a chronological timeline with backward-reconstructed liquid balance and net worth", () => {
    const result = transformChronologicalTrends({
      points: MOEXT_STAT_POINTS,
      categories: MOEXT_CATEGORIES,
      activePreset: MOCK_PRESET,
      currentLiquidBalance: 50000,
      currentNetWorth: 120000,
    });

    expect(result.totalPoints).toBe(3);
    expect(result.points.map((p) => p.dateStr)).toEqual(["2025-10-01", "2026-09-01", "2026-10-01"]);

    const oct26 = result.points[2];
    expect(oct26.monthLabel).toBe("Oct'26");
    expect(oct26.netIncome).toBe(17000); // availableControllablePool = 21500 - 4500 (rent)
    expect(oct26.netDisposableIncome).toBe(21500);
    expect(oct26.availableControllablePool).toBe(17000);
    expect(oct26.controllableExpense).toBe(4001);
    expect(oct26.netCashFlowMargin).toBe(12999);
    expect(oct26.netIncome - oct26.controllableExpense).toBe(oct26.netCashFlowMargin);
    expect(oct26.savingsRate).toBe(Math.round((12999 / 21500) * 100)); // 60%
    expect(oct26.liquidBalance).toBe(50000);
    expect(oct26.netWorth).toBe(120000);

    const sep26 = result.points[1];
    expect(sep26.monthLabel).toBe("Sep'26");
    expect(sep26.controllableExpense).toBe(2100);
    expect(sep26.netCashFlowMargin).toBe(-2100);
    // Walking backward: sep26 balance = oct26 balance - oct26 margin
    expect(sep26.liquidBalance).toBe(50000 - 12999); // 37001
    expect(sep26.netWorth).toBe(120000 - 12999); // 107001

    const oct25 = result.points[0];
    expect(oct25.monthLabel).toBe("Oct'25");
    // oct25 balance = sep26 balance - sep26 margin
    expect(oct25.liquidBalance).toBe(37001 - -2100); // 39101
    expect(oct25.netWorth).toBe(107001 - -2100); // 109101
  });

  it("computes current net worth including accounts, debts, and goals while excluding deleted ones", () => {
    const testCategories: ExternalProviderCategory[] = [
      {
        id: "acc-1",
        name: "Checking",
        categoryType: CategoryType.BankAccount,
        amount: 15000,
        currencyId: "PLN",
      },
      {
        id: "acc-2",
        name: "Savings Goal",
        categoryType: CategoryType.Goal,
        amount: 25000,
        currencyId: "PLN",
        exceptFromBalance: true,
      },
      {
        id: "acc-3",
        name: "Credit Card Debt",
        categoryType: CategoryType.DebtAccount,
        amount: -4000,
        currencyId: "PLN",
      },
      {
        id: "acc-deleted",
        name: "Old Account",
        categoryType: CategoryType.Account,
        amount: 9999,
        deleted: true,
      },
      {
        id: "exp-1",
        name: "Groceries",
        categoryType: CategoryType.Expense,
        amount: 200,
      },
    ];

    const netWorth = computeTotalNetWorth(testCategories, [], "PLN");
    // 15000 + 25000 - 4000 = 36000
    expect(netWorth).toBe(36000);
  });

  it("filters chronological trend points by window presets (6M, 12M, 24M, 40M) and custom dates", () => {
    const mockTimelinePoints = Array.from({ length: 30 }, (_, i) => {
      const month = (i % 12) + 1;
      const year = 2024 + Math.floor(i / 12);
      const mStr = String(month).padStart(2, "0");
      return {
        dateStr: `${year}-${mStr}-01`,
        year,
        monthIndex: month - 1,
        monthLabel: `M${i}`,
        timestamp: new Date(year, month - 1, 1).getTime(),
        netIncome: 9000,
        netDisposableIncome: 10000,
        availableControllablePool: 9000,
        controllableExpense: 5000,
        netCashFlowMargin: 5000,
        totalExpense: 6000,
        grossIncome: 10000,
        excludedExpenseSum: 1000,
        taxDeductions: 0,
        savingsRate: 50,
        liquidBalance: 50000 + i * 5000,
        netWorth: 100000 + i * 5000,
      };
    });

    expect(filterChronologicalTrends(mockTimelinePoints, "6M")).toHaveLength(6);
    expect(filterChronologicalTrends(mockTimelinePoints, "12M")).toHaveLength(12);
    expect(filterChronologicalTrends(mockTimelinePoints, "24M")).toHaveLength(24);
    expect(filterChronologicalTrends(mockTimelinePoints, "40M")).toHaveLength(30);

    // Custom [from, to] date filtering
    const customFiltered = filterChronologicalTrends(mockTimelinePoints, {
      customFrom: "2025-01-01",
      customTo: "2025-06-01",
    });
    expect(customFiltered).toHaveLength(6);
    expect(customFiltered[0].dateStr).toBe("2025-01-01");
    expect(customFiltered[5].dateStr).toBe("2025-06-01");
  });

  it("steps timeline zoom ranges inward and outward correctly", () => {
    expect(stepZoomRange("40M", "in")).toBe("24M");
    expect(stepZoomRange("24M", "in")).toBe("12M");
    expect(stepZoomRange("12M", "in")).toBe("6M");
    expect(stepZoomRange("6M", "in")).toBe("6M");

    expect(stepZoomRange("6M", "out")).toBe("12M");
    expect(stepZoomRange("12M", "out")).toBe("24M");
    expect(stepZoomRange("24M", "out")).toBe("40M");
    expect(stepZoomRange("40M", "out")).toBe("40M");
  });
});

describe("computePeriodComparison", () => {
  const currentTransformed = transformExpenses({
    statCategories: [
      { id: "cat-groceries", title: "Groceries", amount: 2500, value: 2500 },
      { id: "cat-dining", title: "Dining", amount: 1200, value: 1200 },
      { id: "cat-vacation", title: "Vacation", amount: 800, value: 800 },
    ],
    categories: MOEXT_CATEGORIES,
    activePreset: MOCK_PRESET,
    rawGrossIncome: 20000,
  });

  const baselineTransformed = transformExpenses({
    statCategories: [
      { id: "cat-groceries", title: "Groceries", amount: 2000, value: 2000 },
      { id: "cat-dining", title: "Dining", amount: 1500, value: 1500 },
      { id: "cat-old", title: "Old Category", amount: 400, value: 400 },
    ],
    categories: MOEXT_CATEGORIES,
    activePreset: MOCK_PRESET,
    rawGrossIncome: 18000,
  });

  it("returns null when baseline is null or undefined", () => {
    expect(computePeriodComparison(currentTransformed, null)).toBeNull();
    expect(computePeriodComparison(currentTransformed, undefined)).toBeNull();
  });

  it("calculates accurate KPI deltas and percentages", () => {
    const comparison = computePeriodComparison(currentTransformed, baselineTransformed);
    expect(comparison).not.toBeNull();
    if (!comparison) return;

    // Gross Income: 20000 vs 18000 -> +2000 (+11.11%)
    expect(comparison.grossIncome.deltaAbs).toBe(2000);
    expect(comparison.grossIncome.deltaPercent).toBeCloseTo(11.11, 1);

    // Controllable Expense: (2500 + 1200 + 800 = 4500) vs (2000 + 1500 + 400 = 3900) -> +600 (+15.38%)
    expect(comparison.totalControllableExpense.current).toBe(4500);
    expect(comparison.totalControllableExpense.baseline).toBe(3900);
    expect(comparison.totalControllableExpense.deltaAbs).toBe(600);
    expect(comparison.totalControllableExpense.deltaPercent).toBeCloseTo(15.38, 1);
  });

  it("computes per-category variance, flags new categories, and handles removed categories", () => {
    const comparison = computePeriodComparison(currentTransformed, baselineTransformed);
    expect(comparison).not.toBeNull();
    if (!comparison) return;

    // Groceries: 2500 vs 2000 -> +500 (+25%)
    const groceries = comparison.categoryDeltaMap.get("cat-groceries");
    expect(groceries).toBeDefined();
    expect(groceries?.deltaAbs).toBe(500);
    expect(groceries?.deltaPercent).toBe(25);
    expect(groceries?.isNew).toBe(false);

    // Dining: 1200 vs 1500 -> -300 (-20%)
    const dining = comparison.categoryDeltaMap.get("cat-dining");
    expect(dining).toBeDefined();
    expect(dining?.deltaAbs).toBe(-300);
    expect(dining?.deltaPercent).toBe(-20);
    expect(dining?.isNew).toBe(false);

    // Vacation: 800 vs 0 -> +800, isNew = true, deltaPercent = null
    const vacation = comparison.categoryDeltaMap.get("cat-vacation");
    expect(vacation).toBeDefined();
    expect(vacation?.currentAmount).toBe(800);
    expect(vacation?.baselineAmount).toBe(0);
    expect(vacation?.deltaAbs).toBe(800);
    expect(vacation?.isNew).toBe(true);
    expect(vacation?.deltaPercent).toBeNull();

    // Old Category: 0 vs 400 -> -400 (-100%)
    const oldCat = comparison.categoryDeltaMap.get("cat-old");
    expect(oldCat).toBeDefined();
    expect(oldCat?.currentAmount).toBe(0);
    expect(oldCat?.baselineAmount).toBe(400);
    expect(oldCat?.deltaAbs).toBe(-400);
    expect(oldCat?.deltaPercent).toBe(-100);
    expect(oldCat?.isNew).toBe(false);
  });
});

describe("extractAvailableMonths & resolveBaselineMonth", () => {
  const mockPoints = [
    { id: "2026-10-01", date: "10-2026" },
    { id: "2026-09-01", date: "9-2026" },
    { id: "2026-08-01", date: "8-2026" },
    { id: "2025-10-01", date: "10-2025" },
  ];

  it("extracts available months deduplicated and sorted descending", () => {
    const months = extractAvailableMonths(mockPoints);
    expect(months.length).toBeGreaterThanOrEqual(4);
    expect(months.some((m) => m.dateStr === "2026-10-01")).toBe(true);
    expect(months.some((m) => m.dateStr === "2025-10-01")).toBe(true);

    // Sorted descending
    for (let i = 0; i < months.length - 1; i++) {
      expect(months[i].dateStr >= months[i + 1].dateStr).toBe(true);
    }
  });

  it("navigates previous and next months with bounds checking", () => {
    const months = extractAvailableMonths(mockPoints);
    const prev = getPrevMonth("2026-10-01", months);
    expect(prev?.dateStr).toBe("2026-09-01");

    const next = getNextMonth("2026-09-01", months);
    expect(next?.dateStr).toBe("2026-10-01");

    // Earliest month has no previous
    const earliest = months[months.length - 1];
    expect(getPrevMonth(earliest.dateStr, months)).toBeNull();
  });

  it("resolves baseline months for prev_month, prev_year, and custom modes", () => {
    const months = extractAvailableMonths(mockPoints);

    // Prev month from Oct 2026 -> Sep 2026
    const prevMonthRes = resolveBaselineMonth("2026-10-01", "prev_month", months);
    expect(prevMonthRes).toEqual({
      dateStr: "2026-09-01",
      label: "Sep 2026",
      hasData: true,
    });

    // Prev year from Oct 2026 -> Oct 2025
    const prevYearRes = resolveBaselineMonth("2026-10-01", "prev_year", months);
    expect(prevYearRes).toEqual({
      dateStr: "2025-10-01",
      label: "Oct 2025",
      hasData: true,
    });

    // Custom mode
    const customRes = resolveBaselineMonth("2026-10-01", "custom", months, "2026-08-01");
    expect(customRes).toEqual({
      dateStr: "2026-08-01",
      label: "Aug 2026",
      hasData: true,
    });

    // Baseline month with no data in mock points
    const noDataRes = resolveBaselineMonth("2026-10-01", "custom", months, "2020-01-01");
    expect(noDataRes?.hasData).toBe(false);
  });
});

describe("Multi-category exclusions & available controllable pool macro trends", () => {
  const multiCatCategories: ExternalProviderCategory[] = [
    { id: "c-salary", name: "Salary", categoryType: CategoryType.Income, amount: 0, limitAmount: 0 },
    { id: "c-taxes", name: "Taxes ZUS", categoryType: CategoryType.Expense, amount: 0, limitAmount: 0 },
    { id: "c-rent", name: "Apartment Rent", categoryType: CategoryType.Expense, amount: 0, limitAmount: 0 },
    { id: "c-insurance", name: "Insurance PLN", categoryType: CategoryType.Expense, amount: 0, limitAmount: 0 },
    { id: "c-groceries", name: "Groceries", categoryType: CategoryType.Expense, amount: 0, limitAmount: 0 },
  ];

  const multiCatStatPoints: StatPoint[] = [
    {
      id: "2026-10-01",
      date: "10-2026",
      categories: [
        { id: "c-salary", title: "Salary", amount: 30000, value: 30000, currentAmount: 0 },
        { id: "c-taxes", title: "Taxes ZUS", amount: 5000, value: 5000, currentAmount: 0 },
        { id: "c-rent", title: "Apartment Rent", amount: 4500, value: 4500, currentAmount: 0 },
        { id: "c-insurance", title: "Insurance PLN", amount: 1500, value: 1500, currentAmount: 0 },
        { id: "c-groceries", title: "Groceries", amount: 4000, value: 4000, currentAmount: 0 },
      ],
    },
    {
      id: "2025-10-01",
      date: "10-2025",
      categories: [
        { id: "c-salary", title: "Salary", amount: 26000, value: 26000, currentAmount: 0 },
        { id: "c-taxes", title: "Taxes ZUS", amount: 4000, value: 4000, currentAmount: 0 },
        { id: "c-rent", title: "Apartment Rent", amount: 4000, value: 4000, currentAmount: 0 },
        { id: "c-insurance", title: "Insurance PLN", amount: 1000, value: 1000, currentAmount: 0 },
        { id: "c-groceries", title: "Groceries", amount: 3500, value: 3500, currentAmount: 0 },
      ],
    },
  ];

  it("deducts multiple excluded categories (Rent + Insurance) from the controllable income pool", () => {
    const multiExclusionPreset: ExclusionPreset = {
      id: "rent-and-insurance-excluded",
      name: "Rent & Insurance Excluded",
      incomeDeductions: ["c-taxes"],
      expenseExclusions: ["c-rent", "c-insurance"],
      isBuiltIn: false,
    };

    const trends = transformChronologicalTrends({
      points: multiCatStatPoints,
      categories: multiCatCategories,
      activePreset: multiExclusionPreset,
      currentLiquidBalance: 40000,
      currentNetWorth: 80000,
    });

    const oct26 = trends.points.find((p) => p.dateStr === "2026-10-01");
    expect(oct26).toBeDefined();

    // Gross = 30000, Taxes = 5000 -> Net Disposable = 25000
    expect(oct26?.grossIncome).toBe(30000);
    expect(oct26?.taxDeductions).toBe(5000);
    expect(oct26?.netDisposableIncome).toBe(25000);

    // Excluded = Rent (4500) + Insurance (1500) = 6000
    expect(oct26?.excludedExpenseSum).toBe(6000);

    // Controllable Expense = Groceries (4000)
    expect(oct26?.controllableExpense).toBe(4000);

    // Available Controllable Pool = Net Disposable (25000) - Excluded (6000) = 19000
    expect(oct26?.availableControllablePool).toBe(19000);
    // netIncome plotted on the curve reflects availableControllablePool
    expect(oct26?.netIncome).toBe(19000);

    // Invariant Net Cash Flow Margin = 25000 - (4000 + 6000) = 15000
    expect(oct26?.netCashFlowMargin).toBe(15000);

    // Crucial curve invariant: plotted income curve minus plotted expense curve EXACTLY equals net cash flow margin
    if (oct26) {
      expect(oct26.netIncome - oct26.controllableExpense).toBe(oct26.netCashFlowMargin);
    }

    // Savings rate is bottom-line margin over net disposable income: (15000 / 25000) * 100 = 60%
    expect(oct26?.savingsRate).toBe(60);
  });

  it("maintains invariant curve delta matching net cash flow margin in YoY multi-year metrics", () => {
    const multiExclusionPreset: ExclusionPreset = {
      id: "rent-and-insurance-excluded",
      name: "Rent & Insurance Excluded",
      incomeDeductions: ["c-taxes"],
      expenseExclusions: ["c-rent", "c-insurance"],
      isBuiltIn: false,
    };

    const yoy = transformYoYPoints({
      points: multiCatStatPoints,
      categories: multiCatCategories,
      activePreset: multiExclusionPreset,
    });

    const oct = yoy.monthlyData[9];
    const y2026 = oct?.years[2026];
    const y2025 = oct?.years[2025];

    expect(y2026).toBeDefined();
    expect(y2025).toBeDefined();

    if (y2026 && y2025) {
      // 2026: Available Pool = 25000 - 6000 = 19000; Controllable = 4000; Margin = 15000
      expect(y2026.netIncome).toBe(19000);
      expect(y2026.controllableExpense).toBe(4000);
      expect(y2026.netCashFlowMargin).toBe(15000);
      expect(y2026.netIncome - y2026.controllableExpense).toBe(y2026.netCashFlowMargin);
      expect(y2026.savingsRate).toBe(60);

      // 2025: Net Disposable = 26000 - 4000 = 22000. Excluded = 4000 + 1000 = 5000.
      // Available Pool = 22000 - 5000 = 17000. Controllable = 3500. Margin = 13500.
      expect(y2025.netIncome).toBe(17000);
      expect(y2025.controllableExpense).toBe(3500);
      expect(y2025.netCashFlowMargin).toBe(13500);
      expect(y2025.netIncome - y2025.controllableExpense).toBe(y2025.netCashFlowMargin);
      // Savings rate: 13500 / 22000 * 100 = 61%
      expect(y2025.savingsRate).toBe(Math.round((13500 / 22000) * 100));
    }
  });

  it("builds default presets with proper IDs and classifications", () => {
    const taxIds = findCategoryIdsByPattern(multiCatCategories, /(tax)/i);
    const rentIds = findCategoryIdsByPattern(multiCatCategories, /(rent)/i);

    expect(taxIds).toEqual(["c-taxes"]);
    expect(rentIds).toEqual(["c-rent"]);

    const defaults = buildDefaultPresets(taxIds, rentIds);
    expect(defaults).toHaveLength(3);
    expect(defaults[0].id).toBe(BUILT_IN_PRESET_IDS.ALL_ACTIVITY);
    expect(defaults[1].id).toBe(BUILT_IN_PRESET_IDS.NET_LIVING);
    expect(defaults[1].incomeDeductions).toEqual(["c-taxes"]);
    expect(defaults[2].id).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    expect(defaults[2].expenseExclusions).toEqual(["c-rent"]);
  });

  it("handles zero exclusions smoothly by equating availableControllablePool to netDisposableIncome", () => {
    const allActivityPreset: ExclusionPreset = {
      id: "all-activity",
      name: "All Activity",
      incomeDeductions: [],
      expenseExclusions: [],
      isBuiltIn: true,
    };

    const trends = transformChronologicalTrends({
      points: multiCatStatPoints,
      categories: multiCatCategories,
      activePreset: allActivityPreset,
      currentLiquidBalance: 40000,
      currentNetWorth: 80000,
    });

    const oct26 = trends.points.find((p) => p.dateStr === "2026-10-01");
    expect(oct26).toBeDefined();

    // When exclusions are empty:
    expect(oct26?.excludedExpenseSum).toBe(0);
    expect(oct26?.availableControllablePool).toBe(oct26?.netDisposableIncome);
    expect(oct26?.netIncome).toBe(oct26?.netDisposableIncome);
  });

  describe("Category Currency Matching & Progress Normalization", () => {
    const mockCurrencies: ExternalProviderCurrency[] = [
      { id: "USD", rate: 1.0 },
      { id: "PLN", rate: 4.0 },
      { id: "UAH", rate: 40.0 },
      { id: "EUR", rate: 0.9 },
    ];

    it("evaluates standalone foreign category progress in native currency without double conversion", () => {
      // Standalone category Sport UAH with limit 5000 UAH.
      // Upstream /stat/ping delivered 450 PLN (which corresponds to 4500 UAH at 4 PLN = 40 UAH).
      const statData: StatPingData = {
        selection: {
          params: { currency: "PLN" },
          points: [
            {
              id: "2026-10-01",
              date: "10-2026",
              categories: [
                {
                  id: "cat-sport-uah",
                  title: "Sport UAH",
                  limitAmount: 5000,
                  value: 450, // 450 PLN
                },
              ],
            },
          ],
        },
      };

      const categoryNameMap = new Map([["cat-sport-uah", "Sport UAH"]]);
      const categoryCurrencyMap = new Map([["cat-sport-uah", "UAH"]]);

      const items = computeBudgetSummaryItems(statData, "2026-10-01", categoryNameMap, {
        defaultCurrency: "PLN",
        categoryCurrencyMap,
        currencies: mockCurrencies,
        enableSmartGroups: false,
      });

      expect(items).toHaveLength(1);
      const sport = items[0];

      // Native values: 4500 UAH / 5000 UAH
      expect(sport.nativeCurrency).toBe("UAH");
      expect(sport.isForeign).toBe(true);
      expect(sport.current).toBe(4500);
      expect(sport.limit).toBe(5000);
      expect(sport.rawPercent).toBe(90);
      expect(sport.percent).toBe(90);
      expect(sport.isOverrun).toBe(false);

      // Tooltip values in reporting currency (PLN): ~450 PLN / ~500 PLN
      expect(sport.convertedCurrent).toBe(450);
      expect(sport.convertedLimit).toBe(500);
    });

    it("evaluates overrun accurately in native currency for foreign categories", () => {
      // Standalone category Travel EUR with limit 100 EUR.
      // Upstream /stat/ping delivered 500 PLN (which corresponds to 112.5 EUR at 4 PLN = 0.9 EUR).
      const statData: StatPingData = {
        selection: {
          params: { currency: "PLN" },
          points: [
            {
              id: "2026-10-01",
              date: "10-2026",
              categories: [
                {
                  id: "cat-travel-eur",
                  title: "Travel EUR",
                  limitAmount: 100,
                  value: 500, // 500 PLN -> 112.5 EUR
                },
              ],
            },
          ],
        },
      };

      const categoryNameMap = new Map([["cat-travel-eur", "Travel EUR"]]);
      const categoryCurrencyMap = new Map([["cat-travel-eur", "EUR"]]);

      const items = computeBudgetSummaryItems(statData, "2026-10-01", categoryNameMap, {
        defaultCurrency: "PLN",
        categoryCurrencyMap,
        currencies: mockCurrencies,
        enableSmartGroups: false,
      });

      expect(items).toHaveLength(1);
      const travel = items[0];

      expect(travel.nativeCurrency).toBe("EUR");
      expect(travel.current).toBe(112.5);
      expect(travel.limit).toBe(100);
      expect(travel.rawPercent).toBe(113);
      expect(travel.percent).toBe(100);
      expect(travel.isOverrun).toBe(true);

      expect(travel.convertedCurrent).toBe(500);
      expect(travel.convertedLimit).toBeCloseTo(444.44, 1);
    });

    it("aggregates Smart Groups in reporting currency and exposes children in native currencies", () => {
      const statData: StatPingData = {
        selection: {
          params: { currency: "PLN" },
          points: [
            {
              id: "2026-10-01",
              date: "10-2026",
              categories: [
                {
                  id: "cat-sport-pln",
                  title: "Sport PLN",
                  limitAmount: 300,
                  value: 200, // 200 PLN
                },
                {
                  id: "cat-sport-uah",
                  title: "Sport UAH",
                  limitAmount: 5000,
                  value: 450, // 450 PLN (= 4500 UAH)
                },
              ],
            },
          ],
        },
      };

      const categoryNameMap = new Map([
        ["cat-sport-pln", "Sport PLN"],
        ["cat-sport-uah", "Sport UAH"],
      ]);
      const categoryCurrencyMap = new Map([
        ["cat-sport-pln", "PLN"],
        ["cat-sport-uah", "UAH"],
      ]);

      const items = computeBudgetSummaryItems(statData, "2026-10-01", categoryNameMap, {
        defaultCurrency: "PLN",
        categoryCurrencyMap,
        currencies: mockCurrencies,
        enableSmartGroups: true,
      });

      expect(items).toHaveLength(1);
      const group = items[0];

      expect(group.isSmartGroup).toBe(true);
      expect(group.name).toBe("Sport");
      expect(group.nativeCurrency).toBe("PLN");

      // Combined spend: 200 PLN + 450 PLN = 650 PLN
      expect(group.current).toBe(650);
      // Combined limit: 300 PLN + 500 PLN = 800 PLN
      expect(group.limit).toBe(800);
      // Combined percent: 650 / 800 * 100 = 81%
      expect(group.rawPercent).toBe(81);
      expect(group.isOverrun).toBe(false);

      // Children
      expect(group.children).toHaveLength(2);
      const childPln = group.children?.find((c) => c.id === "cat-sport-pln");
      const childUah = group.children?.find((c) => c.id === "cat-sport-uah");

      expect(childPln?.current).toBe(200);
      expect(childPln?.limit).toBe(300);
      expect(childPln?.nativeCurrency).toBe("PLN");

      expect(childUah?.current).toBe(4500);
      expect(childUah?.limit).toBe(5000);
      expect(childUah?.nativeCurrency).toBe("UAH");
      expect(childUah?.convertedCurrent).toBe(450);
      expect(childUah?.convertedLimit).toBe(500);
    });
  });

  describe("Category Organization Dialog & Persistence", () => {
    const originalCategories: ExternalProviderCategory[] = [
      { id: "c1", name: "Groceries", categoryType: CategoryType.Expense, order: 0 },
      { id: "c2", name: "Travel EUR", categoryType: CategoryType.Expense, order: 1 },
      { id: "c3", name: "_Old Bills", categoryType: CategoryType.Expense, order: 2 },
      { id: "c4", name: "Coffee", categoryType: CategoryType.Expense, order: 3 }, // active below archived!
    ];

    it("generates Tier Cleanup diff highlighting moved categories and rank shifts", () => {
      const result = organizeExpenseCategoriesByCurrencyTier(originalCategories, "PLN");
      expect(result.modifiedCategories).toHaveLength(3);

      const diff = buildCategoryOrderDiffItems(originalCategories, result.updatedCategories, {
        defaultCurrency: "PLN",
        strategy: "tier-cleanup",
      });

      expect(diff).toHaveLength(4);

      // Expected tier cleanup order:
      // Primary: Groceries (order 0), Coffee (order 1, moved up from 3 -> delta +2)
      // Foreign: Travel EUR (order 2, moved down from 1 -> delta -1)
      // Archived: _Old Bills (order 3, moved down from 2 -> delta -1)
      const coffee = diff.find((d) => d.category.id === "c4");
      expect(coffee?.hasMoved).toBe(true);
      expect(coffee?.previousOrder).toBe(3);
      expect(coffee?.newOrder).toBe(1);
      expect(coffee?.rankDelta).toBe(2);

      const travel = diff.find((d) => d.category.id === "c2");
      expect(travel?.hasMoved).toBe(true);
      expect(travel?.previousOrder).toBe(1);
      expect(travel?.newOrder).toBe(2);
      expect(travel?.rankDelta).toBe(-1);
    });

    it("generates correct /Exchange/Ping persistence payload structure", () => {
      const result = organizeExpenseCategoriesByCurrencyTier(originalCategories, "PLN");
      const persistencePayload = {
        items: [
          {
            key: ExchangeKey.Category,
            entityJson: JSON.stringify(result.modifiedCategories),
          },
        ],
      };

      expect(persistencePayload.items).toHaveLength(1);
      expect(persistencePayload.items[0].key).toBe(ExchangeKey.Category);

      const parsed = JSON.parse(persistencePayload.items[0].entityJson);
      expect(parsed).toHaveLength(result.modifiedCategories.length);
      expect(parsed[0].id).toBeDefined();
      expect(parsed[0].order).toBeDefined();
    });
  });

  describe("evaluateMonthCompleteness & normalizeMonthDate", () => {
    it("normalizes mid-month, month-year, and month-start date strings consistently", () => {
      expect(normalizeMonthDate("2026-10-24")).toBe("2026-10-01");
      expect(normalizeMonthDate("2026-10-01")).toBe("2026-10-01");
      expect(normalizeMonthDate("10-2026")).toBe("2026-10-01");
      expect(normalizeMonthDate("9-2026")).toBe("2026-09-01");
      expect(normalizeMonthDate("")).toBe("");
    });

    it("evaluates current calendar month in progress as incomplete", () => {
      const refDate = new Date(2026, 10, 7); // Nov 7, 2026
      const res = evaluateMonthCompleteness({
        activeMonthDateStr: "2026-11-01",
        transactions: [
          {
            id: "tx-1",
            dateTimestampISO: "2026-11-03T10:00:00Z",
          },
        ],
        referenceDate: refDate,
      });

      expect(res.isIncomplete).toBe(true);
      expect(res.reason).toBe("current_month");
      expect(getMonthIncompleteDescription(res.reason)).toContain("currently in progress");
    });

    it("evaluates historical cutoff month with no subsequent transactions as incomplete", () => {
      const refDate = new Date(2026, 10, 7); // Nov 7, 2026
      // Active month is October 2026, transactions cease on Oct 24, 2026, no Nov transactions exist
      const res = evaluateMonthCompleteness({
        activeMonthDateStr: "2026-10-01",
        transactions: [
          {
            id: "tx-1",
            dateTimestampISO: "2026-10-24T12:00:00Z",
          },
          {
            id: "tx-deleted-future",
            dateTimestampISO: "2026-11-02T12:00:00Z",
            deleted: true, // Deleted transactions must be ignored
          },
        ],
        referenceDate: refDate,
      });

      expect(res.isIncomplete).toBe(true);
      expect(res.reason).toBe("no_subsequent_transactions");
      expect(getMonthIncompleteDescription(res.reason)).toContain(
        "Transactions ceased before the following calendar month",
      );
    });

    it("evaluates complete historical month followed by subsequent transactions as complete", () => {
      const refDate = new Date(2026, 10, 7); // Nov 7, 2026
      // Active month is September 2026, and transactions exist in October 2026
      const res = evaluateMonthCompleteness({
        activeMonthDateStr: "2026-09-01",
        transactions: [
          {
            id: "tx-sep",
            dateTimestampISO: "2026-09-15T12:00:00Z",
          },
          {
            id: "tx-oct",
            dateTimestampISO: "2026-10-05T12:00:00Z",
          },
        ],
        referenceDate: refDate,
      });

      expect(res.isIncomplete).toBe(false);
      expect(res.reason).toBeNull();
    });

    it("returns incomplete false when hasActivity is false (zero-data month)", () => {
      const refDate = new Date(2026, 10, 7);
      const res = evaluateMonthCompleteness({
        activeMonthDateStr: "2026-11-01",
        transactions: [],
        hasActivity: false,
        referenceDate: refDate,
      });

      expect(res.isIncomplete).toBe(false);
      expect(res.reason).toBeNull();
    });
  });
});
