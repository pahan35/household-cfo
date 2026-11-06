"use client";

import { useMemo } from "react";

import { ArrowDownRight, ArrowUpRight, Gauge, Sliders } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { calculateBudgetImpact } from "./mortgage-engine";
import type {
  AmortizationSummary,
  HomeGoalTrackingConfig,
  MortgageFinancingConfig,
  OverlapTimelineConfig,
  PropertyAcquisitionSummary,
} from "./mortgage-types";

interface BudgetImpactCardProps {
  propertySummary: PropertyAcquisitionSummary;
  amortization: AmortizationSummary;
  overlapConfig: OverlapTimelineConfig;
  financing: MortgageFinancingConfig;
  goalTracking: HomeGoalTrackingConfig;
  onGoalTrackingChange: (updated: HomeGoalTrackingConfig) => void;
}

export function BudgetImpactCard({
  propertySummary,
  amortization,
  overlapConfig,
  financing,
  goalTracking,
  onGoalTrackingChange,
}: BudgetImpactCardProps) {
  const householdIncome = goalTracking.customMonthlyNetIncomeFallbackPln ?? 18000;

  const impact = useMemo(() => {
    return calculateBudgetImpact({
      amortization,
      overlapConfig,
      financing,
      propertySummary,
      householdNetIncomePln: householdIncome,
    });
  }, [amortization, overlapConfig, financing, propertySummary, householdIncome]);

  const updateIncome = (val: number) => {
    onGoalTrackingChange({
      ...goalTracking,
      customMonthlyNetIncomeFallbackPln: Math.max(1, val),
    });
  };

  const getDtiBadge = (dtiPct: number) => {
    if (dtiPct <= 30) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
        >
          Healthy (&lt;30%)
        </Badge>
      );
    }
    if (dtiPct <= 40) {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
        >
          Moderate (30-40%)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
        Stretched (&gt;40%)
      </Badge>
    );
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Post-Move-in Budget Impact & Rate Stress</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getDtiBadge(impact.newHousingDtiPct)}
            <Badge variant="secondary" className="text-xs font-normal">
              New Housing DTI: <strong>{impact.newHousingDtiPct}%</strong>
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Evaluate steady-state monthly cashflow when current rent is replaced by mortgage + community admin fee, and
          stress-test rate fluctuations under KNF guidelines.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Pre- vs Post-Move-in Cashflow Comparison */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Current Housing */}
          <div className="border-border/50 bg-muted/10 space-y-1.5 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs font-medium">1. Current Rental Housing</span>
            <div className="text-foreground text-lg font-bold">
              {formatMoney(impact.currentMonthlyRentPln, "PLN")}
              <span className="text-muted-foreground text-xs font-normal">/mo</span>
            </div>
            <div className="text-muted-foreground border-border/30 flex justify-between border-t pt-1 text-[11px]">
              <span>Rental DTI:</span>
              <span className="text-foreground font-semibold">{impact.currentHousingDtiPct}%</span>
            </div>
          </div>

          {/* New Housing */}
          <div className="border-border/50 bg-muted/20 space-y-1.5 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs font-medium">2. New Home (Mortgage + Admin)</span>
            <div className="text-primary text-lg font-bold">
              {formatMoney(impact.newMonthlyHousingCostPln, "PLN")}
              <span className="text-muted-foreground text-xs font-normal">/mo</span>
            </div>
            <div className="text-muted-foreground border-border/30 space-y-0.5 border-t pt-1 text-[11px]">
              <div className="flex justify-between">
                <span>Mortgage:</span>
                <span>{formatMoney(impact.newMortgageInstallmentPln, "PLN")}</span>
              </div>
              <div className="flex justify-between">
                <span>Admin Fee:</span>
                <span>{formatMoney(impact.newCommunityAdminFeePln, "PLN")}</span>
              </div>
            </div>
          </div>

          {/* Monthly Delta */}
          <div className="border-border/50 bg-muted/10 space-y-1.5 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs font-medium">3. Net Monthly Cashflow Delta</span>
            <div
              className={`flex items-center gap-1 text-lg font-bold ${impact.monthlyCashflowDeltaPln > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {impact.monthlyCashflowDeltaPln > 0 ? (
                <>
                  <ArrowUpRight className="size-4" /> +{formatMoney(impact.monthlyCashflowDeltaPln, "PLN")}
                </>
              ) : (
                <>
                  <ArrowDownRight className="size-4" /> {formatMoney(impact.monthlyCashflowDeltaPln, "PLN")}
                </>
              )}
              <span className="text-muted-foreground text-xs font-normal">/mo</span>
            </div>
            <p className="text-muted-foreground border-border/30 border-t pt-1 text-[11px]">
              {impact.monthlyCashflowDeltaPln > 0
                ? "New housing costs exceed current rent. Monthly savings capacity decreases by this amount."
                : "New housing costs are lower than current rent. Frees up additional monthly cashflow."}
            </p>
          </div>
        </div>

        {/* Household Net Income Input */}
        <div className="border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="householdIncome" className="text-foreground text-xs font-medium">
              Household Monthly Net Disposable Income (PLN)
            </Label>
            <p className="text-muted-foreground text-[11px]">
              Used to calculate Debt-to-Income (DTI %) stress ratios under KNF credit guidelines.
            </p>
          </div>
          <div className="w-36">
            <Input
              id="householdIncome"
              type="number"
              step="500"
              value={householdIncome || ""}
              onChange={(e) => updateIncome(Number(e.target.value) || 0)}
              className="h-8 text-right text-sm"
            />
          </div>
        </div>

        {/* Interest Rate Stress Slider & KNF Simulation */}
        <div className="border-border/50 bg-muted/10 space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="text-muted-foreground size-4" />
              <Label className="text-xs font-medium">Interest Rate Stress Test (KNF Recommendation S)</Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                Stressed Rate: {(amortization.effectiveRatePct + 2.0).toFixed(2)}% (+2.00%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="border-border/40 bg-background/60 space-y-1 rounded border p-2.5">
              <span className="text-muted-foreground block text-[11px]">Base Case Installment</span>
              <span className="text-foreground text-base font-bold">
                {formatMoney(impact.newMortgageInstallmentPln, "PLN")}
              </span>
              <span className="text-muted-foreground block text-[11px]">DTI: {impact.newHousingDtiPct}%</span>
            </div>

            <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-2.5">
              <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
                +2.0% Rate Hike Stress Installment
              </span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                {formatMoney(impact.stressedInstallmentPln, "PLN")}
              </span>
              <span className="text-muted-foreground block text-[11px]">
                Stressed DTI: {impact.stressedHousingDtiPct}% ({getDtiBadge(impact.stressedHousingDtiPct)})
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
