"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AccountsCard } from "./accounts-card";
import { BudgetMetricsStrip } from "./budget-metrics-strip";
import { type BudgetPeriodMonth, BudgetSummaryCard } from "./budget-summary-card";
import { getBudgetSelection, getCategories, getSettings, getTransactionPage } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  type StatPingData,
} from "./external-provider-data";
import { ExpensePieCard } from "./expense-pie-card";
import { transformExpenses } from "./expense-transforms";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { useExclusionPresets } from "./use-exclusion-presets";

export function FamilyBudgetDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [periodMonth, setPeriodMonth] = useState<BudgetPeriodMonth>("current");
  const [refreshKey, setRefreshKey] = useState(0);

  // Period-specific budget points and transactions for metrics calculation
  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [periodTransactions, setPeriodTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingPeriodData, setIsLoadingPeriodData] = useState(true);

  const presetController = useExclusionPresets(categories);

  const loadBaseData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [settingsRes, categoriesRes] = await Promise.allSettled([
        getSettings({ signal }),
        getCategories({ signal }),
      ]);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      }
    } catch {
      // Ignored: Individual sections handle their own error/retry states
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBaseData]);

  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

  const { fromDate, periodFilter } = useMemo(() => {
    const now = new Date();
    if (periodMonth === "previous") {
      const target = subMonths(now, 1);
      const from = format(startOfMonth(target), "yyyy-MM-dd");
      const to = format(endOfMonth(target), "yyyy-MM-dd");
      return { fromDate: from, periodFilter: { from, to } };
    }
    const from = format(startOfMonth(now), "yyyy-MM-dd");
    const to = format(endOfMonth(now), "yyyy-MM-dd");
    return { fromDate: from, periodFilter: { from, to } };
  }, [periodMonth]);

  // Load period stats and income transactions whenever period or refreshKey changes
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingPeriodData(true);

    async function loadPeriodData() {
      try {
        const [statRes, txRes] = await Promise.allSettled([
          getBudgetSelection({ from: fromDate, signal: controller.signal }),
          getTransactionPage({ period: periodFilter, take: 100, signal: controller.signal }),
        ]);

        if (statRes.status === "fulfilled") {
          setStatData(statRes.value);
        }
        if (txRes.status === "fulfilled") {
          setPeriodTransactions(txRes.value.transactions ?? []);
        }
      } catch {
        // Individual cards show appropriate fallback/empty states
      } finally {
        setIsLoadingPeriodData(false);
      }
    }

    void loadPeriodData();

    return () => {
      controller.abort();
    };
  }, [fromDate, periodFilter]);

  // Calculate gross income for the active period from income transactions
  const grossIncome = useMemo(() => {
    return periodTransactions.reduce((acc, tx) => {
      const src = Number(tx.sourceType);
      if (src === CategoryType.Income) {
        const amt = Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0;
        return acc + amt;
      }
      return acc;
    }, 0);
  }, [periodTransactions]);

  // Extract statCategories for the active point
  const statCategories = useMemo(() => {
    const points = statData?.selection?.points ?? [];
    if (points.length === 0) return [];
    const activePoint = points.find((p) => p.id === fromDate) ?? points[points.length - 1];
    return activePoint?.categories ?? [];
  }, [statData, fromDate]);

  // Calculate adjusted metrics reflecting the active exclusion preset
  const transformed = useMemo(() => {
    return transformExpenses({
      statCategories,
      categories,
      activePreset: presetController.activePreset,
      rawGrossIncome: grossIncome,
    });
  }, [statCategories, categories, presetController.activePreset, grossIncome]);

  function handleRefreshAll() {
    setRefreshKey((k) => k + 1);
    void loadBaseData();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-normal">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Live External API Data
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs font-medium">Default: {defaultCurrency}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                periodMonth === "current"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPeriodMonth("current")}
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
              onClick={() => setPeriodMonth("previous")}
            >
              Previous Month
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={handleRefreshAll} className="gap-1.5 text-xs">
            <RotateCw className="size-3.5" />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Net Disposable Income & Controllable Expenses Metrics */}
      <BudgetMetricsStrip
        grossIncome={transformed.grossIncome}
        netDisposableIncome={transformed.netDisposableIncome}
        totalControllableExpense={transformed.totalControllableExpense}
        totalTaxDeductions={transformed.totalTaxDeductions}
        excludedExpenseSum={transformed.excludedExpenseSum}
        netCashFlowMargin={transformed.netCashFlowMargin}
        currency={defaultCurrency}
        isLoading={isLoadingPeriodData}
      />

      {/* Overview Grid: Accounts & Controllable Expense Pie Card */}
      <div key={`overview-grid-${refreshKey}`} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <AccountsCard currency={defaultCurrency} />
        </div>
        <div className="xl:col-span-7">
          <ExpensePieCard
            statCategories={statCategories}
            categories={categories}
            defaultCurrency={defaultCurrency}
            rawGrossIncome={grossIncome}
            isLoading={isLoadingPeriodData}
            presetController={presetController}
          />
        </div>
      </div>

      {/* Detailed Budget Limits and Spending */}
      <div key={`budget-grid-${refreshKey}`} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <BudgetSummaryCard
            categories={categories}
            defaultCurrency={defaultCurrency}
            periodMonth={periodMonth}
            onPeriodMonthChange={setPeriodMonth}
          />
        </div>
      </div>

      {/* Transactions Feed */}
      <div key={`tx-grid-${refreshKey}`} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <RecentTransactionsCard defaultCurrency={defaultCurrency} periodFilter={periodFilter} />
        </div>
      </div>
    </div>
  );
}
