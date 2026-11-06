"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowLeftRight, Calendar, Check, Filter, Layers, Percent, Receipt, TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

import {
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  formatMoney,
} from "./external-provider-data";
import { SectionShell } from "./section-shell";
import { computeIncomeTaxTimeline, type IncomeTaxTimelinePoint, type TaxTimelineTimingMode } from "./tax-transforms";

export interface IncomeTaxTimelineCardProps {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency?: string;
  taxCategoryIds?: Iterable<string>;
  isLoading?: boolean;
  periodMode?: "month" | "year";
  activeMonthKey?: string;
  activeYear?: number;
  timingMode?: TaxTimelineTimingMode;
  onTimingModeChange?: (mode: TaxTimelineTimingMode) => void;
  onSelectMonth?: (monthKey: string) => void;
}

const chartConfig: ChartConfig = {
  grossIncome: {
    label: "Gross Turnover",
    color: "#64748b", // slate-500
  },
  ppe: {
    label: "Flat-rate Tax (#PPE)",
    color: "#3b82f6", // blue-500
  },
  health: {
    label: "Health (#health)",
    color: "#14b8a6", // teal-500
  },
  netZus: {
    label: "Net ZUS (Social)",
    color: "#a855f7", // purple-500
  },
  effectiveTaxRate: {
    label: "Effective Rate (%)",
    color: "#f59e0b", // amber-500
  },
};

export function IncomeTaxTimelineCard({
  transactions,
  categories,
  currencies,
  defaultCurrency = "PLN",
  taxCategoryIds,
  isLoading = false,
  periodMode = "month",
  activeMonthKey,
  activeYear,
  timingMode: controlledTimingMode,
  onTimingModeChange,
  onSelectMonth,
}: IncomeTaxTimelineCardProps) {
  const [internalTimingMode, setInternalTimingMode] = useState<TaxTimelineTimingMode>("cash");
  const timingMode = controlledTimingMode ?? internalTimingMode;
  const setTimingMode = onTimingModeChange ?? setInternalTimingMode;

  const [yearChartView, setYearChartView] = useState<"timeline" | "yoy">("timeline");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string> | null>(null);

  // Compute timeline aggregation based on active controls
  const timelineResult = useMemo(
    () =>
      computeIncomeTaxTimeline({
        transactions,
        categories,
        currencies,
        defaultCurrency,
        taxCategoryIds,
        timingMode,
        selectedSourceIds: selectedSourceIds && selectedSourceIds.size > 0 ? selectedSourceIds : null,
      }),
    [transactions, categories, currencies, defaultCurrency, taxCategoryIds, timingMode, selectedSourceIds],
  );

  const { points, availableSources, totalSelectedGross, totalPersonalTaxes, overallEffectiveRate } = timelineResult;

  // YoY comparison data for Jan–Dec overlay when in Year Mode
  const yoyPoints = useMemo(() => {
    if (periodMode !== "year" || !activeYear) return [];
    const priorYear = activeYear - 1;
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const pointMap = new Map<string, IncomeTaxTimelinePoint>(points.map((p) => [p.monthKey, p]));

    return months.map((m, idx) => {
      const curKey = `${activeYear}-${m}`;
      const priorKey = `${priorYear}-${m}`;
      const cur = pointMap.get(curKey);
      const prior = pointMap.get(priorKey);

      const curGross = cur?.grossIncome ?? 0;
      const priorGross = prior?.grossIncome ?? 0;
      const curTaxes = cur?.totalPersonalTaxes ?? 0;
      const priorTaxes = prior?.totalPersonalTaxes ?? 0;
      const curNet = cur?.netYield ?? 0;
      const priorNet = prior?.netYield ?? 0;
      const deltaGross = curGross - priorGross;
      const deltaGrossPct = priorGross > 0 ? (deltaGross / priorGross) * 100 : null;

      return {
        month: monthNames[idx],
        monthNumber: m,
        monthKey: curKey,
        currentGross: curGross,
        priorGross: priorGross,
        currentTaxes: curTaxes,
        priorTaxes: priorTaxes,
        currentNet: curNet,
        priorNet: priorNet,
        deltaGross,
        deltaGrossPct,
      };
    });
  }, [periodMode, activeYear, points]);

  const handleToggleSource = (sourceId: string) => {
    setSelectedSourceIds((prev) => {
      // If currently all sources are selected (null)
      if (prev === null) {
        // Deselect this one: keep all others
        const allIds = new Set(availableSources.map((s) => s.id));
        allIds.delete(sourceId);
        return allIds;
      }

      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }

      // If all are selected, normalize to null
      if (next.size === availableSources.length) {
        return null;
      }
      return next;
    });
  };

  const handleSelectAllSources = () => {
    setSelectedSourceIds(null);
  };

  const isAllSourcesSelected = selectedSourceIds === null || selectedSourceIds.size === availableSources.length;

  return (
    <SectionShell
      title="Income & Taxation Timeline"
      description={
        timingMode === "cash"
          ? "Historical gross turnover vs. stacked tax deductions on Cash Basis (taxes in month paid)"
          : "Historical gross turnover vs. stacked tax deductions on Accrual Basis (taxes shifted M - 1 to match revenue)"
      }
      action={
        !isLoading && points.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Eff. Rate: {overallEffectiveRate.toFixed(1)}%
            </Badge>
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Net Taxes: </span>
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                -{formatMoney(totalPersonalTaxes, defaultCurrency)}
              </span>
            </div>
          </div>
        ) : undefined
      }
      isLoading={isLoading}
      isEmpty={points.length === 0}
      emptyTitle="No timeline data available"
      emptyDescription="No historical income or tax records found for the selected transactions window."
      emptyIcon={<Calendar className="text-muted-foreground size-6" />}
      skeletonCount={3}
    >
      <div className="flex flex-col gap-4">
        {/* Top Control Bar: Source Multi-Select Chips & Basis Toggle & Year View Switch */}
        <div className="flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
          {/* Left: Source Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 flex items-center gap-1 text-xs font-medium">
              <Filter className="size-3" />
              <span>Sources:</span>
            </span>
            <Button
              type="button"
              size="xs"
              variant={isAllSourcesSelected ? "default" : "outline"}
              onClick={handleSelectAllSources}
              className="h-6 text-[11px]"
            >
              All Sources
            </Button>
            {availableSources.map((source) => {
              const isSelected = isAllSourcesSelected || (selectedSourceIds?.has(source.id) ?? false);
              return (
                <Button
                  key={source.id}
                  type="button"
                  size="xs"
                  variant={isSelected ? "secondary" : "ghost"}
                  onClick={() => handleToggleSource(source.id)}
                  className={cn(
                    "h-6 gap-1 text-[11px] transition-colors",
                    isSelected
                      ? "border-primary/30 bg-primary/10 text-primary border font-medium"
                      : "text-muted-foreground opacity-60 hover:opacity-100",
                  )}
                >
                  {isSelected && <Check className="size-3 text-primary" />}
                  <span>{source.name}</span>
                  <span className="text-muted-foreground text-[10px] font-mono">
                    ({formatMoney(source.totalConverted, defaultCurrency)})
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Right: Year Mode Chart View & Cash vs. Accrual Basis Toggle */}
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            {periodMode === "year" && activeYear && (
              <div className="bg-muted inline-flex rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setYearChartView("timeline")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-all",
                    yearChartView === "timeline"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setYearChartView("yoy")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-all",
                    yearChartView === "yoy"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  YoY ({activeYear} vs {activeYear - 1})
                </button>
              </div>
            )}

            <div className="bg-muted inline-flex rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTimingMode("cash")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  timingMode === "cash"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Cash Basis (Paid)
              </button>
              <button
                type="button"
                onClick={() => setTimingMode("accrual")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  timingMode === "accrual"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Accrual (M - 1)
              </button>
            </div>
          </div>
        </div>

        {/* Legend / Key indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {periodMode === "year" && yearChartView === "yoy" ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-blue-500" />
                <span className="text-muted-foreground">{activeYear} Gross Inflow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-slate-400" />
                <span className="text-muted-foreground">{activeYear! - 1} Gross Inflow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-3 bg-emerald-500" />
                <span className="text-muted-foreground">{activeYear} Net Cash</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-slate-400 dark:bg-slate-500" />
                <span className="text-muted-foreground">Gross Inflow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-blue-500" />
                <span className="text-muted-foreground">#PPE (Flat-rate)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-teal-500" />
                <span className="text-muted-foreground">#health (NFZ)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-xs bg-purple-500" />
                <span className="text-muted-foreground">Net #zus (after PFRON)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-3 bg-amber-500" />
                <span className="text-muted-foreground">Effective Tax Rate %</span>
              </div>
            </div>
          )}
          <span className="text-muted-foreground text-[11px] italic">
            * Click any month bar to inspect that period.
          </span>
        </div>

        {/* Recharts Visualization */}
        <div className="h-[340px] w-full">
          {periodMode === "year" && yearChartView === "yoy" ? (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={yoyPoints}
                  margin={{ top: 10, right: 16, bottom: 20, left: 10 }}
                  onClick={(e) => {
                    const clickedKey = (e as any)?.activePayload?.[0]?.payload?.monthKey;
                    if (clickedKey && onSelectMonth) {
                      onSelectMonth(clickedKey);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} className="text-[11px]" />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[11px]"
                    tickFormatter={(val: number) => {
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0]?.payload as any;
                      if (!item) return null;

                      return (
                        <div className="border-border/60 bg-popover/95 text-popover-foreground flex min-w-[220px] flex-col gap-1.5 rounded-lg border p-3 text-xs shadow-md backdrop-blur-sm">
                          <div className="flex items-center justify-between border-b pb-1 font-semibold">
                            <span>
                              {item.month} ({activeYear} vs {activeYear! - 1})
                            </span>
                            {item.deltaGrossPct !== null && (
                              <Badge
                                variant={item.deltaGross >= 0 ? "secondary" : "destructive"}
                                className="font-mono text-[10px]"
                              >
                                {item.deltaGross >= 0 ? "+" : ""}
                                {item.deltaGrossPct.toFixed(1)}% YoY
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{activeYear} Inflow:</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {formatMoney(item.currentGross, defaultCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{activeYear! - 1} Inflow:</span>
                              <span className="tabular-nums text-muted-foreground">
                                {formatMoney(item.priorGross, defaultCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-1 font-medium">
                              <span className="text-muted-foreground">Inflow Delta:</span>
                              <span
                                className={cn(
                                  "tabular-nums font-semibold",
                                  item.deltaGross >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400",
                                )}
                              >
                                {item.deltaGross >= 0 ? "+" : ""}
                                {formatMoney(item.deltaGross, defaultCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-1">
                              <span className="text-muted-foreground">Net Cash ({activeYear}):</span>
                              <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatMoney(item.currentNet, defaultCurrency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="currentGross"
                    name={`${activeYear} Inflow`}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="priorGross"
                    name={`${activeYear! - 1} Inflow`}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    className="opacity-60"
                    cursor="pointer"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="currentNet"
                    name={`${activeYear} Net Cash`}
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10b981" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={points}
                  margin={{ top: 10, right: 16, bottom: 20, left: 10 }}
                  onClick={(e) => {
                    const clickedKey = (e as any)?.activePayload?.[0]?.payload?.monthKey;
                    if (clickedKey && onSelectMonth) {
                      onSelectMonth(clickedKey);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[11px]"
                  />
                  {/* Left Y-Axis: Amounts in default currency */}
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[11px]"
                    tickFormatter={(val: number) => {
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  {/* Right Y-Axis: Effective tax rate percentage */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 40]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[11px]"
                    tickFormatter={(val: number) => `${val}%`}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0]?.payload as IncomeTaxTimelinePoint | undefined;
                      if (!point) return null;

                      return (
                        <div className="border-border/60 bg-popover/95 text-popover-foreground flex min-w-[220px] flex-col gap-1.5 rounded-lg border p-3 text-xs shadow-md backdrop-blur-sm">
                          <div className="flex items-center justify-between border-b pb-1 font-semibold">
                            <span>{point.monthLabel}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {point.effectiveTaxRate.toFixed(1)}% eff. rate
                            </Badge>
                          </div>

                          <div className="flex flex-col gap-1 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Gross Inflow:</span>
                              <span className="font-semibold tabular-nums">
                                {formatMoney(point.grossIncome, defaultCurrency)}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-col gap-0.5 border-t pt-1">
                              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                                Tax Deductions
                              </span>
                              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                                <span>PPE Income Tax:</span>
                                <span className="tabular-nums">-{formatMoney(point.ppe, defaultCurrency)}</span>
                              </div>
                              <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
                                <span>Health (NFZ):</span>
                                <span className="tabular-nums">-{formatMoney(point.health, defaultCurrency)}</span>
                              </div>
                              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                                <span>Net ZUS (Social):</span>
                                <span className="tabular-nums">-{formatMoney(point.netZus, defaultCurrency)}</span>
                              </div>
                              {point.pfronCashback > 0 && (
                                <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                                  <span>(PFRON Cashback offset):</span>
                                  <span className="tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                                    +{formatMoney(point.pfronCashback, defaultCurrency)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="mt-1 flex items-center justify-between border-t pt-1 font-medium">
                              <span className="text-muted-foreground">Total Taxes:</span>
                              <span className="tabular-nums text-rose-600 dark:text-rose-400">
                                -{formatMoney(point.totalPersonalTaxes, defaultCurrency)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between border-t pt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <span>Net Yield:</span>
                              <span className="tabular-nums">{formatMoney(point.netYield, defaultCurrency)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* 1. Gross Inflow Bar */}
                  <Bar
                    yAxisId="left"
                    dataKey="grossIncome"
                    name="Gross Turnover"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    className="opacity-70 dark:opacity-50"
                    cursor="pointer"
                  />

                  {/* 2. Stacked Tax Bars (PPE + Health + Net ZUS) */}
                  <Bar
                    yAxisId="left"
                    dataKey="ppe"
                    name="PPE"
                    stackId="taxes"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={44}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="health"
                    name="Health"
                    stackId="taxes"
                    fill="#14b8a6"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={44}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="netZus"
                    name="Net ZUS"
                    stackId="taxes"
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    cursor="pointer"
                  />

                  {/* 3. Effective Tax Rate Trendline on Right Y-Axis */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="effectiveTaxRate"
                    name="Effective Tax Rate %"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#f59e0b" }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
