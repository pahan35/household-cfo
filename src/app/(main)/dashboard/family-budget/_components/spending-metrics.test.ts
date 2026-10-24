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
import { parsePointDate, transformYoYPoints } from "./yoy-transforms";

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
