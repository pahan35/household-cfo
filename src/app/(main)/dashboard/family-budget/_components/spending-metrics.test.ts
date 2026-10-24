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
import { type ExclusionPreset, groupSmallSlices, transformExpenses } from "./expense-transforms";
import {
  computeTotalNetWorth,
  filterChronologicalTrends,
  parsePointDate,
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
        amount: 2100,
        value: 2100,
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
        amount: 2000,
        value: 2000,
        currentAmount: 0.0,
        limitAmount: 2800,
      },
      {
        id: "cat-dining",
        title: "Dining Out",
        amount: 1000,
        value: 1000,
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
});

describe("transformChronologicalTrends & Timeline Zoom Helpers", () => {
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
