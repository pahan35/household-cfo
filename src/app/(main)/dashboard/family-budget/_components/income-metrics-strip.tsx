"use client";

import { Banknote, DollarSign, Percent, Receipt, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMoney } from "./external-provider-data";

export interface IncomeMetricsStripProps {
  grossIncome: number;
  totalTaxes: number;
  effectiveTaxRate: number;
  netDisposableIncome: number;
  controllableExpenses?: number;
  coverageRatio?: number;
  netSurplus?: number;
  currency: string;
  isLoading?: boolean;
}

export function IncomeMetricsStrip({
  grossIncome,
  totalTaxes,
  effectiveTaxRate,
  netDisposableIncome,
  controllableExpenses = 0,
  coverageRatio = 0,
  netSurplus = 0,
  currency,
  isLoading = false,
}: IncomeMetricsStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {["m-1", "m-2", "m-3", "m-4", "m-5"].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const isCoverageHealthy = coverageRatio >= 100;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* 1. Gross Income */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Gross Income</span>
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(grossIncome, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">Total period cash inflow</span>
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <DollarSign className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Taxes Deducted */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Taxes Deducted</span>
            <span className="text-foreground text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {totalTaxes > 0 ? `-${formatMoney(totalTaxes, currency)}` : formatMoney(0, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">PIT, ZUS, VAT, Health</span>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
            <Receipt className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Effective Tax Rate */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Effective Tax Rate</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground text-lg font-semibold tabular-nums">{effectiveTaxRate.toFixed(1)}%</span>
              <span className="text-muted-foreground text-xs">of gross</span>
            </div>
            <span className="text-muted-foreground text-[11px]">Tax drag on revenue</span>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
            <Percent className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Net Disposable Income */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Net Disposable Income</span>
            <span className="text-foreground text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(netDisposableIncome, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">Gross minus all taxes</span>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
            <Banknote className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 5. Expense Coverage Ratio */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs font-normal">Expense Coverage</span>
              {controllableExpenses > 0 && (
                <Badge
                  variant={isCoverageHealthy ? "outline" : "destructive"}
                  className="px-1 py-0 text-[10px] font-normal"
                >
                  {isCoverageHealthy ? "Healthy" : "Deficit"}
                </Badge>
              )}
            </div>
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {controllableExpenses > 0 ? `${Math.round(coverageRatio)}%` : "N/A"}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {controllableExpenses > 0
                ? `Surplus: ${netSurplus >= 0 ? "+" : ""}${formatMoney(netSurplus, currency)}`
                : "No controllable expenses"}
            </span>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
            <ShieldCheck className="size-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
