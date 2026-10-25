import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  convertCurrencyAmount,
  extractCanonicalBaseName,
  isCyrillic,
  KNOWN_FOREIGN_CURRENCY_CODES,
  type StatCategoryPoint,
} from "./external-provider-data";

export interface ExclusionPreset {
  id: string;
  name: string;
  incomeDeductions: string[]; // Category IDs deducted from Gross Income (e.g. Tax)
  expenseExclusions: string[]; // Category IDs omitted from Expense Pie/Totals (e.g. Rent)
  isBuiltIn?: boolean;
}

export type CompareMode = "none" | "prev_month" | "prev_year" | "custom";

export interface MetricDelta {
  current: number;
  baseline: number;
  deltaAbs: number;
  deltaPercent: number | null;
}

export interface CategoryComparisonDelta {
  categoryId: string;
  name: string;
  currentAmount: number;
  baselineAmount: number;
  deltaAbs: number;
  deltaPercent: number | null;
  isNew: boolean;
}

export interface PeriodComparisonResult {
  grossIncome: MetricDelta;
  netDisposableIncome: MetricDelta;
  totalControllableExpense: MetricDelta;
  netCashFlowMargin: MetricDelta;
  categoryDeltas: CategoryComparisonDelta[];
  categoryDeltaMap: Map<string, CategoryComparisonDelta>;
}

export interface ExpenseSlice {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  limitAmount?: number;
  isOverrun?: boolean;
  isGrouped?: boolean;
  isSmartGroup?: boolean;
  hasForeignCurrency?: boolean;
  foreignCurrencies?: string[];
  children?: ExpenseSlice[];
  fill?: string;
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
  availableControllablePool: number;
  controllableCashLeft: number;
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
    const rawSpend = statCat.value ?? statCat.amount ?? statCat.currentAmount;
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

  const grossIncome = computedIncome > 0 ? computedIncome : Math.max(0, rawGrossIncome);
  const netDisposableIncome = grossIncome - totalTaxDeductions;
  const totalLivingExpenses = totalControllableExpense + excludedExpenseSum;
  const netCashFlowMargin = netDisposableIncome - totalLivingExpenses;
  const availableControllablePool = netDisposableIncome - excludedExpenseSum;
  const controllableCashLeft = availableControllablePool - totalControllableExpense;

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
    availableControllablePool,
    controllableCashLeft,
  };
}

export const TRANSPORT_CATEGORY_REGEX = /(transport|taxi|uber|bolt)/i;
export const TAXI_CATEGORY_REGEX = /(taxi|uber|bolt)/i;

/**
 * Checks if a category name relates to transport or ride-hailing.
 */
export function isTransportOrTaxi(name: string): boolean {
  return TRANSPORT_CATEGORY_REGEX.test(name);
}

/**
 * Checks if a category name specifically represents ride-hailing / taxi (e.g. Taxi, Uber, Bolt).
 */
export function isTaxiCategory(name: string): boolean {
  return TAXI_CATEGORY_REGEX.test(name);
}

/**
 * Detects whether a slice represents spending in a foreign (non-default) currency
 * based on trailing currency code or Ukrainian Cyrillic name.
 */
export function detectSliceCurrency(name: string, defaultCurrency = "PLN"): { currency: string; isForeign: boolean } {
  const trimmed = name.trim();
  const defaultUpper = defaultCurrency.toUpperCase();
  const foreignSuffixRegex = new RegExp(`(?:\\s+|\\s*\\()(${KNOWN_FOREIGN_CURRENCY_CODES.join("|")})\\)?$`, "i");
  const match = trimmed.match(foreignSuffixRegex);
  if (match) {
    const curr = match[1].toUpperCase();
    return { currency: curr, isForeign: curr !== defaultUpper };
  }
  if (isCyrillic(trimmed)) {
    return { currency: "UAH", isForeign: defaultUpper !== "UAH" };
  }
  return { currency: defaultUpper, isForeign: false };
}

/**
 * Links Transport and Taxi categories into a smart group slice on the donut chart,
 * and automatically rolls up multi-currency categories sharing a canonical base name
 * (e.g. "Medicine" and "Medicine UAH") into a unified smart group slice.
 * Protects smart group slices from being swallowed into "Other Categories".
 */
export function groupSmartSlices(
  slices: ExpenseSlice[],
  thresholdPercent = 3,
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
): ExpenseSlice[] {
  const totalAmount = slices.reduce((acc, s) => acc + s.amount, 0);

  // ---------------------------------------------------------------------------
  // Tier 1: Multi-Currency Rollup by Canonical Base Name
  // Categories sharing the exact same canonical base name (e.g. Medicine and Medicine UAH)
  // are aggregated into a single smart group.
  // ---------------------------------------------------------------------------
  const canonicalGroups = new Map<string, ExpenseSlice[]>();
  for (const slice of slices) {
    const base = slice.isSmartGroup ? slice.name : extractCanonicalBaseName(slice.name, defaultCurrency);
    const existing = canonicalGroups.get(base) ?? [];
    existing.push(slice);
    canonicalGroups.set(base, existing);
  }

  const tier1Slices: ExpenseSlice[] = [];

  for (const [canonicalBase, groupSlices] of canonicalGroups.entries()) {
    if (groupSlices.length >= 2) {
      const combinedAmount = groupSlices.reduce((acc, s) => {
        const det = detectSliceCurrency(s.name, defaultCurrency);
        if (det.isForeign) {
          const converted = convertCurrencyAmount(s.amount, det.currency, defaultCurrency, currencies);
          return acc + (converted ?? s.amount);
        }
        return acc + s.amount;
      }, 0);
      const combinedLimit = groupSlices.reduce((acc, s) => {
        if (!s.limitAmount) return acc;
        const det = detectSliceCurrency(s.name, defaultCurrency);
        if (det.isForeign) {
          const converted = convertCurrencyAmount(s.limitAmount, det.currency, defaultCurrency, currencies);
          return acc + (converted ?? s.limitAmount);
        }
        return acc + s.limitAmount;
      }, 0);
      const combinedPercentage = totalAmount > 0 ? (combinedAmount / totalAmount) * 100 : 0;
      const hasOverrun = groupSlices.some((s) => s.isOverrun) || (combinedLimit > 0 && combinedAmount > combinedLimit);

      const foreignCurrencies = Array.from(
        new Set(
          groupSlices.flatMap((s) => {
            if (s.foreignCurrencies?.length) return s.foreignCurrencies;
            const det = detectSliceCurrency(s.name, defaultCurrency);
            return det.isForeign ? [det.currency] : [];
          }),
        ),
      );

      tier1Slices.push({
        id: `group-${canonicalBase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: canonicalBase,
        amount: combinedAmount,
        percentage: combinedPercentage,
        limitAmount: combinedLimit > 0 ? combinedLimit : undefined,
        isOverrun: hasOverrun,
        isSmartGroup: true,
        hasForeignCurrency: foreignCurrencies.length > 0,
        foreignCurrencies: foreignCurrencies.length > 0 ? foreignCurrencies : undefined,
        children: groupSlices.flatMap((s) => (s.children?.length ? s.children : [s])),
      });
    } else {
      const single = groupSlices[0];
      const det = detectSliceCurrency(single.name, defaultCurrency);
      tier1Slices.push({
        ...single,
        hasForeignCurrency: det.isForeign || single.hasForeignCurrency,
        foreignCurrencies: single.foreignCurrencies ?? (det.isForeign ? [det.currency] : undefined),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Tier 2: Transport & Taxi smart grouping
  // ---------------------------------------------------------------------------
  const transportSlices = tier1Slices.filter((s) => isTransportOrTaxi(s.name));
  const otherSlices = tier1Slices.filter((s) => !isTransportOrTaxi(s.name));

  const shouldSmartGroupTransport =
    transportSlices.length >= 2 && transportSlices.some((s) => s.percentage < thresholdPercent);

  let candidateSlices: ExpenseSlice[];

  if (shouldSmartGroupTransport) {
    const combinedAmount = transportSlices.reduce((acc, s) => {
      const det = detectSliceCurrency(s.name, defaultCurrency);
      if (det.isForeign) {
        const converted = convertCurrencyAmount(s.amount, det.currency, defaultCurrency, currencies);
        return acc + (converted ?? s.amount);
      }
      return acc + s.amount;
    }, 0);
    const combinedLimit = transportSlices.reduce((acc, s) => {
      if (!s.limitAmount) return acc;
      const det = detectSliceCurrency(s.name, defaultCurrency);
      if (det.isForeign) {
        const converted = convertCurrencyAmount(s.limitAmount, det.currency, defaultCurrency, currencies);
        return acc + (converted ?? s.limitAmount);
      }
      return acc + s.limitAmount;
    }, 0);
    const combinedPercentage = totalAmount > 0 ? (combinedAmount / totalAmount) * 100 : 0;
    const hasOverrun =
      transportSlices.some((s) => s.isOverrun) || (combinedLimit > 0 && combinedAmount > combinedLimit);

    const foreignCurrencies = Array.from(
      new Set(
        transportSlices.flatMap((s) => {
          if (s.foreignCurrencies?.length) return s.foreignCurrencies;
          const det = detectSliceCurrency(s.name, defaultCurrency);
          return det.isForeign ? [det.currency] : [];
        }),
      ),
    );

    const transportGroup: ExpenseSlice = {
      id: "group-transport",
      name: "Transport (incl. Taxi)",
      amount: combinedAmount,
      percentage: combinedPercentage,
      limitAmount: combinedLimit > 0 ? combinedLimit : undefined,
      isOverrun: hasOverrun,
      isSmartGroup: true,
      hasForeignCurrency: foreignCurrencies.length > 0,
      foreignCurrencies: foreignCurrencies.length > 0 ? foreignCurrencies : undefined,
      children: transportSlices.flatMap((s) => (s.children?.length ? s.children : [s])),
    };

    candidateSlices = [...otherSlices, transportGroup];
  } else {
    candidateSlices = [...tier1Slices];
  }

  // If few slices, return as is (sorted by amount)
  if (candidateSlices.length <= 4) {
    return candidateSlices.sort((a, b) => b.amount - a.amount);
  }

  // ---------------------------------------------------------------------------
  // Tier 3: Minor slices rollup into "Other Categories"
  // Smart group slices are protected from generic "Other Categories" collapsing
  // ---------------------------------------------------------------------------
  const primary: ExpenseSlice[] = [];
  let otherAmount = 0;
  let otherLimit = 0;
  let smallSliceCount = 0;

  for (const slice of candidateSlices) {
    if (slice.isSmartGroup) {
      primary.push(slice);
    } else if (slice.percentage < thresholdPercent) {
      otherAmount += slice.amount;
      otherLimit += slice.limitAmount ?? 0;
      smallSliceCount += 1;
    } else {
      primary.push(slice);
    }
  }

  if (smallSliceCount > 1 && otherAmount > 0) {
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
    return candidateSlices.sort((a, b) => b.amount - a.amount);
  }

  return primary.sort((a, b) => b.amount - a.amount);
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

function computeMetricDelta(current: number, baseline: number): MetricDelta {
  const deltaAbs = current - baseline;
  let deltaPercent: number | null = null;
  if (baseline !== 0) {
    deltaPercent = ((current - baseline) / Math.abs(baseline)) * 100;
  } else if (current === 0) {
    deltaPercent = 0;
  }
  return {
    current,
    baseline,
    deltaAbs,
    deltaPercent,
  };
}

/**
 * Computes delta metrics between an active period and a comparison baseline period.
 * Calculates KPI variances and per-category delta map.
 */
export function computePeriodComparison(
  current: TransformedExpenseData,
  baseline: TransformedExpenseData | null | undefined,
): PeriodComparisonResult | null {
  if (!baseline) {
    return null;
  }

  const grossIncome = computeMetricDelta(current.grossIncome, baseline.grossIncome);
  const netDisposableIncome = computeMetricDelta(current.netDisposableIncome, baseline.netDisposableIncome);
  const totalControllableExpense = computeMetricDelta(
    current.totalControllableExpense,
    baseline.totalControllableExpense,
  );
  const netCashFlowMargin = computeMetricDelta(current.netCashFlowMargin, baseline.netCashFlowMargin);

  const categoryDeltaMap = new Map<string, CategoryComparisonDelta>();

  // Collect all category slices across controllable, excluded, and tax deductions
  const allCurrentSlices = [
    ...current.controllableCategories,
    ...current.excludedCategories,
    ...current.taxDeductionCategories,
  ];
  const allBaselineSlices = [
    ...baseline.controllableCategories,
    ...baseline.excludedCategories,
    ...baseline.taxDeductionCategories,
  ];

  const currentMap = new Map(allCurrentSlices.map((s) => [s.id, s]));
  const baselineMap = new Map(allBaselineSlices.map((s) => [s.id, s]));

  const allCategoryIds = new Set([...currentMap.keys(), ...baselineMap.keys()]);

  for (const catId of allCategoryIds) {
    const curSlice = currentMap.get(catId);
    const baseSlice = baselineMap.get(catId);
    const name = curSlice?.name ?? baseSlice?.name ?? "Category";
    const currentAmount = curSlice?.amount ?? 0;
    const baselineAmount = baseSlice?.amount ?? 0;
    const deltaAbs = currentAmount - baselineAmount;
    const isNew = baselineAmount === 0 && currentAmount > 0;
    let deltaPercent: number | null = null;
    if (baselineAmount > 0) {
      deltaPercent = ((currentAmount - baselineAmount) / baselineAmount) * 100;
    } else if (baselineAmount === 0 && currentAmount === 0) {
      deltaPercent = 0;
    }

    categoryDeltaMap.set(catId, {
      categoryId: catId,
      name,
      currentAmount,
      baselineAmount,
      deltaAbs,
      deltaPercent,
      isNew,
    });
  }

  // Controllable category deltas (for controllable breakdown list)
  const controllableCurrentMap = new Map(current.controllableCategories.map((s) => [s.id, s]));
  const controllableBaselineMap = new Map(baseline.controllableCategories.map((s) => [s.id, s]));
  const controllableCategoryIds = new Set([...controllableCurrentMap.keys(), ...controllableBaselineMap.keys()]);

  const categoryDeltas: CategoryComparisonDelta[] = [];
  for (const catId of controllableCategoryIds) {
    const delta = categoryDeltaMap.get(catId);
    if (delta) {
      categoryDeltas.push(delta);
    }
  }

  return {
    grossIncome,
    netDisposableIncome,
    totalControllableExpense,
    netCashFlowMargin,
    categoryDeltas,
    categoryDeltaMap,
  };
}
