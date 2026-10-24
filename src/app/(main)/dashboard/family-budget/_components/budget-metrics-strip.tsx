"use client";

import { cn } from "cn";
import { ArrowDownRight, ArrowUpRight, DollarSign, Receipt, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMoney } from "./external-provider-data";
import type { MetricDelta, PeriodComparisonResult } from "./expense-transforms";

interface BudgetMetricsStripProps {
  grossIncome: number;
  netDisposableIncome: number;
  totalControllableExpense: number;
  totalTaxDeductions: number;
  excludedExpenseSum: number;
  netCashFlowMargin: number;
  currency: string;
  isLoading?: boolean;
  comparison?: PeriodComparisonResult | null;
}

function MetricDeltaBadge({
  delta,
  currency,
  invertFavorable = false,
}: {
  delta?: MetricDelta;
  currency: string;
  invertFavorable?: boolean;
}) {
  if (!delta || delta.deltaAbs === 0) return null;
  const isPositive = delta.deltaAbs > 0;
  const isFavorable = invertFavorable ? !isPositive : isPositive;

  const sign = isPositive ? "+" : "";
  const pctStr =
    delta.deltaPercent !== null ? ` (${delta.deltaPercent >= 0 ? "+" : ""}${delta.deltaPercent.toFixed(0)}%)` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        isFavorable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
      )}
    >
      {sign}
      {formatMoney(delta.deltaAbs, currency)}
      {pctStr}
    </span>
  );
}

export function BudgetMetricsStrip({
  grossIncome,
  netDisposableIncome,
  totalControllableExpense,
  totalTaxDeductions,
  excludedExpenseSum,
  netCashFlowMargin,
  currency,
  isLoading = false,
  comparison = null,
}: BudgetMetricsStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["m-1", "m-2", "m-3", "m-4"].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const isMarginPositive = netCashFlowMargin >= 0;
  const savingsRate = netDisposableIncome > 0 ? Math.round((netCashFlowMargin / netDisposableIncome) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Gross Income Card */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Gross Income</span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {formatMoney(grossIncome, currency)}
              </span>
              <MetricDeltaBadge delta={comparison?.grossIncome} currency={currency} />
            </div>
            <span className="text-muted-foreground text-[11px]">Period recorded receipts</span>
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <DollarSign className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* Net Disposable Income Card */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Net Disposable Income</span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {formatMoney(netDisposableIncome, currency)}
              </span>
              <MetricDeltaBadge delta={comparison?.netDisposableIncome} currency={currency} />
            </div>
            <span className="text-muted-foreground text-[11px]">
              {totalTaxDeductions > 0
                ? `Taxes deducted: -${formatMoney(totalTaxDeductions, currency)}`
                : "No tax deduction applied"}
            </span>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
            <Receipt className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* Controllable Expenses Card */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Controllable Expenses</span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {formatMoney(totalControllableExpense, currency)}
              </span>
              <MetricDeltaBadge
                delta={comparison?.totalControllableExpense}
                currency={currency}
                invertFavorable={true}
              />
            </div>
            <span className="text-muted-foreground text-[11px]">
              {excludedExpenseSum > 0
                ? `Fixed omitted: -${formatMoney(excludedExpenseSum, currency)}`
                : "All expenses included"}
            </span>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
            <ShieldCheck className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* Net Cash Flow Margin Card */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Net Cash Margin</span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className={`text-lg font-semibold tabular-nums ${
                  isMarginPositive ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {isMarginPositive ? "+" : ""}
                {formatMoney(netCashFlowMargin, currency)}
              </span>
              <MetricDeltaBadge delta={comparison?.netCashFlowMargin} currency={currency} />
            </div>
            <span className="text-muted-foreground text-[11px]">
              {netDisposableIncome > 0 ? `${savingsRate}% net savings rate` : "Net cash margin after living expenses"}
            </span>
          </div>
          <div
            className={`rounded-lg p-2 ${
              isMarginPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
            }`}
          >
            {isMarginPositive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
