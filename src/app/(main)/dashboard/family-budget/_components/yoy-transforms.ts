import { format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  computeAccountLiquiditySummary,
  convertCurrencyAmount,
  isAccountType,
  type StatPoint,
} from "./external-provider-data";
import { type CompareMode, type ExclusionPreset, transformExpenses } from "./expense-transforms";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthLabel = (typeof MONTH_LABELS)[number];

export interface YoYYearMetric {
  year: number;
  monthIndex: number;
  pointId: string;
  controllableExpense: number;
  netIncome: number;
  netDisposableIncome: number;
  availableControllablePool: number;
  totalExpense: number;
  savingsRate: number;
  netCashFlowMargin: number;
  taxDeductions: number;
  excludedExpenseSum: number;
  grossIncome?: number;
}

export interface YoYDelta {
  fromYear: number;
  toYear: number;
  controllableDeltaAbs: number;
  controllableDeltaPercent: number | null;
  marginDeltaAbs: number;
  marginDeltaPercent: number | null;
  netIncomeDeltaAbs: number;
  netIncomeDeltaPercent: number | null;
}

export interface YoYMonthData {
  monthIndex: number;
  monthLabel: MonthLabel;
  years: Record<number, YoYYearMetric>;
  deltas: Record<number, YoYDelta>;
  [key: string]: unknown;
}

export interface TransformYoYInput {
  points?: StatPoint[];
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  activePreset: ExclusionPreset;
}

export interface TransformYoYResult {
  monthlyData: YoYMonthData[];
  availableYears: number[];
  latestYear: number;
  earliestYear: number;
  totalPointsParsed: number;
}

interface ParsedStatPoint {
  point: StatPoint;
  year: number;
  monthIndex: number;
  dateStr: string;
  timestamp: number;
}

function resolveDateCandidate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsedIso = parseISO(trimmed);
  if (isValid(parsedIso)) return parsedIso;

  // Handle ExternalProvider "M-yyyy" or "MM-yyyy" format (e.g. "9-2026", "10-2026")
  const monthYearMatch = /^(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (monthYearMatch) {
    const month = Number.parseInt(monthYearMatch[1], 10) - 1;
    const year = Number.parseInt(monthYearMatch[2], 10);
    if (month >= 0 && month <= 11) {
      const d = new Date(year, month, 1);
      if (isValid(d)) return d;
    }
  }

  const fallbackDate = new Date(trimmed);
  if (isValid(fallbackDate)) return fallbackDate;

  const num = Number(trimmed);
  if (!Number.isNaN(num) && num > 0) {
    const numDate = new Date(num);
    if (isValid(numDate)) return numDate;
  }

  return null;
}

/**
 * Parses and validates date information from a StatPoint.
 */
export function parsePointDate(
  point: Pick<StatPoint, "id" | "date">,
): { year: number; monthIndex: number; dateStr: string; timestamp: number } | null {
  const d = resolveDateCandidate(point.id) ?? resolveDateCandidate(point.date);
  if (!d) return null;

  const monthStart = startOfMonth(d);
  return {
    year: monthStart.getFullYear(),
    monthIndex: monthStart.getMonth(),
    dateStr: format(monthStart, "yyyy-MM-dd"),
    timestamp: monthStart.getTime(),
  };
}

export interface AvailableMonth {
  year: number;
  monthIndex: number;
  dateStr: string;
  label: string;
}

export interface BaselineResolutionResult {
  dateStr: string;
  label: string;
  hasData: boolean;
}

/**
 * Extracts a deduplicated list of available months from /stat/ping points,
 * always including at least the current month and previous calendar month,
 * sorted descending by date (most recent first).
 */
export function extractAvailableMonths(points?: Array<Pick<StatPoint, "id" | "date">>): AvailableMonth[] {
  const monthMap = new Map<string, AvailableMonth>();

  // Ensure current and previous months are always available even while loading
  const now = new Date();
  const currentStart = startOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));

  const defaultMonths = [currentStart, prevStart];
  for (const d of defaultMonths) {
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const dateStr = format(d, "yyyy-MM-dd");
    const label = `${MONTH_LABELS[monthIndex]} ${year}`;
    monthMap.set(dateStr, { year, monthIndex, dateStr, label });
  }

  for (const point of points ?? []) {
    const parsed = parsePointDate(point);
    if (parsed) {
      const { year, monthIndex, dateStr } = parsed;
      const label = `${MONTH_LABELS[monthIndex]} ${year}`;
      monthMap.set(dateStr, { year, monthIndex, dateStr, label });
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
}

/**
 * Gets the chronological previous month (older in time) from available months.
 */
export function getPrevMonth(currentDateStr: string, availableMonths: AvailableMonth[]): AvailableMonth | null {
  const asc = [...availableMonths].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const idx = asc.findIndex((m) => m.dateStr === currentDateStr);
  if (idx <= 0) return null;
  return asc[idx - 1];
}

/**
 * Gets the chronological next month (newer in time) from available months.
 */
export function getNextMonth(currentDateStr: string, availableMonths: AvailableMonth[]): AvailableMonth | null {
  const asc = [...availableMonths].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const idx = asc.findIndex((m) => m.dateStr === currentDateStr);
  if (idx === -1 || idx >= asc.length - 1) return null;
  return asc[idx + 1];
}

/**
 * Resolves the baseline comparison month based on comparison mode and active month.
 */
export function resolveBaselineMonth(
  activeDateStr: string,
  mode: CompareMode,
  availableMonths: AvailableMonth[],
  customDateStr?: string | null,
): BaselineResolutionResult | null {
  if (mode === "none") {
    return null;
  }

  const parsedActive = parseISO(activeDateStr);
  const activeDate = isValid(parsedActive) ? parsedActive : new Date(activeDateStr);
  const normalizedActive = isValid(activeDate) ? startOfMonth(activeDate) : startOfMonth(new Date());

  let targetDate: Date;
  if (mode === "prev_month") {
    targetDate = subMonths(normalizedActive, 1);
  } else if (mode === "prev_year") {
    targetDate = subMonths(normalizedActive, 12);
  } else if (mode === "custom") {
    if (!customDateStr) return null;
    const parsedCustom = parseISO(customDateStr);
    const d = isValid(parsedCustom) ? parsedCustom : new Date(customDateStr);
    targetDate = isValid(d) ? startOfMonth(d) : normalizedActive;
  } else {
    return null;
  }

  const targetDateStr = format(targetDate, "yyyy-MM-dd");
  const monthIndex = targetDate.getMonth();
  const year = targetDate.getFullYear();
  const label = `${MONTH_LABELS[monthIndex]} ${year}`;
  const hasData = availableMonths.some((m) => m.dateStr === targetDateStr);

  return {
    dateStr: targetDateStr,
    label,
    hasData,
  };
}

/**
 * Computes YoY delta between two metrics for the same calendar month.
 */
export function computeYoYDelta(current: YoYYearMetric, prior: YoYYearMetric): YoYDelta {
  const controllableDeltaAbs = current.controllableExpense - prior.controllableExpense;
  const controllableDeltaPercent =
    prior.controllableExpense > 0
      ? ((current.controllableExpense - prior.controllableExpense) / prior.controllableExpense) * 100
      : null;

  const marginDeltaAbs = current.netCashFlowMargin - prior.netCashFlowMargin;
  const marginDeltaPercent =
    prior.netCashFlowMargin !== 0
      ? ((current.netCashFlowMargin - prior.netCashFlowMargin) / Math.abs(prior.netCashFlowMargin)) * 100
      : null;

  const netIncomeDeltaAbs = current.netIncome - prior.netIncome;
  const netIncomeDeltaPercent =
    prior.netIncome > 0 ? ((current.netIncome - prior.netIncome) / prior.netIncome) * 100 : null;

  return {
    fromYear: prior.year,
    toYear: current.year,
    controllableDeltaAbs,
    controllableDeltaPercent,
    marginDeltaAbs,
    marginDeltaPercent,
    netIncomeDeltaAbs,
    netIncomeDeltaPercent,
  };
}

/**
 * Transforms historical StatPoints into a calendar-aligned multi-year comparison series
 * reflecting the active exclusion preset.
 */
export function transformYoYPoints(input: TransformYoYInput): TransformYoYResult {
  const { points = [], categories, activePreset } = input;

  // 1. Parse, validate, and chronologically sort all available points
  const parsedPoints: ParsedStatPoint[] = [];

  for (const point of points) {
    const parsed = parsePointDate(point);
    if (parsed) {
      parsedPoints.push({
        point,
        ...parsed,
      });
    }
  }

  // Sort ascending by timestamp
  parsedPoints.sort((a, b) => a.timestamp - b.timestamp);

  // 2. Group by year and monthIndex (latest point wins for duplicates)
  // year -> monthIndex -> ParsedStatPoint
  const pointsByYearMonth = new Map<number, Map<number, ParsedStatPoint>>();
  const yearSet = new Set<number>();

  for (const item of parsedPoints) {
    yearSet.add(item.year);
    let monthMap = pointsByYearMonth.get(item.year);
    if (!monthMap) {
      monthMap = new Map<number, ParsedStatPoint>();
      pointsByYearMonth.set(item.year, monthMap);
    }
    monthMap.set(item.monthIndex, item);
  }

  const availableYears = Array.from(yearSet).sort((a, b) => a - b);
  const currentYear = new Date().getFullYear();
  const latestYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : currentYear;
  const earliestYear = availableYears.length > 0 ? availableYears[0] : currentYear;

  // 3. For each month 0..11, build YoYMonthData
  const monthlyData: YoYMonthData[] = [];

  for (let m = 0; m < 12; m++) {
    const monthLabel = MONTH_LABELS[m];
    const monthRecord: YoYMonthData = {
      monthIndex: m,
      monthLabel,
      years: {},
      deltas: {},
    };

    // Calculate metrics for each available year
    for (const year of availableYears) {
      const pointItem = pointsByYearMonth.get(year)?.get(m);
      if (pointItem) {
        const transformed = transformExpenses({
          statCategories: pointItem.point.categories,
          categories,
          activePreset,
        });

        const controllable = transformed.totalControllableExpense;
        const netDisposableIncome = transformed.netDisposableIncome;
        const availableControllablePool = transformed.availableControllablePool;
        const netIncome = availableControllablePool;
        const margin = transformed.netCashFlowMargin;
        const totalExp = transformed.totalGrossExpense;
        const savingsRate = netDisposableIncome > 0 ? Math.round((margin / netDisposableIncome) * 100) : 0;

        const metric: YoYYearMetric = {
          year,
          monthIndex: m,
          pointId: pointItem.dateStr,
          controllableExpense: controllable,
          netIncome,
          netDisposableIncome,
          availableControllablePool,
          totalExpense: totalExp,
          savingsRate,
          netCashFlowMargin: margin,
          taxDeductions: transformed.totalTaxDeductions,
          excludedExpenseSum: transformed.excludedExpenseSum,
          grossIncome: transformed.grossIncome,
        };

        monthRecord.years[year] = metric;

        // Flatten for Recharts series dataKey access
        monthRecord[`controllable_${year}`] = controllable;
        monthRecord[`margin_${year}`] = margin;
        monthRecord[`netIncome_${year}`] = netIncome;
        monthRecord[`totalExpense_${year}`] = totalExp;
        monthRecord[`savingsRate_${year}`] = savingsRate;
      } else {
        // Missing historical month: set null so Recharts does not misalign or render phantom points
        monthRecord[`controllable_${year}`] = null;
        monthRecord[`margin_${year}`] = null;
        monthRecord[`netIncome_${year}`] = null;
        monthRecord[`totalExpense_${year}`] = null;
        monthRecord[`savingsRate_${year}`] = null;
      }
    }

    // Compute YoY deltas for consecutive years or nearest prior year
    for (let i = 0; i < availableYears.length; i++) {
      const targetYear = availableYears[i];
      const targetMetric = monthRecord.years[targetYear];
      if (!targetMetric) continue;

      // Look for immediate prior year first, then nearest prior year
      let priorMetric = monthRecord.years[targetYear - 1];
      if (!priorMetric) {
        for (let j = i - 1; j >= 0; j--) {
          const checkYear = availableYears[j];
          if (monthRecord.years[checkYear]) {
            priorMetric = monthRecord.years[checkYear];
            break;
          }
        }
      }

      if (priorMetric) {
        monthRecord.deltas[targetYear] = computeYoYDelta(targetMetric, priorMetric);
      }
    }

    monthlyData.push(monthRecord);
  }

  return {
    monthlyData,
    availableYears,
    latestYear,
    earliestYear,
    totalPointsParsed: parsedPoints.length,
  };
}

/**
 * Computes total net worth across all non-deleted accounts, bank accounts, goal/savings accounts,
 * and debt accounts converted to default currency.
 */
export function computeTotalNetWorth(
  categories: ExternalProviderCategory[] = [],
  currencies: ExternalProviderCurrency[] = [],
  defaultCurrency = "PLN",
): number {
  let netWorth = 0;
  for (const cat of categories) {
    if (cat.deleted) continue;
    const type = Number(cat.categoryType);
    const isAccount = isAccountType(type);
    const isGoal = type === CategoryType.ClassicGoal || type === CategoryType.Goal;
    if (!isAccount && !isGoal) continue;

    const balance = Number(cat.amount) || 0;
    const currency = (cat.currencyId?.trim() || defaultCurrency).toUpperCase();
    const converted = convertCurrencyAmount(balance, currency, defaultCurrency, currencies);
    netWorth += converted ?? balance;
  }
  return netWorth;
}

export interface ChronologicalTrendPoint {
  dateStr: string;
  year: number;
  monthIndex: number;
  monthLabel: string;
  timestamp: number;
  netIncome: number;
  netDisposableIncome: number;
  availableControllablePool: number;
  controllableExpense: number;
  netCashFlowMargin: number;
  totalExpense: number;
  grossIncome: number;
  excludedExpenseSum: number;
  taxDeductions: number;
  savingsRate: number;
  liquidBalance: number;
  netWorth: number;
  rawPoint?: StatPoint;
  [key: string]: unknown;
}

export interface TransformChronologicalInput {
  points?: StatPoint[];
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies?: ExternalProviderCurrency[];
  defaultCurrency?: string;
  activePreset: ExclusionPreset;
  currentLiquidBalance?: number;
  currentNetWorth?: number;
}

export interface TransformChronologicalResult {
  points: ChronologicalTrendPoint[];
  totalPoints: number;
  earliestDate: string | null;
  latestDate: string | null;
  currentLiquidBalance: number;
  currentNetWorth: number;
}

/**
 * Transforms historical StatPoints into a continuous chronological timeline series (oldest to newest)
 * with monthly net income, controllable expenses, margin, and backward-reconstructed liquid balance & net worth.
 */
export function transformChronologicalTrends(input: TransformChronologicalInput): TransformChronologicalResult {
  const {
    points = [],
    categories,
    currencies = [],
    defaultCurrency = "PLN",
    activePreset,
    currentLiquidBalance,
    currentNetWorth,
  } = input;

  let categoriesArray: ExternalProviderCategory[] = [];
  if (Array.isArray(categories)) {
    categoriesArray = categories;
  } else if (categories instanceof Map) {
    categoriesArray = Array.from(categories.values());
  }

  // 1. Parse and validate candidate date points
  const parsedPoints: ParsedStatPoint[] = [];
  for (const point of points) {
    const parsed = parsePointDate(point);
    if (parsed) {
      parsedPoints.push({
        point,
        ...parsed,
      });
    }
  }

  // Sort ascending by timestamp
  parsedPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Group by year and monthIndex (latest point in list wins for duplicates)
  const byYearMonth = new Map<string, ParsedStatPoint>();
  for (const item of parsedPoints) {
    const key = `${item.year}-${item.monthIndex}`;
    byYearMonth.set(key, item);
  }

  const uniqueSorted = Array.from(byYearMonth.values()).sort((a, b) => a.timestamp - b.timestamp);

  // 2. Resolve anchor live balances
  const anchorLiquid =
    typeof currentLiquidBalance === "number"
      ? currentLiquidBalance
      : computeAccountLiquiditySummary(categoriesArray, currencies, defaultCurrency).totalNetLiquid;

  const anchorNetWorth =
    typeof currentNetWorth === "number"
      ? currentNetWorth
      : computeTotalNetWorth(categoriesArray, currencies, defaultCurrency);

  // 3. Transform monthly expense/income metrics
  const chronologicalPoints: ChronologicalTrendPoint[] = [];

  for (const item of uniqueSorted) {
    const transformed = transformExpenses({
      statCategories: item.point.categories,
      categories,
      activePreset,
    });

    const controllable = transformed.totalControllableExpense;
    const netDisposableIncome = transformed.netDisposableIncome;
    const availableControllablePool = transformed.availableControllablePool;
    const netIncome = availableControllablePool;
    const margin = transformed.netCashFlowMargin;
    const totalExp = transformed.totalGrossExpense;
    const savingsRate = netDisposableIncome > 0 ? Math.round((margin / netDisposableIncome) * 100) : 0;
    const monthLabel = `${MONTH_LABELS[item.monthIndex]}'${String(item.year).slice(-2)}`;

    chronologicalPoints.push({
      dateStr: item.dateStr,
      year: item.year,
      monthIndex: item.monthIndex,
      monthLabel,
      timestamp: item.timestamp,
      netIncome,
      netDisposableIncome,
      availableControllablePool,
      controllableExpense: controllable,
      netCashFlowMargin: margin,
      totalExpense: totalExp,
      grossIncome: transformed.grossIncome,
      excludedExpenseSum: transformed.excludedExpenseSum,
      taxDeductions: transformed.totalTaxDeductions,
      savingsRate,
      liquidBalance: 0,
      netWorth: 0,
      rawPoint: item.point,
    });
  }

  // 4. Walk backwards from the most recent month to reconstruct historical balances
  const n = chronologicalPoints.length;
  if (n > 0) {
    chronologicalPoints[n - 1].liquidBalance = anchorLiquid;
    chronologicalPoints[n - 1].netWorth = anchorNetWorth;

    for (let i = n - 2; i >= 0; i--) {
      const nextPoint = chronologicalPoints[i + 1];
      const flow = nextPoint.netCashFlowMargin;
      chronologicalPoints[i].liquidBalance = nextPoint.liquidBalance - flow;
      chronologicalPoints[i].netWorth = nextPoint.netWorth - flow;
    }
  }

  return {
    points: chronologicalPoints,
    totalPoints: chronologicalPoints.length,
    earliestDate: chronologicalPoints.length > 0 ? chronologicalPoints[0].dateStr : null,
    latestDate: chronologicalPoints.length > 0 ? chronologicalPoints[chronologicalPoints.length - 1].dateStr : null,
    currentLiquidBalance: anchorLiquid,
    currentNetWorth: anchorNetWorth,
  };
}

export type TimelineZoomRange = "6M" | "12M" | "24M" | "40M";

export const TIMELINE_ZOOM_RANGES: TimelineZoomRange[] = ["6M", "12M", "24M", "40M"];

export interface TimelineFilterOptions {
  range?: TimelineZoomRange | "all" | string;
  customFrom?: string | null;
  customTo?: string | null;
}

function getZoomRangeCount(range: string | undefined): number | null {
  switch (range) {
    case "6M":
      return 6;
    case "12M":
      return 12;
    case "24M":
      return 24;
    case "40M":
      return 40;
    default:
      return null;
  }
}

/**
 * Filters a chronological points array by preset window (6M, 12M, 24M, 40M) or custom [from, to] date range.
 */
export function filterChronologicalTrends(
  points: ChronologicalTrendPoint[],
  options?: TimelineFilterOptions | TimelineZoomRange,
): ChronologicalTrendPoint[] {
  if (points.length === 0) return [];
  if (!options) return points;

  const filter = typeof options === "string" ? { range: options } : options;
  let filtered = [...points];

  // Custom [from, to] date filtering if specified
  if (filter.customFrom || filter.customTo) {
    const fromPrefix = filter.customFrom?.slice(0, 7);
    const toPrefix = filter.customTo?.slice(0, 7);

    filtered = filtered.filter((pt) => {
      const ptPrefix = pt.dateStr.slice(0, 7);
      if (fromPrefix && ptPrefix < fromPrefix) return false;
      if (toPrefix && ptPrefix > toPrefix) return false;
      return true;
    });
  }

  // Preset window slicing: 6M, 12M, 24M, 40M
  if (filter.range && filter.range !== "all") {
    const count = getZoomRangeCount(filter.range);
    if (count !== null && filtered.length > count) {
      filtered = filtered.slice(-count);
    }
  }

  return filtered;
}

/**
 * Steps the zoom range one step inward ("in") or outward ("out").
 */
export function stepZoomRange(current: TimelineZoomRange, direction: "in" | "out"): TimelineZoomRange {
  const idx = TIMELINE_ZOOM_RANGES.indexOf(current);
  if (idx === -1) return "12M";
  if (direction === "in") {
    return TIMELINE_ZOOM_RANGES[Math.max(0, idx - 1)];
  }
  return TIMELINE_ZOOM_RANGES[Math.min(TIMELINE_ZOOM_RANGES.length - 1, idx + 1)];
}
