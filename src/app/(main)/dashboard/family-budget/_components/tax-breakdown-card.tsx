"use client";

import { useMemo } from "react";

import { cn } from "cn";
import { ArrowDownRight, Layers, Percent, Receipt, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { formatMoney } from "./external-provider-data";
import { SectionShell } from "./section-shell";
import type { TagTaxAggregate, TaxBreakdownResult } from "./tax-transforms";

export interface TaxBreakdownCardProps {
  taxBreakdown: TaxBreakdownResult;
  grossIncome: number;
  netDisposableIncome: number;
  effectiveTaxRate: number;
  currency?: string;
  selectedTagId?: string | null;
  onSelectTag?: (tagId: string | null) => void;
  isLoading?: boolean;
}

export function TaxBreakdownCard({
  taxBreakdown,
  grossIncome,
  netDisposableIncome,
  effectiveTaxRate,
  currency = "PLN",
  selectedTagId = null,
  onSelectTag,
  isLoading = false,
}: TaxBreakdownCardProps) {
  const { totalTaxesConverted, byTag, untaggedCount, untaggedTotalConverted } = taxBreakdown;

  const tagColorMap: Record<string, { bg: string; text: string; bar: string }> = {
    pit: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
    zus: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
    health: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
    vat: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
    "capital-gains": { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
    other: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  };

  return (
    <SectionShell
      title="Tax Deductions by Tag"
      description="Breakdown of outgoing taxes grouped by transaction tags (#pit, #zus, #health, etc.)"
      action={
        !isLoading && totalTaxesConverted > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Effective: {effectiveTaxRate.toFixed(1)}%
            </Badge>
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Total Tax: </span>
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                -{formatMoney(totalTaxesConverted, currency)}
              </span>
            </div>
          </div>
        ) : undefined
      }
      isLoading={isLoading}
      isEmpty={totalTaxesConverted === 0}
      emptyTitle="No tax payments recorded"
      emptyDescription="No outgoing tax payments found for the selected period."
      emptyIcon={<Receipt className="text-muted-foreground size-6" />}
      skeletonCount={3}
    >
      <div className="flex flex-col gap-4">
        {/* Waterfall Progress Bar */}
        {totalTaxesConverted > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Tax Distribution</span>
              <span>100% of deductions</span>
            </div>
            <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
              {byTag.map((item) => {
                const color = tagColorMap[item.tagId] ?? { bar: "bg-primary" };
                return (
                  <div
                    key={item.tagId}
                    style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    className={cn(color.bar, "transition-all")}
                    title={`${item.label}: ${item.percentage.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Tag Breakdown Grid */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {byTag.map((item) => {
            const isSelected = selectedTagId === item.tagId;
            const colors = tagColorMap[item.tagId] ?? {
              bg: "bg-primary/10",
              text: "text-primary",
              bar: "bg-primary",
            };

            return (
              <button
                type="button"
                key={item.tagId}
                onClick={() => onSelectTag?.(isSelected ? null : item.tagId)}
                className={cn(
                  "hover:bg-muted/50 border-border/60 flex w-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-left transition-colors",
                  isSelected && "border-primary bg-primary/5 ring-primary/40 ring-1",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-md p-1.5", colors.bg, colors.text)}>
                      <Receipt className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-foreground text-xs font-semibold">{item.label}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">#{item.canonicalTag}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {item.percentage.toFixed(1)}%
                  </Badge>
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t pt-2">
                  <div className="text-muted-foreground text-[11px]">
                    {item.transactionCount} {item.transactionCount === 1 ? "payment" : "payments"}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      -{formatMoney(item.totalConverted, currency)}
                    </div>
                    {item.byCurrency.length > 1 && (
                      <div className="text-muted-foreground font-mono text-[10px]">
                        {item.byCurrency.map((c) => `${c.amount.toLocaleString()} ${c.currency}`).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Gross-to-Net Waterfall Summary Card */}
        {grossIncome > 0 && (
          <div className="bg-muted/40 border-border/60 rounded-lg border p-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Layers className="size-3.5" />
              <span>Gross-to-Net Cash Flow Summary</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Gross Inflow</span>
                <span className="text-foreground font-semibold tabular-nums">{formatMoney(grossIncome, currency)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Total Taxes Deducted</span>
                <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  -{formatMoney(totalTaxesConverted, currency)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Net Disposable Income</span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(netDisposableIncome, currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
