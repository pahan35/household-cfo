import { CategoryType, type ExternalProviderCategory, type StatCategoryPoint } from "./external-provider-data";

export interface ExclusionPreset {
  id: string;
  name: string;
  incomeDeductions: string[]; // Category IDs deducted from Gross Income (e.g. Tax)
  expenseExclusions: string[]; // Category IDs omitted from Expense Pie/Totals (e.g. Rent)
  isBuiltIn?: boolean;
}

export interface ExpenseSlice {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  limitAmount?: number;
  isOverrun?: boolean;
  isGrouped?: boolean;
}

export interface TransformExpensesInput {
  statCategories: StatCategoryPoint[];
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  activePreset: ExclusionPreset;
  rawGrossIncome?: number;
}

export interface TransformedExpenseData {
  controllableCategories: ExpenseSlice[];
  excludedCategories: ExpenseSlice[];
  taxDeductionCategories: ExpenseSlice[];
  totalGrossExpense: number;
  totalControllableExpense: number;
  totalTaxDeductions: number;
  excludedExpenseSum: number;
  grossIncome: number;
  netDisposableIncome: number;
  netCashFlowMargin: number;
}

/**
 * Transforms raw category spending points according to an active exclusion preset.
 * Computes net disposable income, controllable expenses, and category slices.
 */
export function transformExpenses(input: TransformExpensesInput): TransformedExpenseData {
  const { statCategories = [], categories, activePreset, rawGrossIncome = 0 } = input;

  const categoryMap =
    categories instanceof Map
      ? categories
      : new Map<string, ExternalProviderCategory>((categories ?? []).map((c) => [c.id, c]));

  const incomeDeductionSet = new Set(activePreset.incomeDeductions);
  const expenseExclusionSet = new Set(activePreset.expenseExclusions);

  let computedIncome = 0;
  let totalGrossExpense = 0;
  let totalTaxDeductions = 0;
  let excludedExpenseSum = 0;

  const controllableItems: ExpenseSlice[] = [];
  const excludedItems: ExpenseSlice[] = [];
  const taxItems: ExpenseSlice[] = [];

  for (const statCat of statCategories) {
    const catId = statCat.id;
    const catMeta = categoryMap.get(catId);
    const rawSpend = statCat.amount ?? statCat.currentAmount ?? statCat.value;
    const amount = Math.max(0, Number(rawSpend) || 0);
    const limitAmount = Number(statCat.limitAmount) || 0;
    const rawTitle = typeof statCat.title === "string" ? statCat.title.trim() : "";
    const rawName = typeof statCat.name === "string" ? statCat.name.trim() : "";
    const name = rawTitle || rawName || catMeta?.name || "Category";
    const isOverrun = limitAmount > 0 && amount > limitAmount;

    // Check if category is classified as Income in ExternalProvider metadata
    if (catMeta?.categoryType === CategoryType.Income) {
      computedIncome += amount;
      continue;
    }

    // Expense processing
    if (amount <= 0 && limitAmount <= 0) {
      continue;
    }

    totalGrossExpense += amount;

    if (incomeDeductionSet.has(catId)) {
      totalTaxDeductions += amount;
      taxItems.push({
        id: catId,
        name,
        amount,
        percentage: 0,
        limitAmount,
        isOverrun,
      });
    } else if (expenseExclusionSet.has(catId)) {
      excludedExpenseSum += amount;
      excludedItems.push({
        id: catId,
        name,
        amount,
        percentage: 0,
        limitAmount,
        isOverrun,
      });
    } else if (amount > 0) {
      controllableItems.push({
        id: catId,
        name,
        amount,
        percentage: 0,
        limitAmount,
        isOverrun,
      });
    }
  }

  // Sort controllable items descending by spent amount
  controllableItems.sort((a, b) => b.amount - a.amount);
  excludedItems.sort((a, b) => b.amount - a.amount);
  taxItems.sort((a, b) => b.amount - a.amount);

  const totalControllableExpense = controllableItems.reduce((acc, item) => acc + item.amount, 0);

  // Compute percentage share of controllable expenses
  for (const item of controllableItems) {
    item.percentage = totalControllableExpense > 0 ? (item.amount / totalControllableExpense) * 100 : 0;
  }

  const grossIncome = rawGrossIncome > 0 ? rawGrossIncome : computedIncome;
  const netDisposableIncome = grossIncome - totalTaxDeductions;
  const netCashFlowMargin = netDisposableIncome - totalControllableExpense;

  return {
    controllableCategories: controllableItems,
    excludedCategories: excludedItems,
    taxDeductionCategories: taxItems,
    totalGrossExpense,
    totalControllableExpense,
    totalTaxDeductions,
    excludedExpenseSum,
    grossIncome,
    netDisposableIncome,
    netCashFlowMargin,
  };
}

/**
 * Optionally aggregates small slices (< thresholdPercent) into an "Other" slice
 * to avoid visual clutter in pie/donut charts while preserving exact data.
 */
export function groupSmallSlices(slices: ExpenseSlice[], thresholdPercent = 3): ExpenseSlice[] {
  if (slices.length <= 4) {
    return slices;
  }

  const primary: ExpenseSlice[] = [];
  let otherAmount = 0;
  let otherLimit = 0;
  let smallSliceCount = 0;

  for (const slice of slices) {
    if (slice.percentage < thresholdPercent) {
      otherAmount += slice.amount;
      otherLimit += slice.limitAmount ?? 0;
      smallSliceCount += 1;
    } else {
      primary.push(slice);
    }
  }

  // Only collapse if there are multiple small slices to combine
  if (smallSliceCount > 1 && otherAmount > 0) {
    const totalAmount = slices.reduce((acc, s) => acc + s.amount, 0);
    const otherPercentage = totalAmount > 0 ? (otherAmount / totalAmount) * 100 : 0;
    primary.push({
      id: "other-grouped",
      name: "Other Categories",
      amount: otherAmount,
      percentage: otherPercentage,
      limitAmount: otherLimit > 0 ? otherLimit : undefined,
      isGrouped: true,
    });
  } else {
    return slices;
  }

  return primary;
}

/**
 * Assigns cycling semantic chart colors (--chart-1 through --chart-5)
 * to category slices for theme-compliant rendering.
 */
export function assignChartColors<T extends { id: string }>(items: T[]): (T & { fill: string; colorKey: string })[] {
  const chartVarCount = 5;
  return items.map((item, index) => {
    const colorIndex = (index % chartVarCount) + 1;
    return {
      ...item,
      fill: `var(--chart-${colorIndex})`,
      colorKey: `chart-${colorIndex}`,
    };
  });
}
