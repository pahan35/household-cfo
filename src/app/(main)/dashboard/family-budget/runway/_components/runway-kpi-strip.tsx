"use client";

import { cn } from "cn";
import { CalendarDays, Flame, Hourglass, ShieldCheck, TrendingUp } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface RunwayKpiStripProps {
  usableCapitalPln: number;
  month1TaxTailPln: number;
  usableCapitalAfterTaxTailPln: number;
  ongoingMonthlyBurnPln: number;
  baselineOngoingMonthlyBurnPln: number;
  runwayMonths: number;
  baselineRunwayMonths: number;
  exhaustionDate: string | null;
  isCashflowPositive: boolean;
  residualIncomePln: number;
  isLoading?: boolean;
}

export function RunwayKpiStrip({
  usableCapitalPln,
  month1TaxTailPln,
  usableCapitalAfterTaxTailPln,
  ongoingMonthlyBurnPln,
  baselineOngoingMonthlyBurnPln,
  runwayMonths,
  baselineRunwayMonths,
  exhaustionDate,
  isCashflowPositive,
  isLoading = false,
}: RunwayKpiStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
          <Card key={i} className="border-border/60 shadow-xs">
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-44" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const austerityMonthlySavings = Math.max(0, baselineOngoingMonthlyBurnPln - ongoingMonthlyBurnPln);
  const runwayExtensionMonths = Math.max(0, runwayMonths - baselineRunwayMonths);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Usable Runway Capital */}
      <Card className="border-border/60 shadow-xs transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Usable Runway Capital</span>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatMoney(usableCapitalAfterTaxTailPln, "PLN")}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {month1TaxTailPln > 0 ? (
              <>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  -{formatMoney(month1TaxTailPln, "PLN")}
                </span>
                <span>tail deducted (from {formatMoney(usableCapitalPln, "PLN")})</span>
              </>
            ) : (
              <span>Full emergency capital pool ({formatMoney(usableCapitalPln, "PLN")})</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Post-Loss Monthly Burn */}
      <Card className="border-border/60 shadow-xs transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Post-Loss Monthly Burn</span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatMoney(ongoingMonthlyBurnPln, "PLN")}
            </span>
            <span className="text-xs text-muted-foreground">/ mo</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {austerityMonthlySavings > 5 ? (
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3" />-{formatMoney(austerityMonthlySavings, "PLN")}/mo saved
              </span>
            ) : (
              <span>JDG obligations + living expenses</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Projected Runway Months */}
      <Card className="border-border/60 shadow-xs transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Projected Runway</span>
            <Hourglass className="size-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {isCashflowPositive ? "60+ Months" : `${runwayMonths.toFixed(1)} Months`}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {runwayExtensionMonths >= 0.1 && !isCashflowPositive ? (
              <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                +{runwayExtensionMonths.toFixed(1)} mo via austerity
              </span>
            ) : (
              <span>{isCashflowPositive ? "Sustainable / cashflow positive" : "Until capital depletion"}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Projected Exhaustion Date */}
      <Card className="border-border/60 shadow-xs transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium tracking-wide uppercase">Exhaustion Horizon</span>
            <CalendarDays className="size-4 text-muted-foreground" />
          </div>
          <div
            className={cn(
              "mt-2 truncate text-2xl font-bold tracking-tight",
              isCashflowPositive ? "text-emerald-600 dark:text-emerald-400 text-xl" : "text-foreground",
            )}
          >
            {exhaustionDate ?? "Never / Sustainable"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isCashflowPositive ? "Residual income covers all expenses" : "Estimated capital exhaustion"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
