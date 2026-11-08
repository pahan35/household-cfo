"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CalendarRange,
  Check,
  LineChart as LineChartIcon,
  Minus,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";

import type { ExclusionPreset } from "./expense-transforms";
import {
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  formatMoney,
  type StatPoint,
} from "./external-provider-data";
import { SectionShell } from "./section-shell";
import {
  type ChronologicalTrendPoint,
  filterChronologicalTrends,
  MONTH_LABELS,
  stepZoomRange,
  TIMELINE_ZOOM_RANGES,
  type TimelineZoomRange,
  type TransformYoYResult,
  transformChronologicalTrends,
  transformYoYPoints,
  type YoYDelta,
  type YoYMonthData,
  type YoYYearMetric,
} from "./yoy-transforms";

export type MacroTrendMetric = "expenses_income" | "controllable" | "netIncome" | "balance" | "netWorth" | "margin";

export type YoYMetricType = MacroTrendMetric;
export type YoYChartType = "bar" | "line";
export type TrendViewMode = "timeline" | "yoy";

export const MACRO_METRIC_CONFIG: Record<MacroTrendMetric, { label: string; shortLabel: string; description: string }> =
  {
    expenses_income: {
      label: "Expenses & Income",
      shortLabel: "Exp & Inc",
      description: "Dual-curve overlay of controllable spending vs. controllable income pool",
    },
    controllable: {
      label: "Expenses",
      shortLabel: "Expenses",
      description: "Monthly controllable spending under active exclusion preset",
    },
    netIncome: {
      label: "Income",
      shortLabel: "Income",
      description: "Controllable income pool after tax deductions and fixed obligations (Rent, Insurance)",
    },
    balance: {
      label: "Balance",
      shortLabel: "Balance",
      description: "Historical end-of-month liquid balance (excluding exceptFromBalance)",
    },
    netWorth: {
      label: "Net Worth",
      shortLabel: "Net Worth",
      description: "Historical end-of-month total wealth (liquid, goals & debt accounts)",
    },
    margin: {
      label: "Cash Flow Margin",
      shortLabel: "Margin",
      description: "Net cash flow margin (Net Income minus Controllable Expenses)",
    },
  };

function getMetricLabel(activeMetric: MacroTrendMetric): string {
  return MACRO_METRIC_CONFIG[activeMetric]?.label ?? activeMetric;
}

function getMetricValue(metric: YoYYearMetric, activeMetric: MacroTrendMetric): number {
  if (activeMetric === "controllable") return metric.controllableExpense;
  if (activeMetric === "margin") return metric.netCashFlowMargin;
  if (activeMetric === "netIncome") return metric.netIncome;
  return metric.controllableExpense;
}

function getMetricDeltaPercent(delta: YoYDelta | undefined, activeMetric: MacroTrendMetric): number | null {
  if (!delta) return null;
  if (activeMetric === "controllable") return delta.controllableDeltaPercent;
  if (activeMetric === "margin") return delta.marginDeltaPercent;
  if (activeMetric === "netIncome") return delta.netIncomeDeltaPercent;
  return null;
}

function getMetricDeltaAbs(delta: YoYDelta | undefined, activeMetric: MacroTrendMetric): number | null {
  if (!delta) return null;
  if (activeMetric === "controllable") return delta.controllableDeltaAbs;
  if (activeMetric === "margin") return delta.marginDeltaAbs;
  if (activeMetric === "netIncome") return delta.netIncomeDeltaAbs;
  return null;
}

export interface SelectedPeriod {
  year: number;
  monthIndex: number;
  dateStr: string;
}

export interface YoYTrendsCardProps {
  statPoints?: StatPoint[];
  categories?: ExternalProviderCategory[];
  currencies?: ExternalProviderCurrency[];
  defaultCurrency?: string;
  activePreset: ExclusionPreset;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  selectedPeriod?: SelectedPeriod | null;
  onSelectPeriod?: (period: SelectedPeriod) => void;
}

interface CustomYoYTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | null;
    payload?: YoYMonthData;
    color?: string;
    dataKey?: string;
  }>;
  currency: string;
  activeMetric: MacroTrendMetric;
  availableYears: number[];
}

function CustomYoYTooltip({ active, payload, currency, activeMetric, availableYears }: CustomYoYTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const monthData = payload[0]?.payload;
  if (!monthData) return null;

  const metricLabel = getMetricLabel(activeMetric);
  const yearsDescending = [...availableYears].sort((a, b) => b - a);

  return (
    <div className="bg-popover text-popover-foreground min-w-56 rounded-lg border p-3 text-xs shadow-md">
      <div className="mb-2 flex items-center justify-between border-b pb-1.5 font-medium">
        <span className="text-sm font-semibold">{monthData.monthLabel} Breakdown</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {metricLabel}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {yearsDescending.map((year) => {
          const yearMetric: YoYYearMetric | undefined = monthData.years[year];
          const delta: YoYDelta | undefined = monthData.deltas[year];
          const colorVar = `var(--chart-${(availableYears.indexOf(year) % 5) + 1})`;

          if (!yearMetric) {
            return (
              <div key={year} className="text-muted-foreground flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full opacity-40" style={{ backgroundColor: colorVar }} />
                  {year}
                </span>
                <span className="italic">No data</span>
              </div>
            );
          }

          const value = getMetricValue(yearMetric, activeMetric);
          const deltaPercent = getMetricDeltaPercent(delta, activeMetric);
          const deltaAbs = getMetricDeltaAbs(delta, activeMetric);

          const isFavorable = activeMetric === "controllable" ? (deltaAbs ?? 0) <= 0 : (deltaAbs ?? 0) >= 0;

          return (
            <div key={year} className="bg-muted/30 flex flex-col gap-0.5 rounded-md p-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: colorVar }} />
                  <span>{year}</span>
                </span>
                <span className="font-semibold">{formatMoney(value, currency)}</span>
              </div>

              {delta && deltaPercent !== null && (
                <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                  <span>vs {delta.fromYear}:</span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 font-medium",
                      isFavorable ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {(deltaAbs ?? 0) >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(deltaPercent).toFixed(1)}% ({formatMoney(Math.abs(deltaAbs ?? 0), currency)})
                  </span>
                </div>
              )}

              {activeMetric === "controllable" && (
                <>
                  {yearMetric.excludedExpenseSum > 0 && (
                    <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                      <span>Excluded Fixed:</span>
                      <span className="text-foreground font-medium">
                        {formatMoney(yearMetric.excludedExpenseSum, currency)}
                      </span>
                    </div>
                  )}
                  <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                    <span>Savings Rate:</span>
                    <span className="text-foreground font-medium">{yearMetric.savingsRate}%</span>
                  </div>
                </>
              )}

              {activeMetric === "netIncome" && yearMetric.excludedExpenseSum > 0 && (
                <>
                  <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                    <span>Net Disposable:</span>
                    <span className="text-foreground font-medium">
                      {formatMoney(yearMetric.netDisposableIncome, currency)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                    <span>Excluded Fixed:</span>
                    <span className="text-rose-500 font-medium">
                      -{formatMoney(yearMetric.excludedExpenseSum, currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-muted-foreground mt-2.5 border-t pt-1.5 text-center text-[10px]">
        Click to focus dashboard on this month
      </div>
    </div>
  );
}

interface CustomTimelineTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | null;
    payload?: ChronologicalTrendPoint;
    color?: string;
    dataKey?: string;
  }>;
  currency: string;
  activeMetric: MacroTrendMetric;
}

function CustomTimelineTooltip({ active, payload, currency, activeMetric }: CustomTimelineTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-popover text-popover-foreground min-w-60 rounded-lg border p-3 text-xs shadow-md">
      <div className="mb-2 flex items-center justify-between border-b pb-1.5 font-medium">
        <span className="text-sm font-semibold">{point.monthLabel} Breakdown</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {getMetricLabel(activeMetric)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <TimelineTooltipContent point={point} activeMetric={activeMetric} currency={currency} />
      </div>

      <div className="text-muted-foreground mt-2.5 border-t pt-1.5 text-center text-[10px]">
        Click to focus dashboard on this month
      </div>
    </div>
  );
}

function TimelineTooltipContent({
  point,
  activeMetric,
  currency,
}: {
  point: ChronologicalTrendPoint;
  activeMetric: MacroTrendMetric;
  currency: string;
}) {
  switch (activeMetric) {
    case "expenses_income":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Controllable Income:</span>
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(point.netIncome, currency)}
            </span>
          </div>
          {point.excludedExpenseSum > 0 && (
            <>
              <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
                <span>Net Disposable:</span>
                <span>{formatMoney(point.netDisposableIncome, currency)}</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
                <span>Excluded Fixed Obligations:</span>
                <span className="text-rose-500 font-medium">-{formatMoney(point.excludedExpenseSum, currency)}</span>
              </div>
            </>
          )}
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              <span>Controllable Expenses:</span>
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              -{formatMoney(point.controllableExpense, currency)}
            </span>
          </div>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground font-medium">Monthly Gap (Surplus/Deficit):</span>
            <span
              className={cn(
                "font-semibold",
                point.netCashFlowMargin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {point.netCashFlowMargin >= 0 ? "+" : ""}
              {formatMoney(point.netCashFlowMargin, currency)}
            </span>
          </div>
          {point.netDisposableIncome > 0 && (
            <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
              <span>Savings Rate:</span>
              <span className="text-foreground font-medium">{point.savingsRate}%</span>
            </div>
          )}
        </>
      );
    case "balance":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground">Liquid Balance:</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">
              {formatMoney(point.liquidBalance, currency)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
            <span>Monthly Net Flow:</span>
            <span
              className={cn(
                "font-medium",
                point.netCashFlowMargin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {point.netCashFlowMargin >= 0 ? "+" : ""}
              {formatMoney(point.netCashFlowMargin, currency)}
            </span>
          </div>
          <div className="text-muted-foreground px-1 text-[10px] italic">
            Liquid accounts only (excluding exceptFromBalance)
          </div>
        </>
      );
    case "netWorth":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground">Total Net Worth:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {formatMoney(point.netWorth, currency)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
            <span>Monthly Net Flow:</span>
            <span
              className={cn(
                "font-medium",
                point.netCashFlowMargin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {point.netCashFlowMargin >= 0 ? "+" : ""}
              {formatMoney(point.netCashFlowMargin, currency)}
            </span>
          </div>
          <div className="text-muted-foreground px-1 text-[10px] italic">
            Includes liquid accounts, goals & debt accounts
          </div>
        </>
      );
    case "controllable":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground">Controllable:</span>
            <span className="font-semibold">{formatMoney(point.controllableExpense, currency)}</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
            <span>Gross Expenses:</span>
            <span className="font-medium">{formatMoney(point.totalExpense, currency)}</span>
          </div>
          {point.excludedExpenseSum > 0 && (
            <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
              <span>Excluded Expenses:</span>
              <span className="font-medium">{formatMoney(point.excludedExpenseSum, currency)}</span>
            </div>
          )}
        </>
      );
    case "netIncome":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground">Controllable Income:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatMoney(point.netIncome, currency)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
            <span>Gross Income:</span>
            <span className="font-medium">{formatMoney(point.grossIncome, currency)}</span>
          </div>
          {point.taxDeductions > 0 && (
            <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
              <span>Tax Deductions:</span>
              <span className="font-medium text-rose-500">-{formatMoney(point.taxDeductions, currency)}</span>
            </div>
          )}
          {point.excludedExpenseSum > 0 && (
            <>
              <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
                <span>Net Disposable Income:</span>
                <span className="font-medium">{formatMoney(point.netDisposableIncome, currency)}</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
                <span>Excluded Fixed Obligations:</span>
                <span className="font-medium text-rose-500">-{formatMoney(point.excludedExpenseSum, currency)}</span>
              </div>
            </>
          )}
        </>
      );
    case "margin":
      return (
        <>
          <div className="bg-muted/30 flex items-center justify-between rounded-md p-1.5">
            <span className="text-muted-foreground">Cash Flow Margin:</span>
            <span
              className={cn(
                "font-semibold",
                point.netCashFlowMargin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {point.netCashFlowMargin >= 0 ? "+" : ""}
              {formatMoney(point.netCashFlowMargin, currency)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
            <span>Savings Rate:</span>
            <span className="font-medium">{point.savingsRate}%</span>
          </div>
        </>
      );
  }
}

function getTimelineBarDataKey(metric: MacroTrendMetric): string {
  switch (metric) {
    case "netIncome":
      return "netIncome";
    case "margin":
      return "netCashFlowMargin";
    case "balance":
      return "liquidBalance";
    case "netWorth":
      return "netWorth";
    default:
      return "controllableExpense";
  }
}

function getTimelineBarFill(metric: MacroTrendMetric): string {
  switch (metric) {
    case "netIncome":
      return "#10b981";
    case "margin":
      return "var(--chart-3)";
    case "balance":
      return "var(--chart-1)";
    case "netWorth":
      return "var(--chart-2)";
    default:
      return "#f43f5e";
  }
}

function getLatestTimelineMetricValue(
  metric: MacroTrendMetric,
  chronologicalResult: { currentNetWorth: number; currentLiquidBalance: number },
  latestPoint?: ChronologicalTrendPoint,
): number | null {
  if (metric === "netWorth") return chronologicalResult.currentNetWorth;
  if (metric === "balance") return chronologicalResult.currentLiquidBalance;
  if (!latestPoint) return null;
  switch (metric) {
    case "netIncome":
      return latestPoint.netIncome;
    case "margin":
      return latestPoint.netCashFlowMargin;
    default:
      return latestPoint.controllableExpense;
  }
}

function renderTimelineLines(activeMetric: MacroTrendMetric) {
  if (activeMetric === "expenses_income") {
    return (
      <>
        <Line
          type="monotone"
          dataKey="netIncome"
          name="Controllable Income"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: "#10b981" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="controllableExpense"
          name="Controllable Expenses"
          stroke="#f43f5e"
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: "#f43f5e" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </>
    );
  }

  const dataKey = getTimelineBarDataKey(activeMetric);
  const stroke = getTimelineBarFill(activeMetric);
  const name = getMetricLabel(activeMetric);

  return (
    <Line
      type="monotone"
      dataKey={dataKey}
      name={name}
      stroke={stroke}
      strokeWidth={2.5}
      dot={{ r: 2.5, fill: stroke }}
      activeDot={{ r: 5 }}
      connectNulls
    />
  );
}

export function YoYTrendsCard({
  statPoints = [],
  categories = [],
  currencies = [],
  defaultCurrency = "PLN",
  activePreset,
  isLoading = false,
  error = null,
  onRetry,
  selectedPeriod,
  onSelectPeriod,
}: YoYTrendsCardProps) {
  const [activeMetric, setActiveMetric] = useState<MacroTrendMetric>("expenses_income");
  const [viewMode, setViewMode] = useState<TrendViewMode>("timeline");
  const [zoomRange, setZoomRange] = useState<TimelineZoomRange>("12M");
  const [chartType, setChartType] = useState<YoYChartType>("line");
  const [activeYearFocus, setActiveYearFocus] = useState<number | null>(null);

  // 1. Compute Continuous Chronological Timeline result
  const chronologicalResult = useMemo(() => {
    return transformChronologicalTrends({
      points: statPoints,
      categories,
      currencies,
      defaultCurrency,
      activePreset,
    });
  }, [statPoints, categories, currencies, defaultCurrency, activePreset]);

  // 2. Filter timeline points by active zoom window
  const timelinePoints = useMemo(() => {
    return filterChronologicalTrends(chronologicalResult.points, zoomRange);
  }, [chronologicalResult.points, zoomRange]);

  // 3. Compute Year-over-Year calendar-aligned grouping
  const yoyResult: TransformYoYResult = useMemo(() => {
    return transformYoYPoints({
      points: statPoints,
      categories,
      activePreset,
    });
  }, [statPoints, categories, activePreset]);

  const { monthlyData, availableYears, latestYear } = yoyResult;

  // Chart configuration for YoY ChartContainer
  const yoyChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    availableYears.forEach((year, idx) => {
      const colorVar = `var(--chart-${(idx % 5) + 1})`;
      config[year.toString()] = {
        label: year.toString(),
        color: colorVar,
      };
      config[`controllable_${year}`] = {
        label: `${year} Controllable`,
        color: colorVar,
      };
      config[`margin_${year}`] = {
        label: `${year} Margin`,
        color: colorVar,
      };
      config[`netIncome_${year}`] = {
        label: `${year} Income`,
        color: colorVar,
      };
    });
    return config;
  }, [availableYears]);

  // Chart configuration for Continuous Timeline ChartContainer
  const timelineChartConfig: ChartConfig = useMemo(() => {
    return {
      netIncome: {
        label: "Net Income",
        color: "#10b981",
      },
      controllableExpense: {
        label: "Expenses",
        color: "#f43f5e",
      },
      liquidBalance: {
        label: "Liquid Balance",
        color: "var(--chart-1)",
      },
      netWorth: {
        label: "Total Net Worth",
        color: "var(--chart-2)",
      },
      netCashFlowMargin: {
        label: "Cash Flow Margin",
        color: "var(--chart-3)",
      },
    };
  }, []);

  function handleSelectMonthYear(monthIndex: number, targetYear?: number) {
    if (!onSelectPeriod) return;
    const yearToUse = targetYear ?? activeYearFocus ?? latestYear;
    const mStr = String(monthIndex + 1).padStart(2, "0");
    const dateStr = `${yearToUse}-${mStr}-01`;
    onSelectPeriod({
      year: yearToUse,
      monthIndex,
      dateStr,
    });
  }

  function handleSelectTimelinePoint(point: ChronologicalTrendPoint) {
    if (!onSelectPeriod) return;
    onSelectPeriod({
      year: point.year,
      monthIndex: point.monthIndex,
      dateStr: point.dateStr,
    });
  }

  function handleMetricChange(metric: MacroTrendMetric) {
    setActiveMetric(metric);
    // When user selects Expenses & Income, automatically ensure Timeline view
    if (metric === "expenses_income" && viewMode === "yoy") {
      setViewMode("timeline");
    }
  }

  function handleViewModeChange(mode: TrendViewMode) {
    setViewMode(mode);
    // If switching to YoY from Expenses & Income, switch metric to Expenses
    if (mode === "yoy" && activeMetric === "expenses_income") {
      setActiveMetric("controllable");
    }
  }

  // Calculate high-level summary badge (latest month YoY change)
  const latestMonthSummary = useMemo(() => {
    if (monthlyData.length === 0 || availableYears.length < 2) return null;
    const currentMonthIndex = new Date().getMonth();
    const data = monthlyData[currentMonthIndex] ?? monthlyData[monthlyData.length - 1];
    if (!data) return null;
    const delta = data.deltas[latestYear];
    if (!delta || delta.controllableDeltaPercent === null) return null;

    return {
      monthLabel: data.monthLabel,
      deltaPercent: delta.controllableDeltaPercent,
      deltaAbs: delta.controllableDeltaAbs,
      fromYear: delta.fromYear,
      toYear: delta.toYear,
    };
  }, [monthlyData, availableYears, latestYear]);

  const isEmpty = viewMode === "timeline" ? timelinePoints.length === 0 : availableYears.length === 0;

  return (
    <SectionShell
      title={
        <div className="flex items-center gap-2">
          <span>{viewMode === "timeline" ? "Macro Financial Trends" : "Year-over-Year Budget Trends"}</span>
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {viewMode === "timeline"
              ? `${timelinePoints.length} Months (${zoomRange})`
              : `${availableYears.length} Years of History`}
          </Badge>
        </div>
      }
      description={
        viewMode === "timeline" && timelinePoints.length > 0
          ? `${MACRO_METRIC_CONFIG[activeMetric]?.description ?? ""} (${timelinePoints[0]?.monthLabel} – ${timelinePoints[timelinePoints.length - 1]?.monthLabel})`
          : `Monthly historical comparison across ${availableYears.join(", ")} under "${activePreset.name}" preset`
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyTitle="No historical data available"
      emptyDescription="ExternalProvider did not return points for historical trend aggregation."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Timeline vs YoY */}
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "timeline"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleViewModeChange("timeline")}
            >
              <TrendingUp className="size-3.5" />
              <span>Timeline</span>
            </button>
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "yoy"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleViewModeChange("yoy")}
            >
              <CalendarRange className="size-3.5" />
              <span>Year-over-Year</span>
            </button>
          </div>

          {/* Timeline Zoom Controls */}
          {viewMode === "timeline" && (
            <div className="flex items-center gap-1">
              <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="size-6 cursor-pointer"
                  onClick={() => setZoomRange((cur) => stepZoomRange(cur, "out"))}
                  disabled={zoomRange === "40M"}
                  title="Zoom out (longer window)"
                >
                  <Minus className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="size-6 cursor-pointer"
                  onClick={() => setZoomRange((cur) => stepZoomRange(cur, "in"))}
                  disabled={zoomRange === "6M"}
                  title="Zoom in (shorter window)"
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              <div className="bg-muted/40 hidden items-center rounded-lg border p-0.5 text-xs sm:flex">
                {TIMELINE_ZOOM_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setZoomRange(range)}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      zoomRange === range
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chart Type Toggle (for YoY or single-metric timeline) */}
          {(viewMode === "yoy" || activeMetric !== "expenses_income") && (
            <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
              <button
                type="button"
                aria-label="Bar chart view"
                className={cn(
                  "cursor-pointer rounded-md p-1 transition-colors",
                  chartType === "bar"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setChartType("bar")}
              >
                <BarChart3 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Line chart view"
                className={cn(
                  "cursor-pointer rounded-md p-1 transition-colors",
                  chartType === "line"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setChartType("line")}
              >
                <LineChartIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Macro Mode Strip (ExternalProvider Web: Expenses & Income, Expenses, Income, Balance, Net Worth + Margin) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "expenses_income"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("expenses_income")}
            >
              Expenses & Income
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "controllable"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("controllable")}
            >
              Expenses
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "netIncome"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("netIncome")}
            >
              Income
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "balance"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("balance")}
            >
              Balance
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "netWorth"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("netWorth")}
            >
              Net Worth
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeMetric === "margin"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleMetricChange("margin")}
            >
              Margin
            </button>
          </div>

          {/* Status summary pill */}
          {viewMode === "yoy" && latestMonthSummary && (
            <div className="hidden items-center gap-1.5 text-xs lg:flex">
              <span className="text-muted-foreground">
                {latestMonthSummary.monthLabel} YoY ({latestMonthSummary.toYear} vs {latestMonthSummary.fromYear}):
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  latestMonthSummary.deltaAbs <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {latestMonthSummary.deltaAbs >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {Math.abs(latestMonthSummary.deltaPercent).toFixed(1)}%
              </span>
            </div>
          )}

          {viewMode === "timeline" && (
            <div className="hidden items-center gap-3 text-xs sm:flex">
              {activeMetric === "expenses_income" && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Income
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <span className="size-2 rounded-full bg-rose-500" />
                    Expenses
                  </span>
                </div>
              )}
              <span className="text-muted-foreground">
                Latest:{" "}
                <span className="text-foreground font-semibold">
                  {(() => {
                    const val = getLatestTimelineMetricValue(
                      activeMetric,
                      chronologicalResult,
                      timelinePoints[timelinePoints.length - 1],
                    );
                    return val !== null ? formatMoney(val, defaultCurrency) : "";
                  })()}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* YoY Series Filter Legend Strip (Only visible in YoY view) */}
        {viewMode === "yoy" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Series:</span>
            {availableYears.map((year, idx) => {
              const colorVar = `var(--chart-${(idx % 5) + 1})`;
              const isFocused = activeYearFocus === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setActiveYearFocus(isFocused ? null : year)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                    isFocused
                      ? "border-foreground bg-accent text-accent-foreground shadow-xs"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: colorVar }} />
                  <span>{year}</span>
                  {isFocused && <Check className="text-foreground size-3" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Chart Visualization Area */}
        <div className="w-full overflow-x-auto pb-1">
          {viewMode === "timeline" ? (
            /* Continuous Timeline Chart */
            <ChartContainer config={timelineChartConfig} className="h-64 w-full min-w-[540px]">
              {chartType === "bar" && activeMetric !== "expenses_income" ? (
                <BarChart
                  accessibilityLayer
                  data={timelinePoints}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  onClick={(e: unknown) => {
                    const chartEvent = e as { activePayload?: Array<{ payload?: ChronologicalTrendPoint }> };
                    if (chartEvent.activePayload?.[0]?.payload) {
                      handleSelectTimelinePoint(chartEvent.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    tickFormatter={(val: number) => {
                      if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.15 }}
                    content={<CustomTimelineTooltip currency={defaultCurrency} activeMetric={activeMetric} />}
                  />
                  <Bar
                    dataKey={getTimelineBarDataKey(activeMetric)}
                    fill={getTimelineBarFill(activeMetric)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              ) : (
                <LineChart
                  accessibilityLayer
                  data={timelinePoints}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  onClick={(e: unknown) => {
                    const chartEvent = e as { activePayload?: Array<{ payload?: ChronologicalTrendPoint }> };
                    if (chartEvent.activePayload?.[0]?.payload) {
                      handleSelectTimelinePoint(chartEvent.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    tickFormatter={(val: number) => {
                      if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <ChartTooltip
                    content={<CustomTimelineTooltip currency={defaultCurrency} activeMetric={activeMetric} />}
                  />
                  {renderTimelineLines(activeMetric)}
                </LineChart>
              )}
            </ChartContainer>
          ) : (
            /* Year-over-Year Calendar Aligned Chart */
            <ChartContainer config={yoyChartConfig} className="h-64 w-full min-w-[540px]">
              {chartType === "bar" ? (
                <BarChart
                  accessibilityLayer
                  data={monthlyData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  onClick={(e: unknown) => {
                    const chartEvent = e as { activePayload?: Array<{ payload?: YoYMonthData }> };
                    if (chartEvent.activePayload?.[0]?.payload) {
                      const row = chartEvent.activePayload[0].payload;
                      handleSelectMonthYear(row.monthIndex);
                    }
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    tickFormatter={(val: number) => {
                      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.15 }}
                    content={
                      <CustomYoYTooltip
                        currency={defaultCurrency}
                        activeMetric={activeMetric}
                        availableYears={availableYears}
                      />
                    }
                  />
                  {availableYears.map((year, idx) => {
                    const colorVar = `var(--chart-${(idx % 5) + 1})`;
                    const isDimmed = activeYearFocus !== null && activeYearFocus !== year;
                    return (
                      <Bar
                        key={year}
                        dataKey={`${activeMetric}_${year}`}
                        name={`${year}`}
                        fill={colorVar}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                        fillOpacity={isDimmed ? 0.2 : 1}
                        className="cursor-pointer transition-opacity"
                        onClick={(data) => {
                          const mIdx = (data as unknown as { monthIndex: number }).monthIndex;
                          if (typeof mIdx === "number") {
                            handleSelectMonthYear(mIdx, year);
                          }
                        }}
                      />
                    );
                  })}
                </BarChart>
              ) : (
                <LineChart
                  accessibilityLayer
                  data={monthlyData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  onClick={(e: unknown) => {
                    const chartEvent = e as { activePayload?: Array<{ payload?: YoYMonthData }> };
                    if (chartEvent.activePayload?.[0]?.payload) {
                      const row = chartEvent.activePayload[0].payload;
                      handleSelectMonthYear(row.monthIndex);
                    }
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs"
                    tickFormatter={(val: number) => {
                      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <ChartTooltip
                    content={
                      <CustomYoYTooltip
                        currency={defaultCurrency}
                        activeMetric={activeMetric}
                        availableYears={availableYears}
                      />
                    }
                  />
                  {availableYears.map((year, idx) => {
                    const colorVar = `var(--chart-${(idx % 5) + 1})`;
                    const isDimmed = activeYearFocus !== null && activeYearFocus !== year;
                    return (
                      <Line
                        key={year}
                        type="monotone"
                        dataKey={`${activeMetric}_${year}`}
                        name={`${year}`}
                        stroke={colorVar}
                        strokeWidth={isDimmed ? 1 : 2.5}
                        strokeOpacity={isDimmed ? 0.25 : 1}
                        dot={{ r: 2.5, fill: colorVar }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              )}
            </ChartContainer>
          )}
        </div>

        {/* Month Quick-Focus Selector Buttons (Accessible & Touch-Friendly) */}
        <div className="flex flex-col gap-1.5 border-t pt-2.5">
          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              <span>
                {viewMode === "timeline" ? "Quick inspect timeline month:" : "Select calendar month to inspect:"}
              </span>
            </span>
            {selectedPeriod && (
              <span className="text-foreground font-medium">
                Selected: {MONTH_LABELS[selectedPeriod.monthIndex]} {selectedPeriod.year}
              </span>
            )}
          </div>

          {viewMode === "timeline" ? (
            <div className="flex flex-wrap gap-1">
              {timelinePoints.map((pt) => {
                const isSelected = selectedPeriod?.dateStr === pt.dateStr;
                return (
                  <button
                    key={pt.dateStr}
                    type="button"
                    onClick={() => handleSelectTimelinePoint(pt)}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-1 text-center text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {pt.monthLabel}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {MONTH_LABELS.map((label, idx) => {
                const isSelected = selectedPeriod?.monthIndex === idx;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelectMonthYear(idx)}
                    className={cn(
                      "cursor-pointer rounded-md px-1.5 py-1 text-center text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
