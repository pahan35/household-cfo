"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { format, startOfMonth } from "date-fns";
import { Banknote, RotateCw } from "lucide-react";

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
  type StatPingData,
} from "./external-provider-data";
import { IncomeMetricsStrip } from "./income-metrics-strip";
import { IncomeSourcesCard } from "./income-sources-card";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { TaxAuditCard } from "./tax-audit-card";
import { TaxBreakdownCard } from "./tax-breakdown-card";
import {
  aggregateTaxesByTag,
  computeIncomeTaxMetrics,
  detectUntaggedTaxTransactions,
  getTaxCategoryIds,
  hasRecognizedTaxTag,
  matchTaxBucket,
} from "./tax-transforms";
import { parsePointDate } from "./yoy-transforms";

export function IncomeDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [statData, setStatData] = useState<StatPingData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
        getTransactionPage({ skip: 0, take: 500, signal, forceRefresh }),
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
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Tax categories auto-detection
  const taxCategoryIds = useMemo(() => getTaxCategoryIds(categories), [categories]);

  // Controllable living expenses from stat ping (sum of non-tax expense categories)
  const controllableExpenses = useMemo(() => {
    const points = statData?.selection?.points ?? [];
    if (points.length === 0) return 0;
    const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const activePoint =
      points.find((p) => p.id === currentMonthStart || parsePointDate(p)?.dateStr === currentMonthStart) ?? points[0];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    let sum = 0;
    for (const cat of activePoint?.categories ?? []) {
      const catMeta = categoryMap.get(cat.id);
      if (catMeta?.categoryType === CategoryType.Income) continue;
      if (!taxCategoryIds.has(cat.id)) {
        sum += Number(cat.value ?? cat.amount) || 0;
      }
    }
    return sum;
  }, [statData, categories, taxCategoryIds]);

  // Tax breakdown & audit
  const taxBreakdown = useMemo(
    () =>
      aggregateTaxesByTag({
        transactions,
        taxCategoryIds,
        currencies,
        defaultCurrency,
      }),
    [transactions, taxCategoryIds, currencies, defaultCurrency],
  );

  const untaggedTaxTransactions = useMemo(
    () => detectUntaggedTaxTransactions(transactions, taxCategoryIds),
    [transactions, taxCategoryIds],
  );

  // Income metrics strip
  const incomeMetrics = useMemo(
    () =>
      computeIncomeTaxMetrics({
        transactions,
        categories,
        currencies,
        defaultCurrency,
        controllableExpenses,
        taxCategoryIds,
      }),
    [transactions, categories, currencies, defaultCurrency, controllableExpenses, taxCategoryIds],
  );

  // Inflow by source ID map
  const incomeBySourceId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of incomeMetrics.incomeSources) {
      map.set(item.sourceId, item.totalConverted);
    }
    return map;
  }, [incomeMetrics.incomeSources]);

  // Direction-aware last transaction summaries
  const lastTransactionByCategoryId = useMemo(
    () => buildLastTransactionMap(transactions, categories),
    [transactions, categories],
  );

  // Filtered transactions for the ledger
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredTransactions = useMemo(() => {
    if (selectedSourceId) {
      return transactions.filter((tx) => tx.sourceId === selectedSourceId);
    }

    if (selectedTaxTag) {
      return transactions.filter((tx) => {
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
    return transactions.filter((tx) => {
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
  }, [transactions, selectedSourceId, selectedTaxTag, taxCategoryIds, categoryById]);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Multi-currency cash flow, tag-attributed tax deductions, and disposable income</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void loadData(undefined, true)}
          className="h-8 gap-1.5 text-xs"
        >
          <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 1. Metrics Strip */}
      <IncomeMetricsStrip
        grossIncome={incomeMetrics.grossIncome}
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

      {/* 2. Main Content Grid */}
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
            selectedSourceId={selectedSourceId}
            onSelectSource={handleSelectSource}
            incomeBySourceId={incomeBySourceId}
            onOpenNormalizeCategories={() => setIsRenamingDialogOpen(true)}
            onCategoriesUpdated={setCategories}
          />
        </div>

        {/* Right Column: Tax Deductions Breakdown & Missing Tag Audit */}
        <div className="flex flex-col gap-6 lg:col-span-6 xl:col-span-7">
          <TaxBreakdownCard
            taxBreakdown={taxBreakdown}
            grossIncome={incomeMetrics.grossIncome}
            netDisposableIncome={incomeMetrics.netDisposableIncome}
            effectiveTaxRate={incomeMetrics.effectiveTaxRate}
            grossZus={incomeMetrics.grossZus}
            pfronCashback={incomeMetrics.pfronCashback}
            netZus={incomeMetrics.netZus}
            passThroughVat={incomeMetrics.passThroughVat}
            fxFriction={incomeMetrics.fxFriction}
            currency={defaultCurrency}
            selectedTagId={selectedTaxTag}
            onSelectTag={handleSelectTag}
            isLoading={isLoading}
          />

          <TaxAuditCard
            untaggedTransactions={untaggedTaxTransactions}
            categories={categories}
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
            : "No income, tax, or currency exchange transactions found for the period."
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
