"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";
import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Repeat,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatMoney } from "../../_components/external-provider-data";
import {
  computeLearningMetrics,
  getConvertedTransactionAmount,
  getTransactionDate,
  type LearningFacetMetric,
  normalizeLifestyleTag,
} from "../../_components/lifestyle-transforms";
import { MoneyValue } from "../../_components/money-value";
import { SectionShell } from "../../_components/section-shell";
import { useLifestyleData } from "../use-lifestyle-data";

function getFacetIcon(tag: string) {
  switch (tag) {
    case "platform":
      return <Repeat className="size-4" />;
    case "cert":
      return <Award className="size-4" />;
    case "course":
      return <GraduationCap className="size-4" />;
    case "tutor":
      return <Users className="size-4" />;
    case "books":
      return <BookOpen className="size-4" />;
    default:
      return <Layers className="size-4" />;
  }
}

function getFacetColorClass(tag: string) {
  switch (tag) {
    case "platform":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "cert":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "course":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    case "tutor":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "books":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function LearningDashboard() {
  const { categoryMap, currencies, transactions, defaultCurrency } = useLifestyleData();

  const [selectedFacet, setSelectedFacet] = useState<string | null>(null);

  // Compute learning metrics
  const learningMetrics = useMemo(() => {
    return computeLearningMetrics({
      transactions,
      categories: categoryMap,
      currencies,
      defaultCurrency,
    });
  }, [transactions, categoryMap, currencies, defaultCurrency]);

  // Filtered transactions for the ledger
  const filteredTxs = useMemo(() => {
    if (!selectedFacet) return learningMetrics.transactions;

    return learningMetrics.transactions.filter((tx) => {
      const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
      const cleanTags = rawTags.map(normalizeLifestyleTag);

      if (selectedFacet === "platform") {
        return cleanTags.includes("platform") || cleanTags.includes("sub") || cleanTags.includes("subscription");
      }
      if (selectedFacet === "cert") {
        return cleanTags.includes("cert") || cleanTags.includes("certification") || cleanTags.includes("exam");
      }
      if (selectedFacet === "course") {
        return cleanTags.includes("course") || cleanTags.includes("bootcamp");
      }
      if (selectedFacet === "tutor") {
        return cleanTags.includes("tutor") || cleanTags.includes("mentor");
      }
      if (selectedFacet === "books") {
        return cleanTags.includes("book") || cleanTags.includes("books");
      }
      return true;
    });
  }, [learningMetrics.transactions, selectedFacet]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <GraduationCap className="size-3.5 text-indigo-500" />
            <span>Total Learning Spend</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(learningMetrics.totalSpend, defaultCurrency)}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {learningMetrics.transactions.length} learning transactions
          </span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Repeat className="size-3.5 text-sky-500" />
            <span>Monthly Subscription Run-Rate</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(learningMetrics.monthlyRunRate, defaultCurrency)}
            <span className="font-normal text-muted-foreground text-xs"> / mo</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Platform run-rate (90-day avg)</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Layers className="size-3.5 text-purple-500" />
            <span>Active Facets</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">{learningMetrics.facets.length}</div>
          <span className="text-[10px] text-muted-foreground">Platform, Cert, Course, Tutor, Books</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Sparkles className="size-3.5 text-emerald-500" />
            <span>Growth Focus</span>
          </div>
          <div className="mt-1 font-bold text-foreground text-sm">
            {learningMetrics.facets[0]?.label.split("&")[0].trim() ?? "General"}
          </div>
          <span className="text-[10px] text-muted-foreground">Highest share category</span>
        </div>
      </div>

      {/* 2. Facet Breakdown Grid */}
      <SectionShell
        title="Learning Facets &amp; Streams"
        description="Categorized by #platform, #cert, #course, #tutor, and #books with relative spending shares"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {learningMetrics.facets.map((facet) => {
            const isSelected = selectedFacet === facet.facetTag;
            const Icon = getFacetIcon(facet.facetTag);
            const colorClass = getFacetColorClass(facet.facetTag);

            return (
              <button
                key={facet.facetTag}
                type="button"
                onClick={() => setSelectedFacet(isSelected ? null : facet.facetTag)}
                className={`flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${colorClass}`}>{Icon}</div>
                      <div>
                        <span className="font-semibold text-foreground text-xs">{facet.label}</span>
                        <span className="block text-[10px] text-muted-foreground">#{facet.facetTag}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
                      {facet.percentage}%
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-bold font-mono text-foreground text-base">
                      {formatMoney(facet.totalCost, defaultCurrency)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {facet.transactionCount} {facet.transactionCount === 1 ? "tx" : "txs"}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-muted-foreground">
                  {isSelected ? "Click to deselect" : "Click to filter transaction ledger"}
                </div>
              </button>
            );
          })}
        </div>
      </SectionShell>

      {/* 3. Filtered Learning Transaction Ledger */}
      <SectionShell
        title="Learning Transactions"
        description={
          selectedFacet
            ? `Filtered by #${selectedFacet} (${filteredTxs.length} transactions)`
            : `All learning and education transactions (${filteredTxs.length})`
        }
        action={
          selectedFacet ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFacet(null)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filter
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {filteredTxs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No transactions recorded in Learning. Tag education transactions with #platform, #cert, #course, #tutor,
              or #books.
            </div>
          ) : (
            filteredTxs.map((tx) => {
              const txDate = format(getTransactionDate(tx), "yyyy-MM-dd");
              const { nativeAmount, currency, convertedAmount } = getConvertedTransactionAmount(
                tx,
                defaultCurrency,
                currencies,
              );
              const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];

              return (
                <div key={tx.id} className="flex items-center justify-between p-3 text-xs hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{txDate}</span>
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                        <span>{tx.destinationName ?? "Learning"}</span>
                        {tx.comment && (
                          <span className="text-muted-foreground truncate font-normal">({tx.comment})</span>
                        )}
                      </div>

                      {rawTags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {rawTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <MoneyValue
                    mode="rollup"
                    amount={nativeAmount}
                    currency={currency}
                    convertedAmount={convertedAmount}
                    reportingCurrency={defaultCurrency}
                    size="sm"
                  />
                </div>
              );
            })
          )}
        </div>
      </SectionShell>
    </div>
  );
}
