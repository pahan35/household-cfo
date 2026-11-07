"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { BudgetMetricsStrip } from "./budget-metrics-strip";
import {
  applyBudgetOverviewPeriodToParams,
  BUDGET_OVERVIEW_PERIOD_STORAGE_KEY,
  resolveBudgetOverviewPeriodState,
} from "./budget-overview-period-state";
import { BudgetSummaryCard } from "./budget-summary-card";
import { CategoryExpenseTraceSheet } from "./category-expense-trace-sheet";
import { CategoryRenamingDialog } from "./category-renaming-dialog";
import {
  getBudgetSelection,
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
  updateCategoriesOrder,
} from "./external-provider-client";
import {
  archiveExpenseCategory,
  buildLastTransactionMap,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  isExpenseCategory,
  moveExpenseCategoriesAboveArchived,
  moveExpenseCategoriesToBottom,
  organizeExpenseCategoriesByCurrencyTier,
  type ReorderCategoriesResult,
  reorderCategoriesSubset,
  type StatPingData,
  unarchiveExpenseCategory,
} from "./external-provider-data";
import { useExternalProviderSync } from "./external-provider-sync-toolbar";
import { ExpensePieCard } from "./expense-pie-card";
import { type CompareMode, computePeriodComparison, type ExpenseSlice, transformExpenses } from "./expense-transforms";
import { MonthPeriodPicker } from "./month-period-picker";
import { useExclusionPresets } from "./use-exclusion-presets";
import { extractAvailableMonths, parsePointDate, resolveBaselineMonth } from "./yoy-transforms";
import { type SelectedPeriod, YoYTrendsCard } from "./yoy-trends-card";

export function BudgetOverviewDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [targetedTransactions, setTargetedTransactions] = useState<ExternalProviderTransaction[]>([]);
  const queriedMissingCategoryIdsRef = useRef<Set<string>>(new Set());
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

  const [selectedTraceCategory, setSelectedTraceCategory] = useState<ExpenseSlice | null>(null);
  const [isRenamingDialogOpen, setIsRenamingDialogOpen] = useState(false);

  // Period/comparison persistence (URL + localStorage)
  const [isPeriodHydrated, setIsPeriodHydrated] = useState(false);
  const [traceSyncTick, setTraceSyncTick] = useState(0);
  const pendingTraceIdRef = useRef<string | null>(null);

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

  // Initial mount load for base data and 40-month statistics series (and when syncVersion increments)
  useEffect(() => {
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    void loadStatData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBaseData, loadStatData, syncVersion]);

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
    return buildLastTransactionMap(
      [...recentTransactions, ...periodTransactions, ...targetedTransactions],
      categories,
      defaultCurrency,
      currencies,
    );
  }, [recentTransactions, periodTransactions, targetedTransactions, categories, defaultCurrency, currencies]);

  // Identify visible expense categories missing last transaction date and fetch targeted transactions
  useEffect(() => {
    if (isLoadingBaseData || categories.length === 0) return;

    const missingIds = categories
      .filter((c) => isExpenseCategory(c) && !lastTransactionByCategoryId.has(c.id))
      .map((c) => c.id)
      .filter((id) => !queriedMissingCategoryIdsRef.current.has(id));

    if (missingIds.length === 0) return;

    for (const id of missingIds) {
      queriedMissingCategoryIdsRef.current.add(id);
    }

    const controller = new AbortController();

    async function fetchMissingTransactions() {
      try {
        const res = await getTransactionPage({
          categoryIds: missingIds,
          take: 500,
          signal: controller.signal,
        });
        const txs = res.transactions ?? [];
        if (txs.length > 0) {
          setTargetedTransactions((prev) => [...prev, ...txs]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    void fetchMissingTransactions();

    return () => {
      controller.abort();
    };
  }, [categories, lastTransactionByCategoryId, isLoadingBaseData]);

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

  const applyCategoryMutation = useCallback(
    async ({ updatedCategories, modifiedCategories }: ReorderCategoriesResult) => {
      if (modifiedCategories.length === 0) return;
      const prevCategories = categories;
      setCategories(updatedCategories);
      try {
        await updateCategoriesOrder(modifiedCategories, { allUpdatedCategories: updatedCategories });
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to update categories");
      }
    },
    [categories],
  );

  const handleArchiveCategory = useCallback(
    (id: string) => applyCategoryMutation(archiveExpenseCategory(categories, id)),
    [applyCategoryMutation, categories],
  );
  const handleUnarchiveCategory = useCallback(
    (id: string) => applyCategoryMutation(unarchiveExpenseCategory(categories, id)),
    [applyCategoryMutation, categories],
  );
  const handleMoveCategoriesAboveArchived = useCallback(
    (ids?: string[]) => applyCategoryMutation(moveExpenseCategoriesAboveArchived(categories, ids)),
    [applyCategoryMutation, categories],
  );
  const handleMoveCategoriesToBottom = useCallback(
    (ids?: string[]) => applyCategoryMutation(moveExpenseCategoriesToBottom(categories, ids)),
    [applyCategoryMutation, categories],
  );
  const handleOrganizeByCurrencyTier = useCallback(
    () =>
      applyCategoryMutation(organizeExpenseCategoriesByCurrencyTier(categories, settings?.defaultCurrency ?? "PLN")),
    [applyCategoryMutation, categories, settings?.defaultCurrency],
  );

  const handleSelectCategory = useCallback((slice: ExpenseSlice | null) => {
    pendingTraceIdRef.current = null;
    setSelectedTraceCategory(slice);
  }, []);

  const applyUrlStateToComponent = useCallback(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(BUDGET_OVERVIEW_PERIOD_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const resolved = resolveBudgetOverviewPeriodState(
      window.location.search,
      stored,
      format(startOfMonth(new Date()), "yyyy-MM-dd"),
    );
    setActiveMonthDateStr(resolved.month);
    setCompareMode(resolved.compareMode);
    setCompareCustomDateStr(resolved.compareDate);
    pendingTraceIdRef.current = resolved.traceCategory;
    if (!resolved.traceCategory) {
      setSelectedTraceCategory(null);
    }
    setTraceSyncTick((tick) => tick + 1);
  }, []);

  // Restore month / comparison / trace state on mount (URL first, then localStorage) and on Back/Forward
  useEffect(() => {
    applyUrlStateToComponent();
    setIsPeriodHydrated(true);
    window.addEventListener("popstate", applyUrlStateToComponent);
    return () => {
      window.removeEventListener("popstate", applyUrlStateToComponent);
    };
  }, [applyUrlStateToComponent]);

  // Persist month / comparison / trace state to the URL and localStorage whenever it changes
  const traceCategoryId = selectedTraceCategory?.id ?? null;
  useEffect(() => {
    if (!isPeriodHydrated) return;
    const state = {
      month: activeMonthDateStr,
      compareMode,
      compareDate: compareCustomDateStr,
      traceCategory: traceCategoryId ?? pendingTraceIdRef.current,
    };
    try {
      window.localStorage.setItem(BUDGET_OVERVIEW_PERIOD_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable (private mode / quota); URL state still applies
    }
    const url = new URL(window.location.href);
    applyBudgetOverviewPeriodToParams(url.searchParams, state);
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [isPeriodHydrated, activeMonthDateStr, compareMode, compareCustomDateStr, traceCategoryId]);

  // Resolve ?traceCategory=<id> into a slice once the category data has arrived
  // biome-ignore lint/correctness/useExhaustiveDependencies: traceSyncTick re-runs resolution after popstate
  useEffect(() => {
    const traceId = pendingTraceIdRef.current;
    if (!traceId || selectedTraceCategory) return;

    const findSlice = (slices: ExpenseSlice[]): ExpenseSlice | undefined => {
      for (const s of slices) {
        if (s.id === traceId) return s;
        if (s.children) {
          const foundChild = s.children.find((c) => c.id === traceId);
          if (foundChild) return foundChild;
        }
      }
      return undefined;
    };

    const found =
      findSlice(transformed.controllableCategories) ??
      findSlice(transformed.excludedCategories) ??
      findSlice(transformed.taxDeductionCategories);

    if (found) {
      pendingTraceIdRef.current = null;
      setSelectedTraceCategory(found);
    } else if (categories.length > 0) {
      const rawCat = categories.find((c) => c.id === traceId);
      pendingTraceIdRef.current = null;
      if (rawCat) {
        setSelectedTraceCategory({
          id: rawCat.id,
          name: rawCat.name,
          amount: 0,
          percentage: 0,
        });
      }
    }
  }, [transformed, categories, selectedTraceCategory, traceSyncTick]);

  const isLoadingPeriodData = isLoadingStatData || isLoadingPeriodTx;

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-xs font-medium">Default currency: {defaultCurrency}</div>

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

          <Button size="sm" variant="outline" onClick={() => setIsRenamingDialogOpen(true)} className="gap-1.5 text-xs">
            <Sparkles className="text-primary size-3.5" />
            <span>Normalize Categories</span>
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
        onSelectCategory={handleSelectCategory}
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
            currencies={currencies}
            periodTransactions={periodTransactions}
            defaultCurrency={defaultCurrency}
            activeMonthDateStr={activeMonthDateStr}
            statData={statData}
            isLoading={isLoadingStatData}
            error={statDataError}
            onRetry={() => void loadStatData(undefined, true)}
            onReorderCategories={handleReorderCategories}
            lastTransactionByCategoryId={lastTransactionByCategoryId}
            categoryDeltaMap={comparison?.categoryDeltaMap}
            onSelectCategory={handleSelectCategory}
            onArchiveCategory={handleArchiveCategory}
            onUnarchiveCategory={handleUnarchiveCategory}
            onMoveCategoriesAboveArchived={handleMoveCategoriesAboveArchived}
            onMoveCategoriesToBottom={handleMoveCategoriesToBottom}
            onOrganizeByCurrencyTier={handleOrganizeByCurrencyTier}
            onCategoriesUpdated={setCategories}
          />
        </div>
      </div>

      {/* Category Expense Trace Slide-over Sheet */}
      <CategoryExpenseTraceSheet
        open={Boolean(selectedTraceCategory)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleSelectCategory(null);
          }
        }}
        category={selectedTraceCategory}
        categories={categories}
        currencies={currencies}
        activeMonthDateStr={activeMonthDateStr}
        baselineResolution={baselineResolution}
        defaultCurrency={defaultCurrency}
      />

      {/* Category Renaming & Normalization Dialog */}
      <CategoryRenamingDialog
        open={isRenamingDialogOpen}
        onOpenChange={setIsRenamingDialogOpen}
        categories={categories}
        defaultCurrency={defaultCurrency}
        transactions={[...recentTransactions, ...periodTransactions, ...targetedTransactions]}
        defaultScope="expense"
        onRenamed={(updatedCategories) => {
          setCategories(updatedCategories);
          void loadBaseData(undefined, true);
          void loadStatData(undefined, true);
          void loadPeriodTransactions(undefined, true);
        }}
      />
    </div>
  );
}
