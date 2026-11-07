"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { format, startOfMonth } from "date-fns";
import { Banknote, Calendar, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { CategoryRenamingDialog } from "./category-renaming-dialog";
import { getBudgetSelection, getCategories, getCurrencies, getSettings, getTransactionPage } from "./external-provider-client";
import {
  buildLastTransactionMap,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  formatMoney,
  type StatPingData,
} from "./external-provider-data";
import { useExternalProviderSync } from "./external-provider-sync-toolbar";
import { IncomeMetricsStrip } from "./income-metrics-strip";
import { IncomeSourcesCard } from "./income-sources-card";
import { IncomeTaxTimelineCard } from "./income-tax-timeline-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { TaxAuditCard } from "./tax-audit-card";
import { TaxBreakdownCard } from "./tax-breakdown-card";
import {
  aggregateTaxesByTag,
  computeIncomeTaxMetrics,
  detectUntaggedTaxTransactions,
  formatMonthLabel,
  getPreviousMonthKey,
  getTaxCategoryIds,
  getTransactionMonthKey,
  hasRecognizedTaxTag,
  matchTaxBucket,
  type TaxTimelineTimingMode,
} from "./tax-transforms";
import { parsePointDate } from "./yoy-transforms";

export function IncomeDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [statData, setStatData] = useState<StatPingData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Period Selection State (Month vs. Year Mode)
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [activeYear, setActiveYear] = useState<number>(() => new Date().getFullYear());
  const [timingMode, setTimingMode] = useState<TaxTimelineTimingMode>("cash");

  // Filtering state for embedded transaction ledger
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTaxTag, setSelectedTaxTag] = useState<string | null>(null);
  const [isRenamingDialogOpen, setIsRenamingDialogOpen] = useState(false);

  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

  const loadData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const currentMonthAnchor = format(new Date(), "yyyy-MM-dd");

      const [settingsRes, categoriesRes, currenciesRes, transactionsRes, statRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
        getCurrencies({ signal, forceRefresh }),
        getTransactionPage({ skip: 0, take: 1500, signal, forceRefresh }),
        getBudgetSelection({ from: currentMonthAnchor, signal, forceRefresh }),
      ]);

      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      }
      if (currenciesRes.status === "fulfilled") {
        setCurrencies(currenciesRes.value);
      }
      if (transactionsRes.status === "fulfilled") {
        setTransactions(transactionsRes.value.transactions ?? []);
      }
      if (statRes.status === "fulfilled") {
        setStatData(statRes.value);
      }

      if (categoriesRes.status === "rejected" && !signal?.aborted) {
        setError(categoriesRes.reason instanceof Error ? categoriesRes.reason : new Error("Failed to load categories"));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err : new Error("Failed to load income data"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, syncVersion]);

  // Default to latest transaction month if current month has no activity
  useEffect(() => {
    if (transactions.length > 0) {
      const months = new Set<string>();
      for (const tx of transactions) {
        if (tx.deleted) continue;
        const m = getTransactionMonthKey(tx);
        if (m) months.add(m);
      }
      const sorted = Array.from(months).sort();
      if (sorted.length > 0) {
        const latest = sorted[sorted.length - 1];
        const currentMonth = format(new Date(), "yyyy-MM");
        if (!months.has(currentMonth)) {
          setActiveMonthKey(latest);
          const y = parseInt(latest.slice(0, 4), 10);
          if (!isNaN(y)) setActiveYear(y);
        }
      }
    }
  }, [transactions]);

  // Tax categories auto-detection
  const taxCategoryIds = useMemo(() => getTaxCategoryIds(categories), [categories]);

  // Active period key: "yyyy" in Year Mode, "yyyy-MM" in Month Mode
  const periodKey = periodMode === "year" ? String(activeYear) : activeMonthKey;

  // Active months count in Year Mode for scaling targets (e.g. 10 * limitAmount)
  const activeMonthsCount = useMemo(() => {
    if (periodMode !== "year") return 1;
    const months = new Set<string>();
    for (const tx of transactions) {
      if (tx.deleted) continue;
      const m = getTransactionMonthKey(tx);
      if (m && m.startsWith(`${activeYear}-`)) {
        months.add(m);
      }
    }
    return Math.max(1, Math.min(12, months.size));
  }, [periodMode, activeYear, transactions]);

  // Controllable living expenses from stat ping (sum of non-tax expense categories)
  const controllableExpenses = useMemo(() => {
    const points = statData?.selection?.points ?? [];
    if (points.length === 0) return 0;
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    if (periodMode === "year") {
      let annualSum = 0;
      for (const p of points) {
        const dStr = p.id ?? parsePointDate(p)?.dateStr;
        if (dStr && dStr.startsWith(`${activeYear}-`)) {
          for (const cat of p.categories ?? []) {
            const catMeta = categoryMap.get(cat.id);
            if (catMeta?.categoryType === CategoryType.Income) continue;
            if (!taxCategoryIds.has(cat.id)) {
              annualSum += Number(cat.value ?? cat.amount) || 0;
            }
          }
        }
      }
      return annualSum;
    }

    // Month Mode
    const targetMonthStart = `${activeMonthKey}-01`;
    const activePoint =
      points.find((p) => p.id === targetMonthStart || parsePointDate(p)?.dateStr === targetMonthStart) ??
      points.find((p) => p.id?.startsWith(activeMonthKey) || parsePointDate(p)?.dateStr?.startsWith(activeMonthKey));

    let sum = 0;
    for (const cat of activePoint?.categories ?? []) {
      const catMeta = categoryMap.get(cat.id);
      if (catMeta?.categoryType === CategoryType.Income) continue;
      if (!taxCategoryIds.has(cat.id)) {
        sum += Number(cat.value ?? cat.amount) || 0;
      }
    }
    return sum;
  }, [statData, categories, taxCategoryIds, periodMode, activeYear, activeMonthKey]);

  // Tax breakdown & audit scoped to period
  const taxBreakdown = useMemo(
    () =>
      aggregateTaxesByTag({
        transactions,
        taxCategoryIds,
        currencies,
        defaultCurrency,
        periodMode,
        periodKey,
        timingMode,
      }),
    [transactions, taxCategoryIds, currencies, defaultCurrency, periodMode, periodKey, timingMode],
  );

  const untaggedTaxTransactions = useMemo(
    () => detectUntaggedTaxTransactions(transactions, taxCategoryIds),
    [transactions, taxCategoryIds],
  );

  // Income metrics strip scoped to period with YoY statistics
  const incomeMetrics = useMemo(
    () =>
      computeIncomeTaxMetrics({
        transactions,
        categories,
        currencies,
        defaultCurrency,
        controllableExpenses,
        taxCategoryIds,
        periodMode,
        periodKey,
        timingMode,
      }),
    [
      transactions,
      categories,
      currencies,
      defaultCurrency,
      controllableExpenses,
      taxCategoryIds,
      periodMode,
      periodKey,
      timingMode,
    ],
  );

  // Inflow by source ID map
  const incomeBySourceId = useMemo(() => {
    const map = new Map<string, { nativeAmount: number; totalConverted: number }>();
    for (const item of incomeMetrics.incomeSources) {
      map.set(item.sourceId, {
        nativeAmount: item.nativeAmount,
        totalConverted: item.totalConverted,
      });
    }
    return map;
  }, [incomeMetrics.incomeSources]);

  // Direction-aware last transaction summaries
  const lastTransactionByCategoryId = useMemo(
    () => buildLastTransactionMap(transactions, categories, defaultCurrency, currencies),
    [transactions, categories, defaultCurrency, currencies],
  );

  // Filtered transactions for the ledger (scoped to period + optional source/tag filter)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredTransactions = useMemo(() => {
    // 1. First filter by active period
    const inPeriodTxs = transactions.filter((tx) => {
      const txMonth = getTransactionMonthKey(tx);
      if (!txMonth) return false;
      const isTax = tx.destinationId ? taxCategoryIds.has(tx.destinationId) : false;
      const effectiveMonth = isTax && timingMode === "accrual" ? getPreviousMonthKey(txMonth) : txMonth;
      return periodMode === "year" ? effectiveMonth.startsWith(`${activeYear}-`) : effectiveMonth === activeMonthKey;
    });

    if (selectedSourceId) {
      return inPeriodTxs.filter((tx) => tx.sourceId === selectedSourceId);
    }

    if (selectedTaxTag) {
      return inPeriodTxs.filter((tx) => {
        if (!tx.destinationId || !taxCategoryIds.has(tx.destinationId)) return false;
        if (selectedTaxTag === "other") {
          return !hasRecognizedTaxTag(tx);
        }
        return (
          Array.isArray(tx.tags) &&
          tx.tags.some((t) => typeof t === "string" && matchTaxBucket(t)?.id === selectedTaxTag)
        );
      });
    }

    // Default: Show all transactions relevant to income sources, tax categories, or currency exchange transfers
    return inPeriodTxs.filter((tx) => {
      const srcCat = tx.sourceId ? categoryById.get(tx.sourceId) : undefined;
      const destCat = tx.destinationId ? categoryById.get(tx.destinationId) : undefined;
      const isIncome =
        Number(tx.sourceType) === CategoryType.Income || Number(srcCat?.categoryType) === CategoryType.Income;
      const isTax = tx.destinationId ? taxCategoryIds.has(tx.destinationId) : false;
      const isCurrencyTransfer =
        (tx.sourceCurrencyId?.toUpperCase() === "USD" && tx.destinationCurrencyId?.toUpperCase() === "PLN") ||
        (srcCat?.currencyId?.toUpperCase() === "USD" && destCat?.currencyId?.toUpperCase() === "PLN");
      return isIncome || isTax || isCurrencyTransfer;
    });
  }, [
    transactions,
    periodMode,
    activeYear,
    activeMonthKey,
    timingMode,
    selectedSourceId,
    selectedTaxTag,
    taxCategoryIds,
    categoryById,
  ]);

  // Active filter label
  const activeFilterLabel = useMemo(() => {
    if (selectedSourceId) {
      return categoryById.get(selectedSourceId)?.name ?? "Income Source";
    }
    if (selectedTaxTag) {
      const bucket = taxBreakdown.byTag.find((t) => t.tagId === selectedTaxTag);
      return bucket ? `#${bucket.canonicalTag} (${bucket.label})` : `#${selectedTaxTag}`;
    }
    return undefined;
  }, [selectedSourceId, selectedTaxTag, categoryById, taxBreakdown.byTag]);

  const handleClearFilter = useCallback(() => {
    setSelectedSourceId(null);
    setSelectedTaxTag(null);
  }, []);

  const handleSelectSource = useCallback((sourceId: string | null) => {
    setSelectedSourceId(sourceId);
    setSelectedTaxTag(null);
  }, []);

  const handleSelectTag = useCallback((tagId: string | null) => {
    setSelectedTaxTag(tagId);
    setSelectedSourceId(null);
  }, []);

  const handleTagRemediated = useCallback(async (tx: ExternalProviderTransaction, newTag: string) => {
    // Optimistically update local transactions state
    setTransactions((prev) =>
      prev.map((item) => {
        if (item.id === tx.id) {
          const existingTags = Array.isArray(item.tags) ? item.tags : [];
          return { ...item, tags: [...existingTags, newTag] };
        }
        return item;
      }),
    );
  }, []);

  const handlePrevPeriod = () => {
    if (periodMode === "year") {
      setActiveYear((y) => y - 1);
    } else {
      const [yStr, mStr] = activeMonthKey.split("-");
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10) - 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      const newKey = `${y}-${String(m).padStart(2, "0")}`;
      setActiveMonthKey(newKey);
      setActiveYear(y);
    }
  };

  const handleNextPeriod = () => {
    if (periodMode === "year") {
      setActiveYear((y) => y + 1);
    } else {
      const [yStr, mStr] = activeMonthKey.split("-");
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10) + 1;
      if (m === 13) {
        m = 1;
        y += 1;
      }
      const newKey = `${y}-${String(m).padStart(2, "0")}`;
      setActiveMonthKey(newKey);
      setActiveYear(y);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Unified Period Control Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Multi-currency cash flow, tag-attributed tax deductions, and disposable income</span>
          </div>
        </div>

        {/* Unified Period & Basis Navigation Bar */}
        <div className="bg-card/70 border-border/60 flex flex-col justify-between gap-3 rounded-xl border p-3.5 shadow-xs md:flex-row md:items-center">
          {/* Left: Mode toggle, Steppers & Period Label */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month / Year Segmented Toggle */}
            <div className="bg-muted inline-flex rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPeriodMode("month")}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-all",
                  periodMode === "month"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Month Mode
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("year")}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-all",
                  periodMode === "year"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Year Mode
              </button>
            </div>

            {/* Steppers & Label */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={handlePrevPeriod}
                aria-label="Previous period"
                className="size-7"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="border-border/60 bg-background/80 flex items-center gap-1.5 rounded-lg border px-3 py-1 font-medium text-xs">
                <Calendar className="text-muted-foreground size-3.5" />
                <span>{periodMode === "year" ? String(activeYear) : formatMonthLabel(activeMonthKey)}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={handleNextPeriod}
                aria-label="Next period"
                className="size-7"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {/* YoY Delta Badges */}
            {incomeMetrics.yoy && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] gap-1"
                >
                  <span>vs {incomeMetrics.yoy.priorPeriodLabel}:</span>
                  <span className="font-semibold">
                    Inflow {incomeMetrics.yoy.grossDelta >= 0 ? "+" : ""}
                    {formatMoney(incomeMetrics.yoy.grossDelta, defaultCurrency)}
                    {incomeMetrics.yoy.grossDeltaPct !== null &&
                      ` (${incomeMetrics.yoy.grossDeltaPct >= 0 ? "+" : ""}${incomeMetrics.yoy.grossDeltaPct.toFixed(1)}%)`}
                  </span>
                </Badge>
                {incomeMetrics.yoy.netDisposableDelta !== 0 && (
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    Net {incomeMetrics.yoy.netDisposableDelta >= 0 ? "+" : ""}
                    {formatMoney(incomeMetrics.yoy.netDisposableDelta, defaultCurrency)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right: Cash vs. Accrual Toggle & Refresh Button */}
          <div className="flex items-center gap-2 self-end md:self-center">
            <div className="bg-muted inline-flex rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTimingMode("cash")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  timingMode === "cash"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Cash Basis
              </button>
              <button
                type="button"
                onClick={() => setTimingMode("accrual")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  timingMode === "accrual"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Accrual (M - 1)
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadData(undefined, true)}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 1. Metrics Strip */}
      <IncomeMetricsStrip
        grossIncome={incomeMetrics.grossIncome}
        rawGrossInflow={incomeMetrics.rawGrossInflow}
        totalTaxes={incomeMetrics.totalTaxes}
        grossZus={incomeMetrics.grossZus}
        pfronCashback={incomeMetrics.pfronCashback}
        netZus={incomeMetrics.netZus}
        fxFriction={incomeMetrics.fxFriction}
        effectiveTaxRate={incomeMetrics.effectiveTaxRate}
        netDisposableIncome={incomeMetrics.netDisposableIncome}
        controllableExpenses={incomeMetrics.controllableExpenses}
        coverageRatio={incomeMetrics.coverageRatio}
        netSurplus={incomeMetrics.netSurplus}
        currency={defaultCurrency}
        isLoading={isLoading}
      />

      {/* 2. Historical Income & Taxation Timeline */}
      <IncomeTaxTimelineCard
        transactions={transactions}
        categories={categories}
        currencies={currencies}
        defaultCurrency={defaultCurrency}
        taxCategoryIds={taxCategoryIds}
        isLoading={isLoading}
        periodMode={periodMode}
        activeMonthKey={activeMonthKey}
        activeYear={activeYear}
        timingMode={timingMode}
        onTimingModeChange={setTimingMode}
        onSelectMonth={(monthKey) => {
          setPeriodMode("month");
          setActiveMonthKey(monthKey);
          const y = parseInt(monthKey.slice(0, 4), 10);
          if (!isNaN(y)) setActiveYear(y);
        }}
      />

      {/* 3. Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Income Sources Management */}
        <div className="lg:col-span-6 xl:col-span-5">
          <IncomeSourcesCard
            categories={categories}
            currency={defaultCurrency}
            isLoading={isLoading}
            error={error}
            onRetry={() => void loadData(undefined, true)}
            lastTransactionByCategoryId={lastTransactionByCategoryId}
            currencies={currencies}
            selectedSourceId={selectedSourceId}
            onSelectSource={handleSelectSource}
            incomeBySourceId={incomeBySourceId}
            onOpenNormalizeCategories={() => setIsRenamingDialogOpen(true)}
            onCategoriesUpdated={setCategories}
            periodMode={periodMode}
            targetMultiplier={activeMonthsCount}
          />
        </div>

        {/* Right Column: Tax Deductions Breakdown & Missing Tag Audit */}
        <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-7">
          <TaxBreakdownCard
            taxBreakdown={taxBreakdown}
            grossIncome={incomeMetrics.grossIncome}
            rawGrossInflow={incomeMetrics.rawGrossInflow}
            netDisposableIncome={incomeMetrics.netDisposableIncome}
            effectiveTaxRate={incomeMetrics.effectiveTaxRate}
            grossZus={incomeMetrics.grossZus}
            pfronCashback={incomeMetrics.pfronCashback}
            netZus={incomeMetrics.netZus}
            passThroughVat={incomeMetrics.passThroughVat}
            fxFriction={incomeMetrics.fxFriction}
            fxFrictionDetails={incomeMetrics.fxFrictionDetails}
            currency={defaultCurrency}
            selectedTagId={selectedTaxTag}
            onSelectTag={handleSelectTag}
            isLoading={isLoading}
          />

          <TaxAuditCard
            untaggedTransactions={untaggedTaxTransactions}
            categories={categories}
            currencies={currencies}
            currency={defaultCurrency}
            onTagAssigned={handleTagRemediated}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 3. Filtered Transaction Ledger */}
      <RecentTransactionsCard
        defaultCurrency={defaultCurrency}
        categories={categories}
        initialTransactions={filteredTransactions}
        filterLabel={activeFilterLabel}
        onClearFilter={handleClearFilter}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadData(undefined, true)}
        emptyTitle="No income or tax transactions"
        emptyDescription={
          activeFilterLabel
            ? `No transactions found matching ${activeFilterLabel}.`
            : `No income, tax, or currency exchange transactions found for ${periodMode === "year" ? activeYear : formatMonthLabel(activeMonthKey)}.`
        }
      />

      <CategoryRenamingDialog
        open={isRenamingDialogOpen}
        onOpenChange={setIsRenamingDialogOpen}
        categories={categories}
        defaultCurrency={defaultCurrency}
        transactions={transactions}
        defaultScope="income"
        onRenamed={(updatedCategories) => {
          setCategories(updatedCategories);
          void loadData(undefined, true);
        }}
      />
    </div>
  );
}
