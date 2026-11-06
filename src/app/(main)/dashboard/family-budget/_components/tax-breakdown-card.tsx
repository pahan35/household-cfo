"use client";

import { useMemo } from "react";

import { cn } from "cn";
import { ArrowDownRight, ArrowLeftRight, Layers, Percent, Receipt, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { formatMoney } from "./external-provider-data";
import { SectionShell } from "./section-shell";
import type { FxFrictionResult, TagTaxAggregate, TaxBreakdownResult } from "./tax-transforms";

export interface TaxBreakdownCardProps {
  taxBreakdown: TaxBreakdownResult;
  grossIncome: number;
  rawGrossInflow?: number;
  netDisposableIncome: number;
  effectiveTaxRate: number;
  grossZus?: number;
  pfronCashback?: number;
  netZus?: number;
  passThroughVat?: number;
  fxFriction?: number;
  fxFrictionDetails?: FxFrictionResult;
  currency?: string;
  selectedTagId?: string | null;
  onSelectTag?: (tagId: string | null) => void;
  isLoading?: boolean;
}

export function TaxBreakdownCard({
  taxBreakdown,
  grossIncome,
  rawGrossInflow,
  netDisposableIncome,
  effectiveTaxRate,
  grossZus = 0,
  pfronCashback = 0,
  netZus,
  passThroughVat: controlledVat,
  fxFriction = 0,
  fxFrictionDetails,
  currency = "PLN",
  selectedTagId = null,
  onSelectTag,
  isLoading = false,
}: TaxBreakdownCardProps) {
  const { totalTaxesConverted, personalTags, passThroughTags, untaggedCount, untaggedTotalConverted } = taxBreakdown;

  const resolvedNetZus = netZus ?? Math.max(0, grossZus - pfronCashback);
  const passThroughVat = controlledVat ?? taxBreakdown.totalPassThroughConverted;

  // Non-ZUS personal taxes: PPE, PIT, Health, Belka, etc. (Gross Personal Taxes minus Gross ZUS)
  const nonZusPersonalTaxes = Math.max(0, totalTaxesConverted - grossZus);
  const netPersonalTaxes = nonZusPersonalTaxes + resolvedNetZus;

  const tagColorMap: Record<string, { bg: string; text: string; bar: string }> = {
    ppe: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
    pit: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
    zus: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
    health: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
    vat: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
    "capital-gains": { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
    other: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  };

  const isVatSelected = selectedTagId === "vat";

  return (
    <SectionShell
      title="Income Streams & Tax Flow"
      description="Mapping gross revenue through currency friction, net ZUS (after PFRON), and PPE / PIT down to true net disposable income"
      action={
        !isLoading && (netPersonalTaxes > 0 || totalTaxesConverted > 0) ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Effective: {effectiveTaxRate.toFixed(1)}%
            </Badge>
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Personal Tax: </span>
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                -{formatMoney(netPersonalTaxes, currency)}
              </span>
            </div>
          </div>
        ) : undefined
      }
      isLoading={isLoading}
      isEmpty={totalTaxesConverted === 0 && passThroughVat === 0}
      emptyTitle="No tax payments recorded"
      emptyDescription="No outgoing tax payments found for the selected period."
      emptyIcon={<Receipt className="text-muted-foreground size-6" />}
      skeletonCount={3}
    >
      <div className="flex flex-col gap-4">
        {/* Gross-to-Net Cash Flow Stream */}
        {grossIncome > 0 && (
          <div className="bg-muted/40 border-border/60 rounded-lg border p-3">
            <div className="text-muted-foreground mb-2.5 flex items-center gap-1.5 text-xs font-medium">
              <Layers className="size-3.5" />
              <span>Revenue-to-Net Disposable Cash Flow</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div className="flex flex-col">
                <span className="text-muted-foreground">True Gross Inflow</span>
                <span className="text-foreground font-semibold tabular-nums">{formatMoney(grossIncome, currency)}</span>
                <span className="text-muted-foreground text-[10px]">
                  {rawGrossInflow && rawGrossInflow > grossIncome
                    ? `Excl. VAT (Raw ${formatMoney(rawGrossInflow, currency)})`
                    : "Excl. PFRON & VAT"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">FX & VAT-7 Drag</span>
                <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {fxFriction > 0 ? `-${formatMoney(fxFriction, currency)}` : formatMoney(0, currency)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {fxFrictionDetails && fxFrictionDetails.vatDragLossPln > 0
                    ? `VAT drag (-${formatMoney(fxFrictionDetails.vatDragLossPln, currency)}) + spread`
                    : "Trade spread loss"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Net ZUS Contribution</span>
                <span className="font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                  -{formatMoney(resolvedNetZus, currency)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {pfronCashback > 0 ? `-${formatMoney(pfronCashback, currency)} PFRON rebate` : "Social Security"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Personal Taxes (PPE / PIT)</span>
                <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  -{formatMoney(nonZusPersonalTaxes, currency)}
                </span>
                <span className="text-muted-foreground text-[10px]">Income tax & healthcare</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Net Disposable Cash</span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(netDisposableIncome, currency)}
                </span>
                <span className="text-muted-foreground text-[10px]">Actual take-home cash</span>
              </div>
            </div>
          </div>
        )}

        {/* VAT-7 Neutral Business Pass-Through Callout */}
        {passThroughVat > 0 && (
          <button
            type="button"
            onClick={() => onSelectTag?.(isVatSelected ? null : "vat")}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10",
              isVatSelected && "ring-2 ring-amber-500 border-amber-500",
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                <Receipt className="size-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">VAT-7 Remittance</span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-normal px-1 py-0"
                  >
                    Neutral Pass-Through
                  </Badge>
                  {fxFrictionDetails && fxFrictionDetails.vatDragLossPln > 0 && (
                    <Badge
                      variant="destructive"
                      className="bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-600/30 text-[10px] font-normal px-1.5 py-0"
                    >
                      -PLN {fxFrictionDetails.vatDragLossPln.toFixed(2)} (-$
                      {fxFrictionDetails.vatDragLossUsd.toFixed(2)} FX Loss)
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground text-[11px]">
                  Remitted to Polish tax office on behalf of clients; excluded from personal tax burden.
                  {fxFrictionDetails &&
                    fxFrictionDetails.vatDragLossPln > 0 &&
                    fxFrictionDetails.invoicedUsdVat &&
                    fxFrictionDetails.expendedUsdForVat && (
                      <span className="block text-[10px] text-amber-700/80 dark:text-amber-300/80 font-mono mt-0.5">
                        Collected: ${fxFrictionDetails.invoicedUsdVat.toFixed(2)} at NBP{" "}
                        {fxFrictionDetails.nbpRate?.toFixed(2)} · Expended: $
                        {fxFrictionDetails.expendedUsdForVat.toFixed(2)} at sell{" "}
                        {fxFrictionDetails.realizedSellRate?.toFixed(2)}
                      </span>
                    )}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {formatMoney(passThroughVat, currency)}
              </span>
              <div className="text-[10px] text-muted-foreground">#VAT-7</div>
            </div>
          </button>
        )}

        {/* Personal Tax Waterfall Progress Bar */}
        {netPersonalTaxes > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Personal Tax Distribution</span>
              <span>100% of personal deductions</span>
            </div>
            <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
              {personalTags.map((item) => {
                const color = tagColorMap[item.tagId] ?? { bar: "bg-primary" };
                const itemAmount = item.tagId === "zus" ? resolvedNetZus : item.totalConverted;
                const percentage = netPersonalTaxes > 0 ? (itemAmount / netPersonalTaxes) * 100 : 0;
                return (
                  <div
                    key={item.tagId}
                    style={{ width: `${Math.max(percentage, 2)}%` }}
                    className={cn(color.bar, "transition-all")}
                    title={`${item.label}: ${percentage.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Tag Breakdown Grid for Personal Taxes & FX Drag */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {personalTags.map((item) => {
            const isSelected = selectedTagId === item.tagId;
            const colors = tagColorMap[item.tagId] ?? {
              bg: "bg-primary/10",
              text: "text-primary",
              bar: "bg-primary",
            };

            const displayAmount = item.tagId === "zus" ? resolvedNetZus : item.totalConverted;
            const displayPercentage = netPersonalTaxes > 0 ? (displayAmount / netPersonalTaxes) * 100 : item.percentage;

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
                    {displayPercentage.toFixed(1)}%
                  </Badge>
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t pt-2">
                  <div className="text-muted-foreground text-[11px]">
                    {item.tagId === "zus" && pfronCashback > 0
                      ? `Net after -${formatMoney(pfronCashback, currency)} PFRON`
                      : `${item.transactionCount} ${item.transactionCount === 1 ? "payment" : "payments"}`}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      -{formatMoney(displayAmount, currency)}
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

          {/* FX & VAT-7 Drag Deduction Card */}
          {fxFriction > 0 && (
            <div className="hover:bg-muted/50 border-border/60 flex w-full flex-col justify-between rounded-lg border p-3 text-left transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                    <ArrowLeftRight className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-foreground text-xs font-semibold">FX & VAT-7 Drag</div>
                    <div className="text-muted-foreground font-mono text-[10px]">#usd-drag</div>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {grossIncome > 0 ? ((fxFriction / grossIncome) * 100).toFixed(1) : 0}% of gross
                </Badge>
              </div>

              <div className="mt-3 flex items-baseline justify-between border-t pt-2">
                <div className="text-muted-foreground text-[11px]">
                  {fxFrictionDetails?.vatDragLossPln
                    ? `VAT drag: -${formatMoney(fxFrictionDetails.vatDragLossPln, currency)}`
                    : "Trade spread"}
                </div>
                <div className="text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  -{formatMoney(fxFriction, currency)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
