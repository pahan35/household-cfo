"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDownRight, ArrowUpRight, BarChart3, Calendar, Check, LineChart as LineChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";

import { type ExternalProviderCategory, formatMoney, type StatPoint } from "./external-provider-data";
import type { ExclusionPreset } from "./expense-transforms";
import { SectionShell } from "./section-shell";
import {
  MONTH_LABELS,
  type TransformYoYResult,
  transformYoYPoints,
  type YoYDelta,
  type YoYMonthData,
  type YoYYearMetric,
} from "./yoy-transforms";

export type YoYMetricType = "controllable" | "margin" | "netIncome";
export type YoYChartType = "bar" | "line";

function getMetricLabel(activeMetric: YoYMetricType): string {
  if (activeMetric === "controllable") return "Controllable Expense";
  if (activeMetric === "margin") return "Cash Flow Margin";
  return "Net Disposable Income";
}

function getMetricValue(metric: YoYYearMetric, activeMetric: YoYMetricType): number {
  if (activeMetric === "controllable") return metric.controllableExpense;
  if (activeMetric === "margin") return metric.netCashFlowMargin;
  return metric.netIncome;
}

function getMetricDeltaPercent(delta: YoYDelta | undefined, activeMetric: YoYMetricType): number | null {
  if (!delta) return null;
  if (activeMetric === "controllable") return delta.controllableDeltaPercent;
  if (activeMetric === "margin") return delta.marginDeltaPercent;
  return delta.netIncomeDeltaPercent;
}

function getMetricDeltaAbs(delta: YoYDelta | undefined, activeMetric: YoYMetricType): number | null {
  if (!delta) return null;
  if (activeMetric === "controllable") return delta.controllableDeltaAbs;
  if (activeMetric === "margin") return delta.marginDeltaAbs;
  return delta.netIncomeDeltaAbs;
}

export interface SelectedPeriod {
  year: number;
  monthIndex: number;
  dateStr: string;
}

export interface YoYTrendsCardProps {
  statPoints?: StatPoint[];
  categories?: ExternalProviderCategory[];
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
  activeMetric: YoYMetricType;
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

          // For spending, spending reduction is favorable (emerald), increase is alert (amber)
          // For margin and income, increases are favorable (emerald)
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
                <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                  <span>Savings Rate:</span>
                  <span className="text-foreground font-medium">{yearMetric.savingsRate}%</span>
                </div>
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

export function YoYTrendsCard({
  statPoints = [],
  categories = [],
  defaultCurrency = "PLN",
  activePreset,
  isLoading = false,
  error = null,
  onRetry,
  selectedPeriod,
  onSelectPeriod,
}: YoYTrendsCardProps) {
  const [activeMetric, setActiveMetric] = useState<YoYMetricType>("controllable");
  const [chartType, setChartType] = useState<YoYChartType>("bar");
  const [activeYearFocus, setActiveYearFocus] = useState<number | null>(null);

  // Transform historical points into multi-year monthly comparison series
  const yoyResult: TransformYoYResult = useMemo(() => {
    return transformYoYPoints({
      points: statPoints,
      categories,
      activePreset,
    });
  }, [statPoints, categories, activePreset]);

  const { monthlyData, availableYears, latestYear } = yoyResult;

  // Chart configuration for shadcn ChartContainer
  const chartConfig: ChartConfig = useMemo(() => {
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
        label: `${year} Cash Flow Margin`,
        color: colorVar,
      };
      config[`netIncome_${year}`] = {
        label: `${year} Net Income`,
        color: colorVar,
      };
    });
    return config;
  }, [availableYears]);

  function handleSelectMonthYear(monthIndex: number, targetYear?: number) {
    if (!onSelectPeriod) return;
    const yearToUse = targetYear ?? activeYearFocus ?? latestYear;
    // Format YYYY-MM-01
    const mStr = String(monthIndex + 1).padStart(2, "0");
    const dateStr = `${yearToUse}-${mStr}-01`;
    onSelectPeriod({
      year: yearToUse,
      monthIndex,
      dateStr,
    });
  }

  // Calculate high-level summary badge (e.g. latest month YoY change)
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

  return (
    <SectionShell
      title={
        <div className="flex items-center gap-2">
          <span>Year-over-Year Budget Trends</span>
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {availableYears.length} Years of History
          </Badge>
        </div>
      }
      description={`Monthly historical comparison across ${availableYears.join(", ")} under "${activePreset.name}" preset`}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={availableYears.length === 0}
      emptyTitle="No historical data available"
      emptyDescription="ExternalProvider did not return multi-year points for historical trend aggregation."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeMetric === "controllable"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveMetric("controllable")}
            >
              Controllable Expenses
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeMetric === "margin"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveMetric("margin")}
            >
              Cash Flow Margin
            </button>
            <button
              type="button"
              className={cn(
                "hidden cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:block",
                activeMetric === "netIncome"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveMetric("netIncome")}
            >
              Net Income
            </button>
          </div>

          {/* Chart Type Toggle */}
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
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Top Indicators & Year Legend Strip */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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

          {latestMonthSummary && (
            <div className="flex items-center gap-1.5 text-xs">
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
        </div>

        {/* Multi-Year Chart Visualization */}
        <div className="w-full overflow-x-auto pb-1">
          <ChartContainer config={chartConfig} className="h-64 w-full min-w-[540px]">
            {chartType === "bar" ? (
              <BarChart
                accessibilityLayer
                data={monthlyData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                onClick={(e: unknown) => {
                  const chartEvent = e as { activePayload?: Array<{ payload?: YoYMonthData }> };
                  if (chartEvent?.activePayload?.[0]?.payload) {
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
                    if (Math.abs(val) >= 1000) {
                      return `${(val / 1000).toFixed(0)}k`;
                    }
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
                  if (chartEvent?.activePayload?.[0]?.payload) {
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
                    if (Math.abs(val) >= 1000) {
                      return `${(val / 1000).toFixed(0)}k`;
                    }
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
        </div>

        {/* Month Quick-Focus Selector Buttons (Accessible & Touch-Friendly) */}
        <div className="flex flex-col gap-1.5 border-t pt-2.5">
          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              <span>Select month to inspect:</span>
            </span>
            {selectedPeriod && (
              <span className="text-foreground font-medium">
                Selected: {MONTH_LABELS[selectedPeriod.monthIndex]} {selectedPeriod.year}
              </span>
            )}
          </div>

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
        </div>
      </div>
    </SectionShell>
  );
}
