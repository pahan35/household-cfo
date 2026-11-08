"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Calendar, Loader2, Receipt, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getTransactionPage, updateTransactionTags } from "./external-provider-client";
import {
  CategoryType,
  computeTransactionsWithRunningBalance,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  formatMoney,
  formatTransactionDate,
  getAccountBalance,
} from "./external-provider-data";
import { ExternalProviderIcon } from "./external-provider-icons";
import { resolveCategoryCurrency } from "./external-provider-money";
import { MultiTagEditorPopover, normalizeTag } from "./multi-tag-editor-popover";
import { SectionShell } from "./section-shell";
import {
  type DateRangePeriod,
  formatDateRangeDisplay,
  hasActiveDateFilter,
  TransactionDateRangeFilter,
} from "./transaction-date-range-filter";

export interface RecentTransactionsCardProps {
  defaultCurrency?: string;
  categories?: ExternalProviderCategory[];
  selectedAccountId?: string | null;
  onClearAccountFilter?: () => void;
  selectedCategoryIds?: string[];
  onClearCategoryFilter?: () => void;
  filterLabel?: string;
  onClearFilter?: () => void;
  periodFilter?: DateRangePeriod;
  onPeriodFilterChange?: (period: DateRangePeriod) => void;
  initialTransactions?: ExternalProviderTransaction[];
  initialHasMoreData?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

const PAGE_SIZE = 20;

export function RecentTransactionsCard({
  defaultCurrency = "PLN",
  categories = [],
  selectedAccountId = null,
  onClearAccountFilter,
  selectedCategoryIds,
  onClearCategoryFilter,
  filterLabel,
  onClearFilter,
  periodFilter,
  onPeriodFilterChange,
  initialTransactions,
  initialHasMoreData = false,
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
  emptyTitle,
  emptyDescription,
}: RecentTransactionsCardProps) {
  const [internalPeriod, setInternalPeriod] = useState<DateRangePeriod | undefined>(periodFilter);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>(initialTransactions ?? []);
  const [hasMoreData, setHasMoreData] = useState(initialHasMoreData);
  const [internalIsLoading, setInternalIsLoading] = useState(initialTransactions === undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [internalError, setInternalError] = useState<Error | null>(null);

  const effectivePeriod = useMemo(() => {
    return periodFilter ?? internalPeriod;
  }, [periodFilter, internalPeriod]);

  const isControlled = initialTransactions !== undefined;
  const isLoading = isControlled ? (controlledIsLoading ?? false) : internalIsLoading;
  const error = controlledError ?? internalError;

  const selectedAccount = useMemo(
    () => (selectedAccountId ? categories.find((c) => c.id === selectedAccountId) : undefined),
    [categories, selectedAccountId],
  );

  const categoryIdsKey = (selectedCategoryIds ?? []).join(",");
  const queryCategoryIds = useMemo(
    () => (categoryIdsKey ? categoryIdsKey.split(",") : selectedAccountId ? [selectedAccountId] : undefined),
    [categoryIdsKey, selectedAccountId],
  );

  const selectedCategoryLabel = useMemo(() => {
    if (!categoryIdsKey) return undefined;
    const ids = categoryIdsKey.split(",");
    const first = categories.find((c) => c.id === ids[0]);
    if (!first) return "Category";
    return ids.length > 1 ? `${first.name} +${ids.length - 1}` : first.name;
  }, [categoryIdsKey, categories]);

  useEffect(() => {
    if (initialTransactions !== undefined) {
      setTransactions(initialTransactions);
      setHasMoreData(initialHasMoreData);
    }
  }, [initialTransactions, initialHasMoreData]);

  const fetchInitialPage = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setInternalIsLoading(true);
      setInternalError(null);
      try {
        const page = await getTransactionPage({
          skip: 0,
          take: PAGE_SIZE,
          period: effectivePeriod,
          categoryIds: queryCategoryIds,
          signal,
          forceRefresh,
        });
        setTransactions(page.transactions ?? []);
        setHasMoreData(Boolean(page.hasMoreData));
        setInternalIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setInternalError(err instanceof Error ? err : new Error("Failed to load transactions"));
        setInternalIsLoading(false);
      }
    },
    [effectivePeriod, queryCategoryIds],
  );

  useEffect(() => {
    if (isControlled) return;
    const controller = new AbortController();
    void fetchInitialPage(controller.signal);
    return () => {
      controller.abort();
    };
  }, [isControlled, fetchInitialPage]);

  const handleRetry = useCallback(() => {
    if (controlledOnRetry) {
      controlledOnRetry();
    } else {
      void fetchInitialPage(undefined, true);
    }
  }, [controlledOnRetry, fetchInitialPage]);

  const handlePeriodChange = useCallback(
    (nextPeriod: DateRangePeriod) => {
      if (onPeriodFilterChange) {
        onPeriodFilterChange(nextPeriod);
      }
      setInternalPeriod(nextPeriod);
    },
    [onPeriodFilterChange],
  );

  const handleClearPeriodFilter = useCallback(() => {
    handlePeriodChange({ from: null, to: null });
  }, [handlePeriodChange]);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMoreData) return;
    setIsLoadingMore(true);
    try {
      const page = await getTransactionPage({
        skip: transactions.length,
        take: PAGE_SIZE,
        period: effectivePeriod,
        categoryIds: queryCategoryIds,
      });

      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = (page.transactions ?? []).filter((t) => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });
      setHasMoreData(Boolean(page.hasMoreData));
    } catch (err) {
      setInternalError(err instanceof Error ? err : new Error("Failed to load more transactions"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Extract all unique tags across current transactions for autocomplete suggestions
  const knownTags = useMemo(() => {
    const set = new Set<string>(["#travel", "#end-travel", "#vacation", "#concert", "#hotel", "#transport"]);
    for (const tx of transactions) {
      if (Array.isArray(tx.tags)) {
        for (const tag of tx.tags) {
          if (typeof tag === "string" && tag.trim()) {
            set.add(normalizeTag(tag));
          }
        }
      }
    }
    return Array.from(set);
  }, [transactions]);

  // Optimistic tag updates with rollback on network failure
  const handleTransactionTagsChange = useCallback(async (tx: ExternalProviderTransaction, newTags: string[]) => {
    const previousTags = tx.tags ?? [];
    setTransactions((prev) => prev.map((item) => (item.id === tx.id ? { ...item, tags: newTags } : item)));
    try {
      await updateTransactionTags(tx, newTags);
    } catch (err) {
      setTransactions((prev) => prev.map((item) => (item.id === tx.id ? { ...item, tags: previousTags } : item)));
      throw err;
    }
  }, []);

  // When both a category and an account filter are active, narrow category results to the account client-side
  const visibleTransactions = useMemo(() => {
    if (!categoryIdsKey || !selectedAccountId) return transactions;
    return transactions.filter((tx) => tx.sourceId === selectedAccountId || tx.destinationId === selectedAccountId);
  }, [transactions, categoryIdsKey, selectedAccountId]);

  const rows = useMemo(
    () => computeTransactionsWithRunningBalance(visibleTransactions, categories, defaultCurrency),
    [visibleTransactions, categories, defaultCurrency],
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const activeFilterLabel = filterLabel ?? selectedAccount?.name;
  const isDateFiltered = hasActiveDateFilter(effectivePeriod);
  const activeDateLabel = formatDateRangeDisplay(effectivePeriod);
  const hasAnyFilter = Boolean(activeFilterLabel || selectedCategoryLabel || isDateFiltered);
  const handleClear = onClearFilter ?? onClearAccountFilter;

  return (
    <SectionShell
      title="Transactions"
      description={
        hasAnyFilter
          ? `Filtered transactions for ${[selectedCategoryLabel, activeFilterLabel, activeDateLabel].filter(Boolean).join(" · ")}`
          : "All-time stream of household income, spending, and transfers"
      }
      action={
        hasAnyFilter ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCategoryLabel && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onClearCategoryFilter}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <span className="text-muted-foreground">Category:</span>
                <span className="max-w-[140px] truncate">{selectedCategoryLabel}</span>
                <X className="size-3" />
                <span className="sr-only">Clear category filter</span>
              </Button>
            )}
            {activeFilterLabel && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleClear}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <span className="max-w-[140px] truncate">{activeFilterLabel}</span>
                {selectedAccount && !filterLabel && (
                  <span className="text-muted-foreground tabular-nums">
                    {formatMoney(
                      getAccountBalance(selectedAccount),
                      resolveCategoryCurrency(selectedAccount, defaultCurrency),
                    )}
                  </span>
                )}
                <X className="size-3" />
                <span className="sr-only">Clear filter</span>
              </Button>
            )}
            {isDateFiltered && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleClearPeriodFilter}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <Calendar className="size-3 text-muted-foreground" />
                <span className="tabular-nums">{activeDateLabel}</span>
                <X className="size-3" />
                <span className="sr-only">Clear date filter</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={handleRetry}
      isEmpty={rows.length === 0}
      emptyTitle={emptyTitle ?? "No transactions found"}
      emptyDescription={
        emptyDescription ??
        (isDateFiltered
          ? "No transactions recorded for the selected date range."
          : selectedAccountId
            ? "No transactions recorded for the selected account."
            : "No transactions recorded yet.")
      }
      emptyIcon={<Receipt className="size-6 text-muted-foreground" />}
      skeletonCount={5}
      skeletonHeight="h-12"
    >
      <div className="space-y-3">
        {/* Interactive Date Range Filter Toolbar */}
        <div className="border-b pb-3">
          <TransactionDateRangeFilter value={effectivePeriod} onChange={handlePeriodChange} />
        </div>

        {/* Transaction stream rows */}
        <div className="flex flex-col divide-y divide-border/60">
          {rows.map((row) => {
            const { tx, endpoints, direction } = row;

            const counterpartyCategory =
              direction === "income"
                ? tx.sourceId
                  ? categoryMap.get(tx.sourceId)
                  : undefined
                : tx.destinationId
                  ? categoryMap.get(tx.destinationId)
                  : undefined;

            // Resolve the amount and balance shown for this row (account-aware).
            let amountText: string;
            let balanceText: string | null = null;
            const isSelectedSource = selectedAccountId !== null && tx.sourceId === selectedAccountId;
            const isSelectedDest = selectedAccountId !== null && tx.destinationId === selectedAccountId;

            if (isSelectedSource || (!isSelectedDest && direction === "expense")) {
              amountText = `-${formatMoney(row.sourceAmount, endpoints.sourceCurrency)}`;
              if (row.sourceBalanceAfter !== undefined) {
                balanceText = formatMoney(row.sourceBalanceAfter, endpoints.sourceCurrency);
              }
            } else if (isSelectedDest || direction === "income") {
              amountText = `+${formatMoney(row.destinationAmount, endpoints.destinationCurrency)}`;
              if (row.destinationBalanceAfter !== undefined) {
                balanceText = formatMoney(row.destinationBalanceAfter, endpoints.destinationCurrency);
              }
            } else {
              amountText =
                endpoints.sourceCurrency === endpoints.destinationCurrency
                  ? formatMoney(row.sourceAmount, endpoints.sourceCurrency)
                  : `${formatMoney(row.sourceAmount, endpoints.sourceCurrency)} → ${formatMoney(row.destinationAmount, endpoints.destinationCurrency)}`;
              const parts = [
                row.sourceBalanceAfter !== undefined
                  ? formatMoney(row.sourceBalanceAfter, endpoints.sourceCurrency)
                  : null,
                row.destinationBalanceAfter !== undefined
                  ? formatMoney(row.destinationBalanceAfter, endpoints.destinationCurrency)
                  : null,
              ].filter((part): part is string => part !== null);
              balanceText = parts.length > 0 ? parts.join(" → ") : null;
            }

            const isOutflowRow = amountText.startsWith("-");
            const isInflowRow = amountText.startsWith("+");

            return (
              <div key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "relative flex size-9 shrink-0 items-center justify-center rounded-lg",
                      direction === "income" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      direction === "expense" && "bg-muted text-muted-foreground",
                      direction === "transfer" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    )}
                  >
                    <ExternalProviderIcon
                      icon={counterpartyCategory?.icon}
                      fallbackType={
                        counterpartyCategory?.categoryType ??
                        (direction === "income"
                          ? CategoryType.Income
                          : direction === "expense"
                            ? CategoryType.Expense
                            : CategoryType.Account)
                      }
                      className="size-4"
                    />
                    <span
                      className={cn(
                        "absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border",
                        direction === "income" && "text-emerald-600 dark:text-emerald-400",
                        direction === "expense" && "text-muted-foreground",
                        direction === "transfer" && "text-blue-600 dark:text-blue-400",
                      )}
                    >
                      {direction === "income" && <ArrowDownLeft className="size-2.5" />}
                      {direction === "expense" && <ArrowUpRight className="size-2.5" />}
                      {direction === "transfer" && <ArrowLeftRight className="size-2.5" />}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">
                        {endpoints.sourceName} → {endpoints.destinationName}
                      </span>
                      {counterpartyCategory && (
                        <Badge
                          variant="secondary"
                          className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0 font-normal text-[10px] text-muted-foreground"
                        >
                          <ExternalProviderIcon
                            icon={counterpartyCategory.icon}
                            fallbackType={counterpartyCategory.categoryType}
                            className="size-2.5"
                          />
                          <span className="max-w-[90px] truncate">{counterpartyCategory.name}</span>
                        </Badge>
                      )}
                      {direction === "transfer" && (
                        <Badge variant="outline" className="px-1 py-0 font-normal text-[10px]">
                          Transfer
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                      <span>{formatTransactionDate(tx.dateTimestampISO)}</span>
                      {tx.comment && (
                        <>
                          <span>•</span>
                          <span className="max-w-[160px] truncate md:max-w-[240px]">{tx.comment}</span>
                        </>
                      )}
                      <MultiTagEditorPopover
                        transaction={tx}
                        knownTags={knownTags}
                        onTagsChange={(newTags) => handleTransactionTagsChange(tx, newTags)}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-3 shrink-0 text-right">
                  <span
                    className={cn(
                      "font-semibold text-sm tabular-nums",
                      isInflowRow && "text-emerald-600 dark:text-emerald-400",
                      isOutflowRow && "text-foreground",
                      !isInflowRow && !isOutflowRow && "text-muted-foreground",
                    )}
                  >
                    {amountText}
                  </span>
                  {balanceText && (
                    <div className="text-muted-foreground text-[11px] tabular-nums">Bal: {balanceText}</div>
                  )}
                </div>
              </div>
            );
          })}

          {hasMoreData && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleLoadMore();
                }}
                disabled={isLoadingMore}
                className="w-full sm:w-auto"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load more transactions</span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
