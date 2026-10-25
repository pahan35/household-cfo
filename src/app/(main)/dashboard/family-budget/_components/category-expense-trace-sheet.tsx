"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import { AlertCircle, ExternalLink, History, Layers, Receipt, RotateCw, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  buildLedgerLink,
  computeAccountBreakdown,
  computePeriodSpendSummary,
  filterTransactionsByAccount,
  identifySubcategoryName,
  resolveCategoryIdsForTrace,
  resolveTransactionSpend,
  sortTransactionsReverseChronological,
} from "./category-expense-trace-helpers";
import { getTransactionPage } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  formatMoney,
  formatTransactionDate,
} from "./external-provider-data";
import { ExternalProviderIcon } from "./external-provider-icons";
import type { ExpenseSlice } from "./expense-transforms";

export interface CategoryExpenseTraceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExpenseSlice | null;
  categories?: ExternalProviderCategory[];
  currencies?: ExternalProviderCurrency[];
  activeMonthDateStr: string;
  baselineResolution?: {
    dateStr: string;
    label: string;
    hasData: boolean;
  } | null;
  defaultCurrency?: string;
}

type PeriodTab = "active" | "baseline" | "combined" | "all-time";

function formatRowDate(tx: ExternalProviderTransaction): string {
  if (tx.dateTimestampISO) {
    return formatTransactionDate(tx.dateTimestampISO);
  }
  if (tx.dateTimestamp) {
    return format(new Date(tx.dateTimestamp), "MMM d, yyyy");
  }
  return "Unknown date";
}

export function CategoryExpenseTraceSheet({
  open,
  onOpenChange,
  category,
  categories = [],
  currencies = [],
  activeMonthDateStr,
  baselineResolution = null,
  defaultCurrency = "PLN",
}: CategoryExpenseTraceSheetProps) {
  const [activeTransactions, setActiveTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [baselineTransactions, setBaselineTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const [allTimeTransactions, setAllTimeTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingAllTime, setIsLoadingAllTime] = useState(false);

  const [periodTab, setPeriodTab] = useState<PeriodTab>("active");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const activePeriod = useMemo(() => {
    const parsed = parseISO(activeMonthDateStr);
    const target = isValid(parsed) ? parsed : new Date(activeMonthDateStr);
    return {
      from: format(startOfMonth(target), "yyyy-MM-dd"),
      to: format(endOfMonth(target), "yyyy-MM-dd"),
      label: format(target, "MMM yyyy"),
    };
  }, [activeMonthDateStr]);

  const baselinePeriod = useMemo(() => {
    if (!baselineResolution?.hasData || !baselineResolution.dateStr) return null;
    const parsed = parseISO(baselineResolution.dateStr);
    const target = isValid(parsed) ? parsed : new Date(baselineResolution.dateStr);
    return {
      from: format(startOfMonth(target), "yyyy-MM-dd"),
      to: format(endOfMonth(target), "yyyy-MM-dd"),
      label: baselineResolution.label || format(target, "MMM yyyy"),
    };
  }, [baselineResolution]);

  const categoryIds = useMemo(() => {
    return resolveCategoryIdsForTrace(category);
  }, [category]);

  const loadTransactions = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      if (!category?.id || categoryIds.length === 0) {
        setActiveTransactions([]);
        setBaselineTransactions([]);
        return;
      }

      setIsLoading(true);
      setFetchError(null);

      try {
        const promises: [
          Promise<{ transactions?: ExternalProviderTransaction[] }>,
          Promise<{ transactions?: ExternalProviderTransaction[] }> | null,
        ] = [
          getTransactionPage({
            period: { from: activePeriod.from, to: activePeriod.to },
            categoryIds,
            take: 200,
            signal,
            forceRefresh,
          }),
          baselinePeriod
            ? getTransactionPage({
                period: { from: baselinePeriod.from, to: baselinePeriod.to },
                categoryIds,
                take: 200,
                signal,
                forceRefresh,
              })
            : null,
        ];

        const [activeRes, baselineRes] = await Promise.all([
          promises[0],
          promises[1] ? promises[1] : Promise.resolve({ transactions: [] }),
        ]);

        setActiveTransactions(activeRes.transactions ?? []);
        setBaselineTransactions(baselineRes.transactions ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError(err instanceof Error ? err : new Error("Failed to load transactions for category"));
      } finally {
        setIsLoading(false);
      }
    },
    [category?.id, categoryIds, activePeriod.from, activePeriod.to, baselinePeriod],
  );

  useEffect(() => {
    if (!open || !category) return;
    const controller = new AbortController();
    void loadTransactions(controller.signal);
    return () => {
      controller.abort();
    };
  }, [open, category, loadTransactions]);

  const loadAllTimeTransactions = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      if (!category?.id || categoryIds.length === 0) {
        setAllTimeTransactions([]);
        return;
      }
      setIsLoadingAllTime(true);
      setFetchError(null);
      try {
        // No period filter: transactions across all years
        const res = await getTransactionPage({ categoryIds, take: 300, signal, forceRefresh });
        setAllTimeTransactions(res.transactions ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError(err instanceof Error ? err : new Error("Failed to load all-time transactions for category"));
      } finally {
        setIsLoadingAllTime(false);
      }
    },
    [category?.id, categoryIds],
  );

  useEffect(() => {
    if (!open || !category || periodTab !== "all-time") return;
    const controller = new AbortController();
    void loadAllTimeTransactions(controller.signal);
    return () => {
      controller.abort();
    };
  }, [open, category, periodTab, loadAllTimeTransactions]);

  // Reset tab and account filter when the inspected category changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on the category id only
  useEffect(() => {
    setPeriodTab("active");
    setSelectedAccountId(null);
    setAllTimeTransactions([]);
  }, [category?.id]);

  const spendSummary = useMemo(() => {
    return computePeriodSpendSummary(
      activeTransactions,
      baselineTransactions,
      defaultCurrency,
      currencies,
      categoryMap,
    );
  }, [activeTransactions, baselineTransactions, defaultCurrency, currencies, categoryMap]);

  const currentDisplaySet = useMemo(() => {
    if (periodTab === "all-time") {
      return allTimeTransactions.map((tx) => ({ ...tx, periodLabel: "All-Time" }));
    }
    if (periodTab === "active") {
      return activeTransactions.map((tx) => ({ ...tx, periodLabel: activePeriod.label }));
    }
    if (periodTab === "baseline" && baselinePeriod) {
      return baselineTransactions.map((tx) => ({ ...tx, periodLabel: baselinePeriod.label }));
    }
    // Combined
    const a = activeTransactions.map((tx) => ({ ...tx, periodLabel: activePeriod.label, isBaseline: false }));
    const b = (baselinePeriod ? baselineTransactions : []).map((tx) => ({
      ...tx,
      periodLabel: baselinePeriod?.label ?? "Baseline",
      isBaseline: true,
    }));
    return [...a, ...b];
  }, [periodTab, activeTransactions, baselineTransactions, allTimeTransactions, activePeriod.label, baselinePeriod]);

  const accountBreakdown = useMemo(() => {
    return computeAccountBreakdown(currentDisplaySet, categoryMap, defaultCurrency, currencies);
  }, [currentDisplaySet, categoryMap, defaultCurrency, currencies]);

  const filteredTransactions = useMemo(() => {
    const subset = filterTransactionsByAccount(currentDisplaySet, selectedAccountId);
    return sortTransactionsReverseChronological(subset);
  }, [currentDisplaySet, selectedAccountId]);

  const categoryDetails = useMemo(() => {
    if (!category) return null;
    return categoryMap.get(category.id);
  }, [category, categoryMap]);

  const ledgerLink = useMemo(() => buildLedgerLink(categoryIds, selectedAccountId), [categoryIds, selectedAccountId]);

  const isLoadingCurrent = periodTab === "all-time" ? isLoadingAllTime : isLoading;

  const currentPeriodTotalSpend = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => acc + resolveTransactionSpend(tx, defaultCurrency, currencies, categoryMap).convertedAmount,
      0,
    );
  }, [filteredTransactions, defaultCurrency, currencies, categoryMap]);

  const displayedHeaderSpend = useMemo(() => {
    if (periodTab === "active") return spendSummary.activeSpend;
    if (periodTab === "baseline") return spendSummary.baselineSpend;
    return currentPeriodTotalSpend;
  }, [periodTab, spendSummary.activeSpend, spendSummary.baselineSpend, currentPeriodTotalSpend]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl"
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ExternalProviderIcon icon={categoryDetails?.icon} fallbackType={CategoryType.Expense} className="size-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SheetTitle className="truncate text-base font-semibold">
                    {category?.name ?? "Category Trace"}
                  </SheetTitle>
                  {category?.isSmartGroup && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      Smart Group
                    </Badge>
                  )}
                </div>
                <SheetDescription className="text-muted-foreground text-xs">
                  Expense transactions breakdown across accounts
                </SheetDescription>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end">
              <span className="text-foreground text-lg font-bold tabular-nums">
                {formatMoney(displayedHeaderSpend, defaultCurrency)}
              </span>

              {baselinePeriod && spendSummary.deltaAbs !== 0 && (
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    spendSummary.deltaAbs > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {spendSummary.deltaAbs > 0 ? "+" : ""}
                  {formatMoney(spendSummary.deltaAbs, defaultCurrency)}
                  {spendSummary.deltaPercent !== null &&
                    ` (${spendSummary.deltaPercent > 0 ? "+" : ""}${spendSummary.deltaPercent.toFixed(0)}%)`}
                  <span className="text-muted-foreground font-normal"> vs {baselinePeriod.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* Period tab controls: active month, optional baseline comparison, and all-time history */}
          <div className="mt-3">
            <Tabs
              value={periodTab}
              onValueChange={(v) => {
                setPeriodTab(v as PeriodTab);
                setSelectedAccountId(null);
              }}
            >
              <TabsList className={cn("grid h-8 w-full", baselinePeriod ? "grid-cols-4" : "grid-cols-2")}>
                <TabsTrigger value="active" className="text-xs">
                  {activePeriod.label} ({formatMoney(spendSummary.activeSpend, defaultCurrency)})
                </TabsTrigger>
                {baselinePeriod && (
                  <TabsTrigger value="baseline" className="text-xs">
                    {baselinePeriod.label} ({formatMoney(spendSummary.baselineSpend, defaultCurrency)})
                  </TabsTrigger>
                )}
                {baselinePeriod && (
                  <TabsTrigger value="combined" className="gap-1 text-xs">
                    <Layers className="size-3" />
                    Side-by-Side
                  </TabsTrigger>
                )}
                <TabsTrigger value="all-time" className="gap-1 text-xs">
                  <History className="size-3" />
                  All-Time History
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Account Filter Chips Strip */}
          <div className="bg-muted/30 border-b px-6 py-2.5">
            <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-muted-foreground mr-1 shrink-0 text-[11px] font-medium">Accounts:</span>

              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedAccountId === null
                    ? "bg-foreground text-background border-foreground shadow-xs"
                    : "bg-background text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span>All Accounts</span>
                <span className="tabular-nums opacity-80">
                  ({accountBreakdown.allTransactionCount}) •{" "}
                  {formatMoney(accountBreakdown.allTotalSpend, defaultCurrency)}
                </span>
              </button>

              {accountBreakdown.accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.accountId;
                const chip = (
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(isSelected ? null : acc.accountId)}
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-foreground text-background border-foreground shadow-xs"
                        : "bg-background text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Wallet className="size-3 shrink-0" />
                    <span>{acc.accountName}</span>
                    <span className="tabular-nums opacity-80">
                      ({acc.transactionCount}) • {formatMoney(acc.totalSpend, defaultCurrency)}
                    </span>
                  </button>
                );

                if (acc.hasForeignSpend && acc.nativeSpend && acc.nativeCurrency) {
                  return (
                    <TooltipProvider key={acc.accountId} delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>{chip}</TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <span>Native: {formatMoney(acc.nativeSpend, acc.nativeCurrency)}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }

                return <div key={acc.accountId}>{chip}</div>;
              })}
            </div>
          </div>

          {/* Transaction List / Loading / Empty State */}
          <ScrollArea className="flex-1 px-6">
            <div className="py-4">
              {isLoadingCurrent && (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border-border/40 flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-lg" />
                        <div className="flex flex-col gap-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              )}

              {fetchError && !isLoadingCurrent && (
                <div className="border-destructive/20 bg-destructive/5 text-destructive my-6 flex flex-col items-center justify-center gap-2 rounded-lg border p-6 text-center">
                  <AlertCircle className="size-8" />
                  <p className="text-sm font-medium">{fetchError.message}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void (periodTab === "all-time"
                        ? loadAllTimeTransactions(undefined, true)
                        : loadTransactions(undefined, true))
                    }
                    className="mt-2 gap-1.5 text-xs"
                  >
                    <RotateCw className="size-3.5" />
                    Retry
                  </Button>
                </div>
              )}

              {!isLoadingCurrent && !fetchError && filteredTransactions.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                    <Receipt className="size-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-foreground text-sm font-medium">No transactions found</p>
                    <p className="text-muted-foreground max-w-xs text-xs">
                      {selectedAccountId
                        ? "No expenses found for this specific paying account. Try selecting All Accounts."
                        : `No expenses recorded for ${category?.name ?? "this category"} ${periodTab === "all-time" ? "across all time" : "in the inspected period"}.`}
                    </p>
                  </div>
                  {selectedAccountId && (
                    <Button size="sm" variant="outline" onClick={() => setSelectedAccountId(null)} className="text-xs">
                      Clear account filter
                    </Button>
                  )}
                  {periodTab !== "all-time" && !selectedAccountId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPeriodTab("all-time")}
                      className="gap-1.5 text-xs"
                    >
                      <History className="size-3" />
                      View all-time history
                    </Button>
                  )}
                </div>
              )}

              {!isLoadingCurrent && !fetchError && filteredTransactions.length > 0 && (
                <div className="divide-border/60 flex flex-col divide-y">
                  {filteredTransactions.map((tx) => {
                    const resolvedSpend = resolveTransactionSpend(tx, defaultCurrency, currencies, categoryMap);
                    const accountCategory = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
                    const accountName = accountCategory?.name ?? tx.sourceName ?? "Unknown Account";

                    const subcategoryName = identifySubcategoryName(tx.destinationId, category?.children, categoryMap);

                    const dateDisplay = formatRowDate(tx);

                    const periodLabel = (tx as { periodLabel?: string }).periodLabel;
                    const isBaselineTx = (tx as { isBaseline?: boolean }).isBaseline;

                    return (
                      <div
                        key={tx.id}
                        className="hover:bg-muted/20 flex items-start justify-between gap-3 py-3 transition-colors"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                            <ExternalProviderIcon
                              icon={accountCategory?.icon}
                              fallbackType={CategoryType.Account}
                              className="size-4"
                            />
                          </div>

                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-foreground text-xs font-medium">{accountName}</span>

                              {subcategoryName && subcategoryName !== category?.name && (
                                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                                  {subcategoryName}
                                </Badge>
                              )}

                              {periodTab === "combined" && periodLabel && (
                                <Badge
                                  variant={isBaselineTx ? "outline" : "default"}
                                  className={cn(
                                    "h-4 px-1.5 text-[9px] font-normal",
                                    isBaselineTx ? "text-muted-foreground" : "bg-primary/90",
                                  )}
                                >
                                  {periodLabel}
                                </Badge>
                              )}
                            </div>

                            <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                              <span>{dateDisplay}</span>
                              {tx.comment && (
                                <>
                                  <span>•</span>
                                  <span className="text-foreground/80 max-w-[200px] truncate sm:max-w-xs">
                                    {tx.comment}
                                  </span>
                                </>
                              )}
                            </div>

                            {Array.isArray(tx.tags) && tx.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {tx.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px]"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end">
                          <span className="text-foreground text-sm font-semibold tabular-nums">
                            -{formatMoney(resolvedSpend.convertedAmount, defaultCurrency)}
                          </span>

                          {resolvedSpend.isConverted && resolvedSpend.nativeCurrency !== defaultCurrency && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground hover:text-foreground cursor-help text-[11px] font-normal tabular-nums underline decoration-dotted underline-offset-2">
                                    {formatMoney(resolvedSpend.nativeAmount, resolvedSpend.nativeCurrency)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">Foreign Currency Conversion</span>
                                    <span className="text-muted-foreground text-[11px]">
                                      {formatMoney(resolvedSpend.nativeAmount, resolvedSpend.nativeCurrency)} @{" "}
                                      {resolvedSpend.rate ? resolvedSpend.rate.toFixed(4) : "—"} ={" "}
                                      {formatMoney(resolvedSpend.convertedAmount, defaultCurrency)}
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <SheetFooter className="bg-muted/20 border-t px-6 py-3">
          <div className="flex w-full items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Showing {filteredTransactions.length} of {currentDisplaySet.length} transactions
            </span>

            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link href={ledgerLink} onClick={() => onOpenChange(false)}>
                <span>Open in Ledger</span>
                <ExternalLink className="size-3" />
              </Link>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
