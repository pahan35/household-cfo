"use client";

import { ArrowLeftRight, Banknote, DollarSign, Receipt, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMoney } from "./external-provider-data";

export interface IncomeMetricsStripProps {
  grossIncome: number;
  totalTaxes: number;
  effectiveTaxRate?: number;
  netDisposableIncome: number;
  grossZus?: number;
  pfronCashback?: number;
  netZus?: number;
  pit?: number;
  fxFriction?: number;
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
  grossZus = 0,
  pfronCashback = 0,
  netZus,
  pit,
  fxFriction = 0,
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

  const resolvedNetZus = netZus ?? Math.max(0, grossZus - pfronCashback);
  const resolvedPit = pit ?? Math.max(0, totalTaxes - resolvedNetZus);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* 1. True Gross Inflow */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">True Gross Inflow</span>
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(grossIncome, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">Excl. PFRON & VAT</span>
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <DollarSign className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 2. USD FX Drag */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">USD FX Drag</span>
            <span className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {fxFriction > 0 ? `-${formatMoney(fxFriction, currency)}` : formatMoney(0, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">Trade spread & VAT drag</span>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
            <ArrowLeftRight className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Net ZUS */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Net ZUS</span>
            <span className="text-lg font-semibold tabular-nums text-purple-600 dark:text-purple-400">
              {resolvedNetZus > 0 ? `-${formatMoney(resolvedNetZus, currency)}` : formatMoney(0, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {pfronCashback > 0 ? `Net after -${formatMoney(pfronCashback, currency)} PFRON` : "Social Security"}
            </span>
          </div>
          <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500">
            <ShieldCheck className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 4. PIT (Personal Income Tax) */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">PIT & Health</span>
            <span className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {resolvedPit > 0 ? `-${formatMoney(resolvedPit, currency)}` : formatMoney(0, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {effectiveTaxRate !== undefined ? `${effectiveTaxRate.toFixed(1)}% eff. personal rate` : "Income tax"}
            </span>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
            <Receipt className="size-4" />
          </div>
        </CardContent>
      </Card>

      {/* 5. Net Disposable Income */}
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Net Disposable Income</span>
            <span className="text-foreground text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(netDisposableIncome, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">After taxes & FX friction</span>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
            <Banknote className="size-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
