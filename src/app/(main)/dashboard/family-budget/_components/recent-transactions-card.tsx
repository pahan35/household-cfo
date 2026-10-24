"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Loader2, Receipt, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getTransactionPage } from "./external-provider-client";
import {
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  computeTransactionsWithRunningBalance,
  formatMoney,
  formatTransactionDate,
} from "./external-provider-data";
import { SectionShell } from "./section-shell";

interface RecentTransactionsCardProps {
  defaultCurrency?: string;
  categories?: ExternalProviderCategory[];
  selectedAccountId?: string | null;
  onClearAccountFilter?: () => void;
  periodFilter?: { from?: string | null; to?: string | null };
  initialTransactions?: ExternalProviderTransaction[];
  initialHasMoreData?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const PAGE_SIZE = 20;

export function RecentTransactionsCard({
  defaultCurrency = "PLN",
  categories = [],
  selectedAccountId = null,
  onClearAccountFilter,
  periodFilter,
  initialTransactions,
  initialHasMoreData = false,
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
}: RecentTransactionsCardProps) {
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>(initialTransactions ?? []);
  const [hasMoreData, setHasMoreData] = useState(initialHasMoreData);
  const [internalIsLoading, setInternalIsLoading] = useState(initialTransactions === undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [internalError, setInternalError] = useState<Error | null>(null);

  const isControlled = initialTransactions !== undefined;
  const isLoading = isControlled ? (controlledIsLoading ?? false) : internalIsLoading;
  const error = controlledError ?? internalError;

  const selectedAccount = useMemo(
    () => (selectedAccountId ? categories.find((c) => c.id === selectedAccountId) : undefined),
    [categories, selectedAccountId],
  );

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
          period: periodFilter,
          categoryIds: selectedAccountId ? [selectedAccountId] : undefined,
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
    [periodFilter, selectedAccountId],
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

  async function handleLoadMore() {
    if (isLoadingMore || !hasMoreData) return;
    setIsLoadingMore(true);
    try {
      const page = await getTransactionPage({
        skip: transactions.length,
        take: PAGE_SIZE,
        period: periodFilter,
        categoryIds: selectedAccountId ? [selectedAccountId] : undefined,
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

  const rows = useMemo(
    () => computeTransactionsWithRunningBalance(transactions, categories, defaultCurrency),
    [transactions, categories, defaultCurrency],
  );

  return (
    <SectionShell
      title="Transactions"
      description={
        selectedAccount
          ? `All-time history for ${selectedAccount.name}`
          : "All-time stream of household income, spending, and transfers"
      }
      action={
        selectedAccountId ? (
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={onClearAccountFilter}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <span className="max-w-[140px] truncate">{selectedAccount?.name ?? "Account"}</span>
            {selectedAccount && (
              <span className="text-muted-foreground tabular-nums">
                {formatMoney(
                  Number(selectedAccount.currentAmount ?? selectedAccount.amount) || 0,
                  selectedAccount.currencyId || defaultCurrency,
                )}
              </span>
            )}
            <X className="size-3" />
            <span className="sr-only">Clear filter</span>
          </Button>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={handleRetry}
      isEmpty={rows.length === 0}
      emptyTitle="No transactions found"
      emptyDescription={
        selectedAccountId ? "No transactions recorded for the selected account." : "No transactions recorded yet."
      }
      emptyIcon={<Receipt className="size-6 text-muted-foreground" />}
      skeletonCount={5}
      skeletonHeight="h-12"
    >
      <div className="flex flex-col divide-y divide-border/60">
        {rows.map((row) => {
          const { tx, endpoints, direction } = row;

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
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    direction === "income" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    direction === "expense" && "bg-muted text-muted-foreground",
                    direction === "transfer" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  )}
                >
                  {direction === "income" && <ArrowDownLeft className="size-4" />}
                  {direction === "expense" && <ArrowUpRight className="size-4" />}
                  {direction === "transfer" && <ArrowLeftRight className="size-4" />}
                </div>

                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-sm">
                      {endpoints.sourceName} → {endpoints.destinationName}
                    </span>
                    {direction === "transfer" && (
                      <Badge variant="outline" className="px-1 py-0 font-normal text-[10px]">
                        Transfer
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>{formatTransactionDate(tx.dateTimestampISO)}</span>
                    {tx.comment && (
                      <>
                        <span>•</span>
                        <span className="max-w-[160px] truncate md:max-w-[240px]">{tx.comment}</span>
                      </>
                    )}
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
    </SectionShell>
  );
}
