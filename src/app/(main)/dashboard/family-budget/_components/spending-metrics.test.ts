import { describe, expect, it } from "vitest";

import { computeBudgetSummaryItems } from "./budget-summary-card";
import {
  CategoryType,
  type ExternalProviderCategory,
  ExchangeKey,
  type ExchangePingItem,
  extractExchangeEntities,
  type StatCategoryPoint,
  type StatPingData,
  type StatPoint,
} from "./external-provider-data";
import {
  computePeriodComparison,
  type ExclusionPreset,
  groupSmallSlices,
  transformExpenses,
} from "./expense-transforms";
import {
  computeTotalNetWorth,
  extractAvailableMonths,
  filterChronologicalTrends,
  getNextMonth,
  getPrevMonth,
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
    const extracted = extractExchangeEntities<ExternalProviderCategory>(MOEXT_EXCHANGE_PING_ITEMS, ExchangeKey.Category);
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
    expect(result.netCashFlowMargin).toBe(17499);
    expect(result.controllableCategories).toHaveLength(3);
    expect(result.controllableCategories[0]?.name).toBe("Groceries");
    expect(result.controllableCategories[0]?.amount).toBe(2450.75);
    expect(result.controllableCategories[1]?.name).toBe("Dining Out");
    expect(result.controllableCategories[1]?.isOverrun).toBe(true);
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

  it("falls back to `points[0]` (most recent period) when exact `fromDate` match is absent", () => {
    const items = computeBudgetSummaryItems(MOEXT_STAT_PING_DATA, "2026-10-24", categoryNameMap);
    const groceries = items.find((item) => item.id === "cat-groceries");
    expect(groceries).toBeDefined();
    expect(groceries?.current).toBe(2450.75);
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
    expect(oct26.netIncome).toBe(21500);
    expect(oct26.controllableExpense).toBe(4001);
    expect(oct26.netCashFlowMargin).toBe(17499);
    expect(oct26.liquidBalance).toBe(50000);
    expect(oct26.netWorth).toBe(120000);

    const sep26 = result.points[1];
    expect(sep26.monthLabel).toBe("Sep'26");
    expect(sep26.controllableExpense).toBe(2100);
    expect(sep26.netCashFlowMargin).toBe(-2100);
    // Walking backward: sep26 balance = oct26 balance - oct26 margin
    expect(sep26.liquidBalance).toBe(50000 - 17499); // 32501
    expect(sep26.netWorth).toBe(120000 - 17499); // 102501

    const oct25 = result.points[0];
    expect(oct25.monthLabel).toBe("Oct'25");
    // oct25 balance = sep26 balance - sep26 margin
    expect(oct25.liquidBalance).toBe(32501 - -2100); // 34601
    expect(oct25.netWorth).toBe(102501 - -2100); // 104601
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
        netIncome: 10000,
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
