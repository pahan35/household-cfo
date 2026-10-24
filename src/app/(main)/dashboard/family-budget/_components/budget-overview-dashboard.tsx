"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { BudgetMetricsStrip } from "./budget-metrics-strip";
import { BudgetSummaryCard } from "./budget-summary-card";
import {
  getBudgetSelection,
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
  updateCategoriesOrder,
} from "./external-provider-client";
import {
  buildLastTransactionMap,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  reorderCategoriesSubset,
  type StatPingData,
} from "./external-provider-data";
import { ExpensePieCard } from "./expense-pie-card";
import { type CompareMode, computePeriodComparison, transformExpenses } from "./expense-transforms";
import { MonthPeriodPicker } from "./month-period-picker";
import { useExclusionPresets } from "./use-exclusion-presets";
import { extractAvailableMonths, parsePointDate, resolveBaselineMonth } from "./yoy-transforms";
import { type SelectedPeriod, YoYTrendsCard } from "./yoy-trends-card";

export function BudgetOverviewDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [baseDataError, setBaseDataError] = useState<Error | null>(null);

  // Single unified period state across the entire Budget Overview dashboard
  const [activeMonthDateStr, setActiveMonthDateStr] = useState<string>(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [compareCustomDateStr, setCompareCustomDateStr] = useState<string | null>(null);

  // Period-specific budget points and transactions for metrics calculation
  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [isLoadingStatData, setIsLoadingStatData] = useState(true);
  const [statDataError, setStatDataError] = useState<Error | null>(null);

  const [periodTransactions, setPeriodTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingPeriodTx, setIsLoadingPeriodTx] = useState(true);
  const [, setPeriodTxError] = useState<Error | null>(null);

  const presetController = useExclusionPresets(categories);

  // Available months derived from cached statistics points
  const availableMonths = useMemo(() => {
    return extractAvailableMonths(statData?.selection?.points ?? []);
  }, [statData]);

  // Baseline month resolution based on comparison mode
  const baselineResolution = useMemo(() => {
    return resolveBaselineMonth(activeMonthDateStr, compareMode, availableMonths, compareCustomDateStr);
  }, [activeMonthDateStr, compareMode, availableMonths, compareCustomDateStr]);

  // Anchor 40-month statistics series once at current day so active month is included in Before: 40 window
  const currentMonthAnchor = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const loadBaseData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoadingBaseData(true);
    setBaseDataError(null);
    try {
      const [settingsRes, categoriesRes, currenciesRes, recentTxRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
        getCurrencies({ signal, forceRefresh }),
        getTransactionPage({ skip: 0, take: 300, signal, forceRefresh }),
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
      if (currenciesRes.status === "fulfilled") {
        setCurrencies(currenciesRes.value);
      }
      if (recentTxRes.status === "fulfilled") {
        setRecentTransactions(recentTxRes.value.transactions ?? []);
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
    const parsed = parseISO(activeMonthDateStr);
    const target = isValid(parsed) ? parsed : new Date(activeMonthDateStr);
    const from = format(startOfMonth(target), "yyyy-MM-dd");
    const to = format(endOfMonth(target), "yyyy-MM-dd");
    return { fromDate: from, periodFilter: { from, to } };
  }, [activeMonthDateStr]);

  const selectedHistoricalPeriod: SelectedPeriod | null = useMemo(() => {
    const parsed = parseISO(activeMonthDateStr);
    if (!isValid(parsed)) return null;
    return {
      year: parsed.getFullYear(),
      monthIndex: parsed.getMonth(),
      dateStr: activeMonthDateStr,
    };
  }, [activeMonthDateStr]);

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
    const activePoint = points.find((p) => p.id === fromDate || parsePointDate(p)?.dateStr === fromDate) ?? points[0];
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

  // Extract statCategories for baseline comparison point from memory
  const baselineStatCategories = useMemo(() => {
    if (!baselineResolution?.hasData || !baselineResolution.dateStr) return [];
    const points = statData?.selection?.points ?? [];
    const pt = points.find(
      (p) => p.id === baselineResolution.dateStr || parsePointDate(p)?.dateStr === baselineResolution.dateStr,
    );
    return pt?.categories ?? [];
  }, [statData, baselineResolution]);

  const baselineTransformed = useMemo(() => {
    if (!baselineResolution?.hasData) return null;
    return transformExpenses({
      statCategories: baselineStatCategories,
      categories,
      activePreset: presetController.activePreset,
    });
  }, [baselineResolution, baselineStatCategories, categories, presetController.activePreset]);

  // Pure comparison result between active month and baseline month
  const comparison = useMemo(() => {
    return computePeriodComparison(transformed, baselineTransformed);
  }, [transformed, baselineTransformed]);

  const lastTransactionByCategoryId = useMemo(() => {
    return buildLastTransactionMap([...recentTransactions, ...periodTransactions], categories);
  }, [recentTransactions, periodTransactions, categories]);

  const handleReorderCategories = useCallback(
    async (reorderedVisibleIds: string[], isSameGroup?: (cat: ExternalProviderCategory) => boolean) => {
      const prevCategories = categories;
      const { updatedCategories, modifiedCategories } = reorderCategoriesSubset(
        categories,
        reorderedVisibleIds,
        isSameGroup,
      );

      if (modifiedCategories.length === 0) {
        return;
      }

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to update category order");
        throw err;
      }
    },
    [categories],
  );

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

        <div className="flex flex-wrap items-center gap-2">
          <MonthPeriodPicker
            activeMonthDateStr={activeMonthDateStr}
            onActiveMonthChange={setActiveMonthDateStr}
            availableMonths={availableMonths}
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
            compareCustomDateStr={compareCustomDateStr}
            onCompareCustomDateChange={setCompareCustomDateStr}
            baselineResolution={baselineResolution}
          />

          <Button size="sm" variant="outline" onClick={handleRefreshAll} className="gap-1.5 text-xs">
            <RotateCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {baseDataError && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs"
        >
          {baseDataError.message}
        </div>
      )}

      {/* Net Disposable Income & Controllable Expenses Metrics */}
      <BudgetMetricsStrip
        grossIncome={transformed.grossIncome}
        netDisposableIncome={transformed.netDisposableIncome}
        totalControllableExpense={transformed.totalControllableExpense}
        totalTaxDeductions={transformed.totalTaxDeductions}
        excludedExpenseSum={transformed.excludedExpenseSum}
        netCashFlowMargin={transformed.netCashFlowMargin}
        availableControllablePool={transformed.availableControllablePool}
        controllableCashLeft={transformed.controllableCashLeft}
        currency={defaultCurrency}
        isLoading={isLoadingPeriodData}
        comparison={comparison}
      />

      {/* Controllable Expense Pie Card */}
      <ExpensePieCard
        statCategories={statCategories}
        categories={categories}
        defaultCurrency={defaultCurrency}
        rawGrossIncome={grossIncome}
        isLoading={isLoadingPeriodData}
        presetController={presetController}
        comparison={comparison}
      />

      {/* Year-over-Year Historical Trends */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <YoYTrendsCard
            statPoints={statData?.selection?.points ?? []}
            categories={categories}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            activePreset={presetController.activePreset}
            isLoading={isLoadingStatData}
            selectedPeriod={selectedHistoricalPeriod}
            onSelectPeriod={(period) => {
              setActiveMonthDateStr(period.dateStr);
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
            activeMonthDateStr={activeMonthDateStr}
            statData={statData}
            isLoading={isLoadingStatData}
            error={statDataError}
            onRetry={() => void loadStatData(undefined, true)}
            onReorderCategories={handleReorderCategories}
            lastTransactionByCategoryId={lastTransactionByCategoryId}
            categoryDeltaMap={comparison?.categoryDeltaMap}
          />
        </div>
      </div>
    </div>
  );
}
