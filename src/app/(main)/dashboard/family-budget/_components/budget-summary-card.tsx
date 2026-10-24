"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { format, startOfMonth, subMonths } from "date-fns";
import { AlertTriangle, PiggyBank } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { getBudgetSelection } from "./external-provider-client";
import { type ExternalProviderCategory, formatMoney, type StatCategoryPoint, type StatPingData } from "./external-provider-data";
import { SectionShell } from "./section-shell";

export type BudgetPeriodMonth = "current" | "previous";

interface BudgetSummaryCardProps {
  categories?: ExternalProviderCategory[];
  defaultCurrency?: string;
  periodMonth?: BudgetPeriodMonth;
  onPeriodMonthChange?: (period: BudgetPeriodMonth) => void;
  customFromDate?: string | null;
  onClearCustomPeriod?: () => void;
}

export function BudgetSummaryCard({
  categories = [],
  defaultCurrency = "PLN",
  periodMonth: controlledPeriod,
  onPeriodMonthChange,
  customFromDate,
  onClearCustomPeriod,
}: BudgetSummaryCardProps) {
  const [internalPeriod, setInternalPeriod] = useState<BudgetPeriodMonth>("current");
  const periodMonth = controlledPeriod ?? internalPeriod;

  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fromDate = useMemo(() => {
    if (customFromDate) {
      return customFromDate;
    }
    const now = new Date();
    if (periodMonth === "previous") {
      return format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    }
    return format(startOfMonth(now), "yyyy-MM-dd");
  }, [periodMonth, customFromDate]);

  const fetchBudget = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getBudgetSelection({ from: fromDate, signal });
        setStatData(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err : new Error("Failed to load budget data"));
      } finally {
        setIsLoading(false);
      }
    },
    [fromDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchBudget(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchBudget]);

  function handlePeriodSwitch(target: BudgetPeriodMonth) {
    onClearCustomPeriod?.();
    if (onPeriodMonthChange) {
      onPeriodMonthChange(target);
    } else {
      setInternalPeriod(target);
    }
  }

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const currency = statData?.selection?.params?.currency ?? defaultCurrency;

  const budgetItems = useMemo(() => {
    const points = statData?.selection?.points ?? [];
    if (points.length === 0) return [];

    // Find point closest to selected month fromDate or default to latest point
    const activePoint = points.find((p) => p.id === fromDate) ?? points[points.length - 1];

    if (!activePoint?.categories) return [];

    return activePoint.categories
      .filter((cat: StatCategoryPoint) => {
        const limit = Number(cat.limitAmount) || 0;
        const current = Number(cat.currentAmount) || 0;
        return limit > 0 || current > 0;
      })
      .map((cat: StatCategoryPoint) => {
        const limit = Number(cat.limitAmount) || 0;
        const current = Number(cat.currentAmount) || 0;
        const categoryName = typeof cat.name === "string" ? cat.name : undefined;
        const name = categoryName ?? categoryNameMap.get(cat.id) ?? "Category";
        let percent = 0;
        if (limit > 0) {
          percent = Math.round((current / limit) * 100);
        } else if (current > 0) {
          percent = 100;
        }
        const isOverrun = limit > 0 && current > limit;
        return {
          id: cat.id,
          name,
          limit,
          current,
          percent: Math.min(100, percent),
          rawPercent: percent,
          isOverrun,
        };
      })
      .sort((a, b) => b.rawPercent - a.rawPercent);
  }, [statData, fromDate, categoryNameMap]);

  return (
    <SectionShell
      title="Budget Spent vs Limit"
      description={`Reporting currency: ${currency}`}
      action={
        <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              periodMonth === "current"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handlePeriodSwitch("current")}
          >
            Current Month
          </button>
          <button
            type="button"
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              periodMonth === "previous"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handlePeriodSwitch("previous")}
          >
            Previous Month
          </button>
        </div>
      }
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void fetchBudget();
      }}
      isEmpty={budgetItems.length === 0}
      emptyTitle="No budget limits defined"
      emptyDescription="No categories with active budget limits or spending found for this period."
      emptyIcon={<PiggyBank className="text-muted-foreground size-6" />}
      skeletonCount={4}
      skeletonHeight="h-14"
    >
      <div className="flex flex-col gap-4">
        {budgetItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <span>{item.name}</span>
                {item.isOverrun && (
                  <Badge variant="destructive" className="h-4 gap-1 px-1 text-[10px] font-normal">
                    <AlertTriangle className="size-2.5" />
                    Overrun
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground flex items-center gap-1">
                <span className={item.isOverrun ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                  {formatMoney(item.current, currency)}
                </span>
                <span>/</span>
                <span>{formatMoney(item.limit, currency)}</span>
                <span className="ml-1 text-[11px]">({item.rawPercent}%)</span>
              </div>
            </div>
            <Progress value={item.percent} className={cn("h-2", item.isOverrun && "[&>div]:bg-destructive")} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
