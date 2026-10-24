"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Loader2, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getTransactionPage } from "./external-provider-client";
import { CategoryType, type ExternalProviderTransaction, formatMoney, formatTransactionDate } from "./external-provider-data";
import { SectionShell } from "./section-shell";

interface RecentTransactionsCardProps {
  defaultCurrency?: string;
  periodFilter?: { from?: string | null; to?: string | null };
}

export function RecentTransactionsCard({ defaultCurrency = "PLN", periodFilter }: RecentTransactionsCardProps) {
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [hasMoreData, setHasMoreData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const PAGE_SIZE = 20;

  const fetchInitialPage = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await getTransactionPage({
          skip: 0,
          take: PAGE_SIZE,
          period: periodFilter,
          signal,
        });
        setTransactions(page.transactions ?? []);
        setHasMoreData(Boolean(page.hasMoreData));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err : new Error("Failed to load transactions"));
      } finally {
        setIsLoading(false);
      }
    },
    [periodFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchInitialPage(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchInitialPage]);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMoreData) return;
    setIsLoadingMore(true);
    try {
      const page = await getTransactionPage({
        skip: transactions.length,
        take: PAGE_SIZE,
        period: periodFilter,
      });

      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = (page.transactions ?? []).filter((t) => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });
      setHasMoreData(Boolean(page.hasMoreData));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load more transactions"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  function getDirection(tx: ExternalProviderTransaction): "income" | "expense" | "transfer" {
    const src = Number(tx.sourceType);
    const dst = Number(tx.destinationType);

    const isSrcAccount = src === CategoryType.Account || src === CategoryType.BankAccount;
    const isDstAccount = dst === CategoryType.Account || dst === CategoryType.BankAccount;

    if (src === CategoryType.Income) {
      return "income";
    }
    if (dst === CategoryType.Expense) {
      return "expense";
    }
    if (isSrcAccount && isDstAccount) {
      return "transfer";
    }
    if (isDstAccount && !isSrcAccount) {
      return "income";
    }
    return "expense";
  }

  function getDirectionPrefix(dir: "income" | "expense" | "transfer"): string {
    if (dir === "income") return "+";
    if (dir === "expense") return "-";
    return "";
  }

  const sortedTransactions = useMemo(() => {
    // Already newest-first from ExternalProvider, but sort by dateTimestampISO descending as safety
    return [...transactions].sort((a, b) => {
      const dateA = a.dateTimestampISO ? new Date(a.dateTimestampISO).getTime() : 0;
      const dateB = b.dateTimestampISO ? new Date(b.dateTimestampISO).getTime() : 0;
      return dateB - dateA;
    });
  }, [transactions]);

  return (
    <SectionShell
      title="Recent Transactions"
      description="Chronological stream of household income, spending, and transfers"
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void fetchInitialPage();
      }}
      isEmpty={sortedTransactions.length === 0}
      emptyTitle="No transactions found"
      emptyDescription="No transactions recorded for the selected period."
      emptyIcon={<Receipt className="size-6 text-muted-foreground" />}
      skeletonCount={5}
      skeletonHeight="h-12"
    >
      <div className="flex flex-col divide-y divide-border/60">
        {sortedTransactions.map((tx) => {
          const direction = getDirection(tx);
          const rawAmount = Math.abs(Number(tx.defaultAmount ?? tx.destinationAmount ?? tx.sourceAmount ?? 0));
          const currency = tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency;

          let counterpartTitle = tx.destinationName ?? tx.sourceName ?? "Transaction";
          let counterpartSubtitle = tx.sourceName;
          if (direction === "income") {
            counterpartTitle = tx.sourceName ?? "Income";
            counterpartSubtitle = tx.destinationName ? `To: ${tx.destinationName}` : undefined;
          } else if (direction === "transfer") {
            counterpartTitle = `${tx.sourceName ?? "Account"} → ${tx.destinationName ?? "Account"}`;
            counterpartSubtitle = "Internal transfer";
          } else if (tx.sourceName && tx.destinationName) {
            counterpartSubtitle = `From: ${tx.sourceName}`;
          }

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
                    <span className="truncate font-medium text-sm">{counterpartTitle}</span>
                    {tx.comment && (
                      <span className="max-w-[160px] truncate text-muted-foreground text-xs md:max-w-[240px]">
                        • {tx.comment}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>{formatTransactionDate(tx.dateTimestampISO)}</span>
                    {counterpartSubtitle && (
                      <>
                        <span>•</span>
                        <span className="truncate">{counterpartSubtitle}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="ml-3 shrink-0 text-right">
                <span
                  className={cn(
                    "font-semibold text-sm",
                    direction === "income" && "text-emerald-600 dark:text-emerald-400",
                    direction === "expense" && "text-foreground",
                    direction === "transfer" && "text-muted-foreground",
                  )}
                >
                  {getDirectionPrefix(direction)}
                  {formatMoney(rawAmount, currency)}
                </span>
                {direction === "transfer" && (
                  <div>
                    <Badge variant="outline" className="px-1 py-0 font-normal text-[10px]">
                      Transfer
                    </Badge>
                  </div>
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
                <span>Load older transactions</span>
              )}
            </Button>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
