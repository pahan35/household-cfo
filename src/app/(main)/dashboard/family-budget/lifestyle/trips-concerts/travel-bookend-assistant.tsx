"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Compass, Loader2, Palmtree, Plane, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { ExternalProviderCategory, ExternalProviderTransaction } from "../../_components/external-provider-data";
import { ExternalProviderIcon } from "../../_components/external-provider-icons";
import { resolveCategoryCurrency } from "../../_components/external-provider-money";
import { getConvertedTransactionAmount, getTransactionDate } from "../../_components/lifestyle-transforms";
import { MoneyValue } from "../../_components/money-value";
import { useLifestyleData } from "../use-lifestyle-data";

export interface CandidateScore {
  score: number;
  reasons: string[];
}

const LODGING_KEYWORDS = [
  "hotel",
  "hostel",
  "airbnb",
  "booking",
  "lodging",
  "stay",
  "resort",
  "motel",
  "apartment",
  "nocleg",
  "apartament",
];

const FLIGHT_KEYWORDS = [
  "flight",
  "airline",
  "airport",
  "ryanair",
  "wizz",
  "lot",
  "lufthansa",
  "plane",
  "fly",
  "airways",
  "lotnisko",
  "samolot",
];

const TRANSIT_KEYWORDS = [
  "transit",
  "train",
  "railway",
  "pkp",
  "bus",
  "uber",
  "bolt",
  "taxi",
  "transport",
  "ferry",
  "toll",
  "subway",
  "metro",
  "pociag",
  "autobus",
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Evaluates a transaction's likelihood of being a travel boundary (trip start or end)
 * by checking for foreign currency charges, transport & lodging categories/comments,
 * and travel-related tags.
 */
export function scoreBoundaryCandidate(
  tx: ExternalProviderTransaction,
  defaultCurrency: string,
  categoryMap: Map<string, ExternalProviderCategory>,
): CandidateScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Foreign currency check (inspect both destination category and source account)
  const normDefault = defaultCurrency.trim().toUpperCase() || "PLN";
  const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
  const sourceCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;

  const destCurrency =
    tx.destinationCurrencyId && tx.destinationCurrencyId.trim().length > 0
      ? tx.destinationCurrencyId.trim().toUpperCase()
      : resolveCategoryCurrency(destCat, normDefault);

  const sourceCurrency =
    tx.sourceCurrencyId && tx.sourceCurrencyId.trim().length > 0
      ? tx.sourceCurrencyId.trim().toUpperCase()
      : resolveCategoryCurrency(sourceCat, normDefault);

  const isForeignDest = destCurrency !== normDefault;
  const isForeignSource = sourceCurrency !== normDefault;

  if (isForeignDest || isForeignSource) {
    score += 40;
    const foreignCode = isForeignDest ? destCurrency : sourceCurrency;
    reasons.push(`Foreign Currency (${foreignCode})`);
  }

  // 2. Keyword check across category names and comments
  const catNames = `${destCat?.name ?? ""} ${sourceCat?.name ?? ""}`.toLowerCase();
  const comment = (tx.comment ?? "").toLowerCase();
  const textToSearch = `${catNames} ${comment}`;

  const hasFlight = FLIGHT_KEYWORDS.some((kw) => textToSearch.includes(kw));
  const hasLodging = LODGING_KEYWORDS.some((kw) => textToSearch.includes(kw));
  const hasTransit = TRANSIT_KEYWORDS.some((kw) => textToSearch.includes(kw));

  if (hasFlight) {
    score += 50;
    reasons.push("Flights / Airline");
  } else if (hasLodging) {
    score += 45;
    reasons.push("Lodging / Hotel");
  } else if (hasTransit) {
    score += 35;
    reasons.push("Transit / Transport");
  }

  // 3. Existing travel tag check
  const tags = Array.isArray(tx.tags) ? tx.tags.map((t) => t.toLowerCase()) : [];
  if (tags.some((t) => t.includes("travel") || t.includes("trip") || t.includes("vacation"))) {
    score += 30;
    reasons.push("Existing Travel Tag");
  }

  return { score, reasons };
}

/**
 * Merges travel bookend (#travel or #end-travel) and destination tags onto a transaction's tags array.
 * Removes conflicting bookends to ensure clean episode boundaries.
 */
export function applyBookendTags(
  currentTags: string[] | undefined | null,
  bookend: "start" | "end",
  destinationTag: string,
): string[] {
  const normDest = destinationTag.trim().replace(/^#+/, "").toLowerCase();
  const destTagWithHash = normDest ? `#${normDest}` : "";
  const bookendTag = bookend === "start" ? "#travel" : "#end-travel";
  const conflictingBookend = bookend === "start" ? "#end-travel" : "#travel";

  const cleanList = (currentTags ?? [])
    .map((t) => {
      const clean = t.trim().replace(/^#+/, "").toLowerCase();
      return clean ? `#${clean}` : "";
    })
    .filter((t): t is string => Boolean(t) && t !== conflictingBookend);

  const resultSet = new Set<string>(cleanList);
  resultSet.add(bookendTag);
  if (destTagWithHash) {
    resultSet.add(destTagWithHash);
  }

  return Array.from(resultSet);
}

/**
 * Filters transactions within the specified date boundaries (inclusive).
 */
export function filterTransactionsByDateRange(
  transactions: ExternalProviderTransaction[],
  fromDate: Date,
  toDate: Date,
): ExternalProviderTransaction[] {
  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();

  return transactions.filter((tx) => {
    if (tx.deleted) return false;
    const txDate = getTransactionDate(tx);
    const time = txDate.getTime();
    return time >= fromTime && time <= toTime;
  });
}

export interface TravelBookendAssistantProps {
  className?: string;
  defaultDestinationTag?: string;
}

export function TravelBookendAssistant({ className, defaultDestinationTag = "" }: TravelBookendAssistantProps) {
  const { transactions, categoryMap, currencies, defaultCurrency, updateTxTags } = useLifestyleData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => currentDate.getFullYear());
  const [destinationTag, setDestinationTag] = useState(defaultDestinationTag);
  const [showOnlyScored, setShowOnlyScored] = useState(true);
  const [submittingTxId, setSubmittingTxId] = useState<string | null>(null);

  // Month navigation
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);

  const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));

  const handleOpenChange = (open: boolean) => {
    setIsPickerOpen(open);
    if (open) {
      setPickerYear(currentDate.getFullYear());
    }
  };

  const handleSelectMonth = (monthIndex: number) => {
    setCurrentDate(new Date(pickerYear, monthIndex, 1));
    setIsPickerOpen(false);
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setPickerYear(today.getFullYear());
    setIsPickerOpen(false);
  };

  // Transactions in current month
  const scoredCandidates = useMemo(() => {
    const monthTxs = filterTransactionsByDateRange(transactions, monthStart, monthEnd);

    const scored = monthTxs.map((tx) => {
      const txDate = getTransactionDate(tx);
      const { score, reasons } = scoreBoundaryCandidate(tx, defaultCurrency, categoryMap);
      return { tx, txDate, score, reasons };
    });

    if (showOnlyScored) {
      return scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.txDate.getTime() - a.txDate.getTime());
    }

    return scored.sort((a, b) => b.txDate.getTime() - a.txDate.getTime());
  }, [transactions, monthStart, monthEnd, showOnlyScored, defaultCurrency, categoryMap]);

  const handleMarkBookend = async (tx: ExternalProviderTransaction, bookend: "start" | "end") => {
    if (!destinationTag.trim()) {
      toast.error("Please provide a destination tag (e.g. #austria) before marking bookends");
      return;
    }

    setSubmittingTxId(tx.id);
    const newTags = applyBookendTags(tx.tags, bookend, destinationTag);

    try {
      await updateTxTags(tx, newTags);
      const actionName = bookend === "start" ? "Trip Start (#travel)" : "Trip End (#end-travel)";
      toast.success(`Marked as ${actionName} with #${destinationTag.trim().replace(/^#+/, "")}`);
    } catch {
      // toast error is already surfaced by updateTxTags
    } finally {
      setSubmittingTxId(null);
    }
  };

  return (
    <Card className={cn("border bg-card shadow-xs", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Compass className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Travel Bookend Assistant</CardTitle>
              <CardDescription className="text-xs">
                Jump to historical vacation months, inspect candidate boundary expenses, and mark #travel or
                #end-travel.
              </CardDescription>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <Popover open={isPickerOpen} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 font-mono text-xs font-semibold hover:bg-muted"
                  aria-label="Select month and year"
                >
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>{format(currentDate, "MMMM yyyy")}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="center">
                <div className="flex flex-col gap-2">
                  {/* Year Stepper */}
                  <div className="flex items-center justify-between pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setPickerYear((y) => y - 1)}
                      aria-label="Previous year"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <span className="font-semibold text-xs font-mono">{pickerYear}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setPickerYear((y) => y + 1)}
                      aria-label="Next year"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>

                  {/* 3x4 Month Grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTH_NAMES.map((m, idx) => {
                      const isSelected = currentDate.getFullYear() === pickerYear && currentDate.getMonth() === idx;
                      return (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "h-7 text-xs font-normal",
                            isSelected && "bg-primary text-primary-foreground font-semibold",
                          )}
                          onClick={() => handleSelectMonth(idx)}
                        >
                          {m}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Jump to Today Shortcut */}
                  <div className="border-t pt-2 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleJumpToToday}
                    >
                      Jump to Today
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Destination Tag and Filter Settings Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t pt-3 text-xs">
          <div className="flex items-center gap-2">
            <label
              htmlFor="travel-dest-tag"
              className="flex items-center gap-1 font-medium text-muted-foreground text-[11px]"
            >
              <Tag className="size-3" />
              <span>Destination tag:</span>
            </label>
            <Input
              id="travel-dest-tag"
              placeholder="e.g. austria, malediwy"
              value={destinationTag}
              onChange={(e) => setDestinationTag(e.target.value)}
              className="h-7 w-44 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant={showOnlyScored ? "secondary" : "ghost"}
              onClick={() => setShowOnlyScored((prev) => !prev)}
              className="h-7 text-[11px]"
            >
              <Sparkles className="mr-1 size-3 text-amber-500" />
              {showOnlyScored ? "Showing Boundary Candidates" : "Showing All Month Txs"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {scoredCandidates.length} {scoredCandidates.length === 1 ? "transaction" : "transactions"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {scoredCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            {showOnlyScored
              ? 'No high-scoring boundary transactions found for this month. Toggle "Showing All Month Txs" to inspect every transaction.'
              : "No transactions found recorded in this month."}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {scoredCandidates.map(({ tx, txDate, score, reasons }) => {
              const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
              const isSubmitting = submittingTxId === tx.id;
              const hasStart =
                Array.isArray(tx.tags) &&
                tx.tags.some((t) => t.toLowerCase().includes("travel") && !t.toLowerCase().includes("end-travel"));
              const hasEnd = Array.isArray(tx.tags) && tx.tags.some((t) => t.toLowerCase().includes("end-travel"));

              return (
                <div key={tx.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ExternalProviderIcon
                        icon={destCat?.icon}
                        fallbackType={destCat?.categoryType}
                        className="size-4"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{format(txDate, "yyyy-MM-dd")}</span>
                        <span className="font-medium text-xs text-foreground">
                          {destCat?.name ?? tx.destinationName ?? "Expense"}
                        </span>
                        {score > 0 && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-normal"
                          >
                            Score {score}
                          </Badge>
                        )}
                      </div>

                      {tx.comment && (
                        <p className="max-w-md truncate text-[11px] text-muted-foreground">{tx.comment}</p>
                      )}

                      {/* Reasons & Existing Tags */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.2 text-[10px] text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                        {Array.isArray(tx.tags) &&
                          tx.tags.map((t) => (
                            <Badge key={t} variant="outline" className="px-1 py-0 text-[10px] font-normal">
                              {t}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      {(() => {
                        const { nativeAmount, currency, convertedAmount } = getConvertedTransactionAmount(
                          tx,
                          defaultCurrency,
                          currencies,
                          categoryMap,
                        );
                        return (
                          <MoneyValue
                            amount={nativeAmount}
                            currency={currency}
                            convertedAmount={convertedAmount}
                            reportingCurrency={defaultCurrency}
                            currencies={currencies}
                            mode="ledger"
                            size="sm"
                          />
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant={hasStart ? "secondary" : "outline"}
                        disabled={isSubmitting}
                        onClick={() => void handleMarkBookend(tx, "start")}
                        className={cn(
                          "h-7 gap-1 px-2 text-[11px]",
                          hasStart && "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400",
                        )}
                      >
                        {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : <Plane className="size-3" />}
                        <span>Trip Start</span>
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        variant={hasEnd ? "secondary" : "outline"}
                        disabled={isSubmitting}
                        onClick={() => void handleMarkBookend(tx, "end")}
                        className={cn(
                          "h-7 gap-1 px-2 text-[11px]",
                          hasEnd && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : <Palmtree className="size-3" />}
                        <span>Trip End</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
