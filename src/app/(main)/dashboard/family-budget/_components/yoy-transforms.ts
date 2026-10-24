import { format, isValid, parseISO, startOfMonth } from "date-fns";

import type { ExternalProviderCategory, StatPoint } from "./external-provider-data";
import { type ExclusionPreset, transformExpenses } from "./expense-transforms";

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
  totalExpense: number;
  savingsRate: number;
  netCashFlowMargin: number;
  taxDeductions: number;
  excludedExpenseSum: number;
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

/**
 * Parses and validates date information from a StatPoint.
 */
export function parsePointDate(
  point: StatPoint,
): { year: number; monthIndex: number; dateStr: string; timestamp: number } | null {
  const rawDate = point.date || point.id;
  if (!rawDate) return null;

  let d = parseISO(rawDate);
  if (!isValid(d)) {
    d = new Date(rawDate);
  }
  if (!isValid(d)) {
    const num = Number(rawDate);
    if (!Number.isNaN(num) && num > 0) {
      d = new Date(num);
    }
  }
  if (!isValid(d)) return null;

  const monthStart = startOfMonth(d);
  return {
    year: d.getFullYear(),
    monthIndex: d.getMonth(),
    dateStr: format(monthStart, "yyyy-MM-dd"),
    timestamp: monthStart.getTime(),
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
        const netIncome = transformed.netDisposableIncome;
        const margin = transformed.netCashFlowMargin;
        const totalExp = transformed.totalGrossExpense;
        const savingsRate = netIncome > 0 ? Math.round(((netIncome - controllable) / netIncome) * 100) : 0;

        const metric: YoYYearMetric = {
          year,
          monthIndex: m,
          pointId: pointItem.dateStr,
          controllableExpense: controllable,
          netIncome,
          totalExpense: totalExp,
          savingsRate,
          netCashFlowMargin: margin,
          taxDeductions: transformed.totalTaxDeductions,
          excludedExpenseSum: transformed.excludedExpenseSum,
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
