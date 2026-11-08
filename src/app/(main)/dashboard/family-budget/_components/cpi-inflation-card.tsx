"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { TrendingDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";

import { type ExclusionPreset, transformExpenses } from "./expense-transforms";
import { type ExternalProviderCategory, formatMoney, type StatPoint } from "./external-provider-data";
import { BASE_CPI_MONTH, getMacroData } from "./macro-data";
import {
  calculateRealValue,
  convertCurrency,
  type MacroTimelinePoint,
  type ReportingCurrency,
} from "./macro-transforms";
import { SectionShell } from "./section-shell";
import { parsePointDate } from "./yoy-transforms";

export interface CpiInflationCardProps {
  statPoints?: StatPoint[];
  categories?: ExternalProviderCategory[];
  activePreset: ExclusionPreset;
  currency: ReportingCurrency;
  onCurrencyChange?: (c: ReportingCurrency) => void;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
}

const chartConfig = {
  nominalIncome: {
    label: "Nominal Income",
    color: "var(--color-chart-1, #2563eb)",
  },
  realIncome: {
    label: "Real Purchasing Power",
    color: "var(--color-chart-2, #10b981)",
  },
  controllableExpense: {
    label: "Controllable Expenses",
    color: "var(--color-chart-5, #f59e0b)",
  },
} satisfies ChartConfig;

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: MacroTimelinePoint;
  color?: string;
}

function CustomInflationTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  currency: ReportingCurrency;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground min-w-64 rounded-lg border p-3 text-xs shadow-md">
      <div className="mb-2 flex items-center justify-between border-b pb-1.5 font-medium">
        <span className="text-sm font-semibold">{data.monthLabel}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            CPI {data.cpiIndex.toFixed(1)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
            1$ = {data.usdPlnRate.toFixed(2)} zł
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Nominal Income:</span>
          </div>
          <span className="font-semibold font-mono">{formatMoney(data.nominalIncome, currency)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Real Purchasing Power:</span>
          </div>
          <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
            {formatMoney(data.realIncome, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between text-destructive">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="size-3" />
            <span>Inflation Erosion:</span>
          </div>
          <span className="font-semibold font-mono">
            -{formatMoney(data.purchasingPowerLoss, currency)} ({data.purchasingPowerLossPercent.toFixed(1)}%)
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-1">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Controllable Expense:</span>
          </div>
          <span className="font-medium font-mono">{formatMoney(data.controllableExpense, currency)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Real Margin:</span>
          <span
            className={cn(
              "font-medium font-mono",
              data.realMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {formatMoney(data.realMargin, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CpiInflationCard({
  statPoints = [],
  categories = [],
  activePreset,
  currency,
  onCurrencyChange,
  isLoading = false,
  error = null,
  onRetry,
}: CpiInflationCardProps) {
  const [chartView, setChartView] = useState<"area" | "line">("area");

  // Transform and chronological sort
  const timelineData = useMemo<MacroTimelinePoint[]>(() => {
    if (!statPoints.length) return [];

    const parsedList = statPoints
      .map((p) => {
        const parsed = parsePointDate(p);
        if (!parsed) return null;
        return { point: p, ...parsed };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Group by month to avoid duplicates
    const byMonth = new Map<string, (typeof parsedList)[0]>();
    for (const item of parsedList) {
      byMonth.set(item.dateStr.slice(0, 7), item);
    }

    const result: MacroTimelinePoint[] = [];

    byMonth.forEach((item, monthKey) => {
      const macro = getMacroData(monthKey);
      const transformed = transformExpenses({
        statCategories: item.point.categories,
        categories,
        activePreset,
      });

      const rawNominalIncomePln = transformed.netDisposableIncome;
      const rawControllableExpensePln = transformed.totalControllableExpense;
      const rawMarginPln = transformed.netCashFlowMargin;

      // Real value deflated in PLN
      const realIncomePln = calculateRealValue(rawNominalIncomePln, monthKey, BASE_CPI_MONTH);
      const realControllablePln = calculateRealValue(rawControllableExpensePln, monthKey, BASE_CPI_MONTH);

      // Convert to chosen currency
      const nominalIncome = convertCurrency(rawNominalIncomePln, "PLN", currency, monthKey);
      const realIncome = convertCurrency(realIncomePln, "PLN", currency, monthKey);
      const controllableExpense = convertCurrency(rawControllableExpensePln, "PLN", currency, monthKey);
      const realControllableExpense = convertCurrency(realControllablePln, "PLN", currency, monthKey);
      const nominalMargin = nominalIncome - controllableExpense;
      const realMargin = realIncome - realControllableExpense;

      const purchasingPowerLoss = Math.max(0, nominalIncome - realIncome);
      const purchasingPowerLossPercent = nominalIncome > 0 ? (purchasingPowerLoss / nominalIncome) * 100 : 0;
      const savingsRate = nominalIncome > 0 ? (nominalMargin / nominalIncome) * 100 : 0;

      const [year, monthNum] = monthKey.split("-");
      const shortYear = year.slice(2);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIndex = Number.parseInt(monthNum, 10) - 1;
      const monthLabel = `${monthNames[monthIndex] || monthNum} '${shortYear}`;

      result.push({
        dateStr: item.dateStr,
        monthKey,
        monthLabel,
        timestamp: item.timestamp,
        cpiIndex: macro.cpiIndex,
        cpiYoyPercent: macro.cpiYoyPercent,
        usdPlnRate: macro.usdPlnRate,
        rawNominalIncomePln,
        rawControllableExpensePln,
        rawMarginPln,
        nominalIncome,
        realIncome,
        purchasingPowerLoss,
        purchasingPowerLossPercent,
        controllableExpense,
        realControllableExpense,
        nominalMargin,
        realMargin,
        savingsRate,
      });
    });

    return result;
  }, [statPoints, categories, activePreset, currency]);

  // Key summary stats calculated from timeline
  const summaryStats = useMemo(() => {
    if (!timelineData.length) {
      return {
        latestErosionLoss: 0,
        latestErosionPct: 0,
        cumInflationSinceBase: 0,
        latestUsdPlnRate: 4.0,
      };
    }
    const latest = timelineData[timelineData.length - 1];
    const baseMacro = getMacroData(BASE_CPI_MONTH);
    const cumInflationSinceBase =
      baseMacro.cpiIndex > 0 ? ((latest.cpiIndex - baseMacro.cpiIndex) / baseMacro.cpiIndex) * 100 : 0;

    return {
      latestErosionLoss: latest.purchasingPowerLoss,
      latestErosionPct: latest.purchasingPowerLossPercent,
      cumInflationSinceBase,
      latestUsdPlnRate: latest.usdPlnRate,
    };
  }, [timelineData]);

  const currencyToggle = (
    <div className="flex items-center gap-1.5">
      <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
        <button
          type="button"
          onClick={() => onCurrencyChange?.("PLN")}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            currency === "PLN"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          PLN (zł)
        </button>
        <button
          type="button"
          onClick={() => onCurrencyChange?.("USD")}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            currency === "USD"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          USD ($)
        </button>
      </div>

      <div className="hidden sm:inline-flex rounded-md border bg-muted p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setChartView("area")}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors",
            chartView === "area"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Area
        </button>
        <button
          type="button"
          onClick={() => setChartView("line")}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors",
            chartView === "line"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Line
        </button>
      </div>
    </div>
  );

  return (
    <SectionShell
      title="CPI Inflation Erosion & Purchasing Power"
      description="Comparing nominal income with real purchasing power adjusted for cumulative Polish CPI (Base: Jan 2024 = 100)."
      action={currencyToggle}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!timelineData.length}
      emptyTitle="No historical data available"
      emptyDescription="Fetch historical ExternalProvider periods to render macro inflation analysis."
    >
      <div className="space-y-4">
        {/* Metric summary badges */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <span className="text-muted-foreground text-xs">Cumulative CPI Inflation</span>
            <div className="mt-1 flex items-baseline gap-1.5 font-bold font-mono text-lg text-destructive">
              +{summaryStats.cumInflationSinceBase.toFixed(1)}%
            </div>
            <span className="text-muted-foreground text-[10px]">Since Jan 2024 baseline</span>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <span className="text-muted-foreground text-xs">Purchasing Power Erosion</span>
            <div className="mt-1 flex items-baseline gap-1.5 font-bold font-mono text-lg text-destructive">
              -{formatMoney(summaryStats.latestErosionLoss, currency)}
            </div>
            <span className="text-muted-foreground text-[10px]">
              -{summaryStats.latestErosionPct.toFixed(1)}% of nominal income
            </span>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <span className="text-muted-foreground text-xs">Exchange Rate Context</span>
            <div className="mt-1 flex items-baseline gap-1.5 font-bold font-mono text-lg text-foreground">
              {summaryStats.latestUsdPlnRate.toFixed(2)} zł
            </div>
            <span className="text-muted-foreground text-[10px]">USD/PLN monthly average</span>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <span className="text-muted-foreground text-xs">Nominal Salary Regime</span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold text-sm text-foreground">
              <Badge variant="outline" className="font-normal text-xs">
                Flat 2024–2026
              </Badge>
            </div>
            <span className="text-muted-foreground text-[10px]">Erosion masks lifestyle savings</span>
          </div>
        </div>

        {/* Chart display */}
        <div className="h-72 w-full pt-2 sm:h-80">
          <ChartContainer config={chartConfig} className="h-full w-full">
            {chartView === "area" ? (
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nominalIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1, #2563eb)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-chart-1, #2563eb)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="realIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2, #10b981)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-chart-2, #10b981)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-[11px]" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  className="text-[11px]"
                />
                <ChartTooltip content={<CustomInflationTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="nominalIncome"
                  stroke="var(--color-chart-1, #2563eb)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#nominalIncomeGrad)"
                  name="Nominal Income"
                />
                <Area
                  type="monotone"
                  dataKey="realIncome"
                  stroke="var(--color-chart-2, #10b981)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#realIncomeGrad)"
                  name="Real Purchasing Power"
                />
                <Line
                  type="monotone"
                  dataKey="controllableExpense"
                  stroke="var(--color-chart-5, #f59e0b)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Controllable Expenses"
                />
              </AreaChart>
            ) : (
              <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} className="text-[11px]" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  className="text-[11px]"
                />
                <ChartTooltip content={<CustomInflationTooltip currency={currency} />} />
                <Line
                  type="monotone"
                  dataKey="nominalIncome"
                  stroke="var(--color-chart-1, #2563eb)"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  name="Nominal Income"
                />
                <Line
                  type="monotone"
                  dataKey="realIncome"
                  stroke="var(--color-chart-2, #10b981)"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  name="Real Purchasing Power"
                />
                <Line
                  type="monotone"
                  dataKey="controllableExpense"
                  stroke="var(--color-chart-5, #f59e0b)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Controllable Expenses"
                />
              </LineChart>
            )}
          </ChartContainer>
        </div>

        {/* Legend / explanation bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500" />
              <span>Nominal Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span>Real Purchasing Power (Jan 24 Base)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 border-b-2 border-dashed border-amber-500" />
              <span>Controllable Expenses</span>
            </div>
          </div>
          <span className="text-[11px]">
            {currency === "USD"
              ? "Converted to USD using monthly NBP historical rates"
              : "Deflated via Polish GUS CPI index"}
          </span>
        </div>
      </div>
    </SectionShell>
  );
}
