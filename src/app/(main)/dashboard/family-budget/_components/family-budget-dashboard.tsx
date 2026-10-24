"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { endOfMonth, format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";
import { RotateCw, X } from "lucide-react";

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
import { MONTH_LABELS } from "./yoy-transforms";
import { type SelectedPeriod, YoYTrendsCard } from "./yoy-trends-card";

export function FamilyBudgetDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [baseDataError, setBaseDataError] = useState<Error | null>(null);

  const [periodMonth, setPeriodMonth] = useState<BudgetPeriodMonth>("current");
  const [selectedHistoricalPeriod, setSelectedHistoricalPeriod] = useState<SelectedPeriod | null>(null);

  // Period-specific budget points and transactions for metrics calculation
  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [isLoadingStatData, setIsLoadingStatData] = useState(true);
  const [statDataError, setStatDataError] = useState<Error | null>(null);

  const [periodTransactions, setPeriodTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [txHasMoreData, setTxHasMoreData] = useState(false);
  const [isLoadingPeriodTx, setIsLoadingPeriodTx] = useState(true);
  const [periodTxError, setPeriodTxError] = useState<Error | null>(null);

  const presetController = useExclusionPresets(categories);

  // Anchor 40-month statistics series once at current day so active month is included in Before: 40 window
  const currentMonthAnchor = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const loadBaseData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoadingBaseData(true);
    setBaseDataError(null);
    try {
      const [settingsRes, categoriesRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
      ]);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      } else if (!signal?.aborted) {
        setBaseDataError(
          settingsRes.reason instanceof Error ? settingsRes.reason : new Error("Failed to load settings"),
        );
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      } else if (!signal?.aborted && settingsRes.status === "fulfilled") {
        setBaseDataError(
          categoriesRes.reason instanceof Error ? categoriesRes.reason : new Error("Failed to load categories"),
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setBaseDataError(err instanceof Error ? err : new Error("Failed to load base data"));
    } finally {
      setIsLoadingBaseData(false);
    }
  }, []);

  const loadStatData = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setIsLoadingStatData(true);
      setStatDataError(null);
      try {
        const data = await getBudgetSelection({
          from: currentMonthAnchor,
          signal,
          forceRefresh,
        });
        setStatData(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatDataError(err instanceof Error ? err : new Error("Failed to load budget statistics"));
      } finally {
        setIsLoadingStatData(false);
      }
    },
    [currentMonthAnchor],
  );

  const { fromDate, periodFilter } = useMemo(() => {
    if (selectedHistoricalPeriod) {
      const parsed = parseISO(selectedHistoricalPeriod.dateStr);
      const target = isValid(parsed) ? parsed : new Date(selectedHistoricalPeriod.dateStr);
      const from = format(startOfMonth(target), "yyyy-MM-dd");
      const to = format(endOfMonth(target), "yyyy-MM-dd");
      return { fromDate: from, periodFilter: { from, to } };
    }
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
  }, [periodMonth, selectedHistoricalPeriod]);

  const loadPeriodTransactions = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setIsLoadingPeriodTx(true);
      setPeriodTxError(null);
      try {
        const res = await getTransactionPage({
          period: periodFilter,
          take: 100,
          signal,
          forceRefresh,
        });
        setPeriodTransactions(res.transactions ?? []);
        setTxHasMoreData(Boolean(res.hasMoreData));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setPeriodTxError(err instanceof Error ? err : new Error("Failed to load transactions"));
      } finally {
        setIsLoadingPeriodTx(false);
      }
    },
    [periodFilter],
  );

  // Initial mount load for base data and 40-month statistics series
  useEffect(() => {
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    void loadStatData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBaseData, loadStatData]);

  // Load period transactions when active period filter changes
  useEffect(() => {
    const controller = new AbortController();
    void loadPeriodTransactions(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadPeriodTransactions]);

  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

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

  // Extract statCategories for the active point from the 40-month series in memory
  const statCategories = useMemo(() => {
    const points = statData?.selection?.points ?? [];
    if (points.length === 0) return [];
    const activePoint = points.find((p) => p.id === fromDate) ?? points[0];
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

  const isLoadingPeriodData = isLoadingStatData || isLoadingPeriodTx;
  const isRefreshing = isLoadingBaseData || isLoadingStatData || isLoadingPeriodTx;

  function handleRefreshAll() {
    void loadBaseData(undefined, true);
    void loadStatData(undefined, true);
    void loadPeriodTransactions(undefined, true);
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
                !selectedHistoricalPeriod && periodMonth === "current"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setSelectedHistoricalPeriod(null);
                setPeriodMonth("current");
              }}
            >
              Current Month
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !selectedHistoricalPeriod && periodMonth === "previous"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setSelectedHistoricalPeriod(null);
                setPeriodMonth("previous");
              }}
            >
              Previous Month
            </button>
            {selectedHistoricalPeriod && (
              <span className="bg-background text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs">
                <span>
                  {MONTH_LABELS[selectedHistoricalPeriod.monthIndex]} {selectedHistoricalPeriod.year}
                </span>
                <button
                  type="button"
                  aria-label="Clear historical focus"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setSelectedHistoricalPeriod(null)}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={handleRefreshAll} className="gap-1.5 text-xs">
            <RotateCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <AccountsCard
            categories={categories}
            currency={defaultCurrency}
            isLoading={isLoadingBaseData}
            error={baseDataError}
            onRetry={() => void loadBaseData(undefined, true)}
          />
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

      {/* Year-over-Year Historical Trends */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <YoYTrendsCard
            statPoints={statData?.selection?.points ?? []}
            categories={categories}
            defaultCurrency={defaultCurrency}
            activePreset={presetController.activePreset}
            isLoading={isLoadingStatData}
            selectedPeriod={selectedHistoricalPeriod}
            onSelectPeriod={(period) => {
              setSelectedHistoricalPeriod(period);
            }}
          />
        </div>
      </div>

      {/* Detailed Budget Limits and Spending */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <BudgetSummaryCard
            categories={categories}
            defaultCurrency={defaultCurrency}
            periodMonth={periodMonth}
            onPeriodMonthChange={setPeriodMonth}
            customFromDate={selectedHistoricalPeriod?.dateStr}
            onClearCustomPeriod={() => setSelectedHistoricalPeriod(null)}
            statData={statData}
            isLoading={isLoadingStatData}
            error={statDataError}
            onRetry={() => void loadStatData(undefined, true)}
          />
        </div>
      </div>

      {/* Transactions Feed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <RecentTransactionsCard
            defaultCurrency={defaultCurrency}
            periodFilter={periodFilter}
            initialTransactions={periodTransactions}
            initialHasMoreData={txHasMoreData}
            isLoading={isLoadingPeriodTx}
            error={periodTxError}
            onRetry={() => void loadPeriodTransactions(undefined, true)}
          />
        </div>
      </div>
    </div>
  );
}
