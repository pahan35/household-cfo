"use client";

import { ArrowDownRight, ArrowUpRight, DollarSign, Receipt, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMoney } from "./external-provider-data";

interface BudgetMetricsStripProps {
  grossIncome: number;
  netDisposableIncome: number;
  totalControllableExpense: number;
  totalTaxDeductions: number;
  excludedExpenseSum: number;
  netCashFlowMargin: number;
  currency: string;
  isLoading?: boolean;
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
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(grossIncome, currency)}
            </span>
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
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(netDisposableIncome, currency)}
            </span>
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
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(totalControllableExpense, currency)}
            </span>
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
            <span
              className={`text-lg font-semibold tabular-nums ${
                isMarginPositive ? "text-emerald-500" : "text-destructive"
              }`}
            >
              {isMarginPositive ? "+" : ""}
              {formatMoney(netCashFlowMargin, currency)}
            </span>
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
