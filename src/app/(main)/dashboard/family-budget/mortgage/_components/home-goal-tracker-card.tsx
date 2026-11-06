"use client";

import { useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Link as LinkIcon,
  PiggyBank,
  RefreshCw,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { updateCategoriesOrder } from "@/app/(main)/dashboard/family-budget/_components/external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  formatMoney,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import {
  resolveCategoryCurrency,
  toFxRateToTarget,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { auditSavingsPace, computeHistoricalNetCashflowMargin } from "./mortgage-engine";
import type {
  HomeGoalTrackingConfig,
  LookbackWindow,
  OverlapTimelineConfig,
  PropertyAcquisitionSummary,
} from "./mortgage-types";

interface HomeGoalTrackerCardProps {
  config: HomeGoalTrackingConfig;
  propertySummary: PropertyAcquisitionSummary;
  overlapConfig: OverlapTimelineConfig;
  allCategories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  statPoints: StatPoint[];
  onChange: (updated: HomeGoalTrackingConfig) => void;
  onCategoriesUpdated?: (updated: ExternalProviderCategory[]) => void;
}

export function HomeGoalTrackerCard({
  config,
  propertySummary,
  overlapConfig,
  allCategories,
  currencies,
  statPoints,
  onChange,
  onCategoriesUpdated,
}: HomeGoalTrackerCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  // Available ExternalProvider Goal categories (CategoryType.Goal: 6, CategoryType.ClassicGoal: 4)
  const goalCategories = allCategories.filter(
    (c) =>
      !c.deleted &&
      (Number(c.categoryType) === CategoryType.Goal || Number(c.categoryType) === CategoryType.ClassicGoal),
  );

  // Compute live historical net cashflow margin from /stat/ping
  const historicalNetMarginPln = computeHistoricalNetCashflowMargin({
    statPoints,
    categories: allCategories,
    currencies,
    lookbackWindow: config.lookbackWindow,
    fallbackMarginPln: config.customMonthlyNetIncomeFallbackPln ?? 12000,
  });

  // Calculate savings velocity and milestone progress
  const audit = auditSavingsPace({
    upfrontCashMilestone1Pln: propertySummary.upfrontCashMilestone1Pln,
    upfrontCashMilestone2Pln: propertySummary.upfrontCashMilestone2Pln,
    monthsToSigning: overlapConfig.monthsToSigning,
    monthsToHandover: overlapConfig.monthsToSigning + overlapConfig.constructionWaitMonths,
    linkedGoalCategoryIds: config.linkedGoalCategoryIds,
    allCategories,
    currencies,
    historicalNetCashflowMarginPln: historicalNetMarginPln,
  });

  const updateConfig = (patch: Partial<HomeGoalTrackingConfig>) => {
    onChange({ ...config, ...patch });
  };

  const toggleGoal = (goalId: string) => {
    const set = new Set(config.linkedGoalCategoryIds);
    if (set.has(goalId)) {
      set.delete(goalId);
    } else {
      set.add(goalId);
    }
    updateConfig({ linkedGoalCategoryIds: Array.from(set) });
  };

  const handleSyncUpstream = async () => {
    if (config.linkedGoalCategoryIds.length === 0) {
      toast.error("Please select at least one linked ExternalProvider Goal to sync.");
      return;
    }

    const targetGoalId = config.linkedGoalCategoryIds[0];
    const targetCategory = allCategories.find((c) => c.id === targetGoalId);
    if (!targetCategory) {
      toast.error("Selected goal category could not be found.");
      return;
    }

    setIsSyncing(true);
    try {
      const updatedCategory: ExternalProviderCategory = {
        ...targetCategory,
        limitAmount: audit.milestone1TargetPln,
        periodizedLimitAmount: audit.milestone1RequiredMonthlyPacePln,
      };

      const updatedAll = allCategories.map((c) => (c.id === targetCategory.id ? updatedCategory : c));
      await updateCategoriesOrder([updatedCategory], {
        allUpdatedCategories: updatedAll,
      });

      if (onCategoriesUpdated) {
        onCategoriesUpdated(updatedAll);
      }

      toast.success(
        `Synced goal "${targetCategory.name}" to ${formatMoney(audit.milestone1TargetPln, "PLN")} (${formatMoney(audit.milestone1RequiredMonthlyPacePln, "PLN")}/mo)`,
      );
    } catch (err) {
      console.error("Failed to sync goal upstream:", err);
      toast.error(err instanceof Error ? err.message : "Failed to sync goal limits upstream");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">ExternalProvider Goal Tracker & Pace Audit</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {audit.paceStatus === "on_track" ? (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="mr-1 size-3.5" /> On Track (+{formatMoney(audit.monthlyDeltaPln, "PLN")}/mo)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="mr-1 size-3.5" /> Pace Shortfall ({formatMoney(audit.monthlyDeltaPln, "PLN")}
                /mo)
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSyncing || config.linkedGoalCategoryIds.length === 0}
              onClick={handleSyncUpstream}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Sync to ExternalProvider
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Link active ExternalProvider Goal categories, track two-milestone savings progress, audit against historical net
          cashflow margin, and sync upstream targets.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Linked Goal Picker */}
        <div className="border-border/50 bg-muted/20 space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground flex items-center gap-1.5 text-xs font-medium">
              <LinkIcon className="text-muted-foreground size-3.5" /> Linked ExternalProvider Savings Goals
            </Label>
            <span className="text-foreground text-xs font-semibold">
              Total Saved: {formatMoney(audit.accumulatedSavingsPln, "PLN")}
            </span>
          </div>

          {goalCategories.length === 0 ? (
            <p className="text-muted-foreground py-2 text-xs">
              No ExternalProvider Goal categories found. Create a Goal in ExternalProvider to link it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              {goalCategories.map((goal) => {
                const isLinked = config.linkedGoalCategoryIds.includes(goal.id);
                const rawBalance = goal.amount ?? goal.currentAmount ?? 0;
                const currency = resolveCategoryCurrency(goal, "PLN");
                const fxRate = toFxRateToTarget(currency, "PLN", currencies);
                const plnBalance = Math.round(rawBalance * fxRate);

                return (
                  <label
                    key={goal.id}
                    htmlFor={`goal-${goal.id}`}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition-colors ${
                      isLinked
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/40 bg-background/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox id={`goal-${goal.id}`} checked={isLinked} onCheckedChange={() => toggleGoal(goal.id)} />
                      <span className="text-foreground font-medium">{goal.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-semibold">{formatMoney(plnBalance, "PLN")}</span>
                      {currency !== "PLN" && (
                        <span className="text-muted-foreground text-[10px]">{formatMoney(rawBalance, currency)}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Two-Milestone Progress Bars */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Milestone 1: Signing */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <PiggyBank className="text-primary size-4" /> Milestone 1: Signing (*Umowa*)
              </span>
              <Badge variant="secondary" className="text-[11px] font-normal">
                {audit.milestone1ProgressPct}%
              </Badge>
            </div>

            <Progress value={audit.milestone1ProgressPct} className="h-2" />

            <div className="text-muted-foreground flex justify-between pt-1 text-[11px]">
              <span>Target: {formatMoney(audit.milestone1TargetPln, "PLN")}</span>
              <span>Gap: {formatMoney(audit.milestone1GapPln, "PLN")}</span>
            </div>

            <div className="border-border/40 bg-background/60 flex items-center justify-between rounded border p-2 text-xs">
              <span className="text-muted-foreground">Required Velocity:</span>
              <span className="text-primary font-semibold">
                {formatMoney(audit.milestone1RequiredMonthlyPacePln, "PLN")} / mo
              </span>
            </div>
          </div>

          {/* Milestone 2: Handover & Finishing */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="text-primary size-4" /> Milestone 2: Key Handover
              </span>
              <Badge variant="secondary" className="text-[11px] font-normal">
                {audit.totalProgressPct}%
              </Badge>
            </div>

            <Progress value={audit.totalProgressPct} className="h-2" />

            <div className="text-muted-foreground flex justify-between pt-1 text-[11px]">
              <span>Total Target: {formatMoney(audit.totalTargetPln, "PLN")}</span>
              <span>Total Gap: {formatMoney(audit.totalGapPln, "PLN")}</span>
            </div>

            <div className="border-border/40 bg-background/60 flex items-center justify-between rounded border p-2 text-xs">
              <span className="text-muted-foreground">Total Required Velocity:</span>
              <span className="text-foreground font-semibold">
                {formatMoney(audit.milestone2RequiredMonthlyPacePln, "PLN")} / mo
              </span>
            </div>
          </div>
        </div>

        {/* Historical Savings Pace Audit & Benchmark */}
        <div className="border-border/50 bg-muted/20 space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <History className="text-muted-foreground size-4" />
              <Label className="text-xs font-medium">Historical Cashflow Margin Audit</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">Lookback:</span>
              <Tabs
                value={config.lookbackWindow}
                onValueChange={(val) => updateConfig({ lookbackWindow: val as LookbackWindow })}
              >
                <TabsList className="h-6 text-[11px]">
                  <TabsTrigger value="3m" className="px-2 text-[11px]">
                    3m
                  </TabsTrigger>
                  <TabsTrigger value="6m" className="px-2 text-[11px]">
                    6m
                  </TabsTrigger>
                  <TabsTrigger value="12m" className="px-2 text-[11px]">
                    12m
                  </TabsTrigger>
                  <TabsTrigger value="all" className="px-2 text-[11px]">
                    All
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="border-border/40 bg-background/70 rounded border p-2">
              <span className="text-muted-foreground block text-[11px]">Required Monthly Pace</span>
              <span className="text-sm font-semibold">
                {formatMoney(audit.milestone1RequiredMonthlyPacePln, "PLN")}
              </span>
            </div>
            <div className="border-border/40 bg-background/70 rounded border p-2">
              <span className="text-muted-foreground block text-[11px]">
                Avg Net Cashflow ({config.lookbackWindow})
              </span>
              <span className="text-sm font-semibold">{formatMoney(audit.historicalNetCashflowMarginPln, "PLN")}</span>
            </div>
            <div className="border-border/40 bg-background/70 rounded border p-2">
              <span className="text-muted-foreground block text-[11px]">Monthly Net Margin Delta</span>
              <span
                className={`text-sm font-semibold ${audit.monthlyDeltaPln >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {audit.monthlyDeltaPln >= 0
                  ? `+${formatMoney(audit.monthlyDeltaPln, "PLN")}`
                  : formatMoney(audit.monthlyDeltaPln, "PLN")}
              </span>
            </div>
          </div>

          {audit.paceStatus === "shortfall" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <strong>Savings Pace Deficit: </strong>
                Your current average net monthly cashflow of {formatMoney(audit.historicalNetCashflowMarginPln, "PLN")}{" "}
                is below the required {formatMoney(audit.milestone1RequiredMonthlyPacePln, "PLN")}/month. At this rate,
                achieving Milestone 1 is projected to take an additional{" "}
                <strong>+{audit.projectedMilestone1DelayMonths} months</strong>.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
