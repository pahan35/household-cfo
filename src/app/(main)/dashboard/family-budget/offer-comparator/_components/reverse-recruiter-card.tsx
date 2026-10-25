"use client";

import { useMemo, useState } from "react";

import { Check, Clock, Coins, Copy, Info, Scale, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { formatMoney } from "../../_components/external-provider-data";
import type { ComparatorGlobalConfig } from "./offer-types";
import { generateQuickQuoteMatrix, type QuickQuoteMatrixRow } from "./reverse-recruiter-solver";

export interface ReverseRecruiterCardProps {
  targetNetMonthlyPln: number;
  config: ComparatorGlobalConfig;
  liveRates?: Record<string, number>;
}

export function ReverseRecruiterCard({ targetNetMonthlyPln, config, liveRates = {} }: ReverseRecruiterCardProps) {
  const [copiedQuote, setCopiedQuote] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"both" | "hourly" | "monthly">("both");

  const matrix = useMemo(() => {
    return generateQuickQuoteMatrix(targetNetMonthlyPln, config, liveRates);
  }, [targetNetMonthlyPln, config, liveRates]);

  const handleCopyQuote = (quoteText: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(quoteText);
      setCopiedQuote(quoteText);
      toast.success(`Copied quote to clipboard: ${quoteText} (${label})`);
      setTimeout(() => setCopiedQuote(null), 2500);
    }
  };

  const getContractBadge = (contractType: QuickQuoteMatrixRow["contractType"]) => {
    switch (contractType) {
      case "b2b_hourly":
        return (
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]"
          >
            B2B Hourly
          </Badge>
        );
      case "b2b_monthly":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]"
          >
            B2B Monthly
          </Badge>
        );
      case "uop":
        return (
          <Badge
            variant="outline"
            className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]"
          >
            UoP Contract
          </Badge>
        );
    }
  };

  return (
    <Card className="border bg-card shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              <CardTitle className="text-base font-semibold">Reverse Recruiter Quick-Quote Cheat Sheet</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Solved backwards across Polish tax brackets, 30x ZUS cap, 50% AKUP, and FX buffers for{" "}
              <strong className="text-foreground">{formatMoney(targetNetMonthlyPln, "PLN")}/mo Net</strong>.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                viewMode === "both"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Quotes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("hourly")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                viewMode === "hourly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hourly Focus
            </button>
            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                viewMode === "monthly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly Focus
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="text-xs">
                <TableHead className="w-[260px] pl-4">Contract &amp; Tax Scenario</TableHead>
                <TableHead className="text-right">PLN Quote</TableHead>
                <TableHead className="text-right">USD Quote (Buffered)</TableHead>
                <TableHead className="text-right pr-4">EUR Quote (Buffered)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => {
                const plnHourlyText = `${Math.round(row.pln.hourly)} PLN/hr`;
                const plnMonthlyText = `${Math.round(row.pln.monthly).toLocaleString()} PLN/mo`;

                const usdHourlyText = `${Math.round(row.usd.hourly * 10) / 10} USD/hr`;
                const usdMonthlyText = `${Math.round(row.usd.monthly).toLocaleString()} USD/mo`;

                const eurHourlyText = `${Math.round(row.eur.hourly * 10) / 10} EUR/hr`;
                const eurMonthlyText = `${Math.round(row.eur.monthly).toLocaleString()} EUR/mo`;

                const isHourly = row.contractType === "b2b_hourly";

                return (
                  <TableRow key={row.scenarioId} className="text-xs hover:bg-muted/30">
                    {/* Scenario Title & Badges */}
                    <TableCell className="py-2.5 pl-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {getContractBadge(row.contractType)}
                          <span className="font-medium text-foreground">{row.scenarioLabel}</span>
                        </div>
                        {row.scenarioId === "b2b_hourly_unpaid_pto" && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Includes +20% hourly markup to self-fund 42 unpaid days off
                          </span>
                        )}
                        {row.scenarioId === "uop_monthly_akup" && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Saves ~2,000+ PLN/mo in taxes vs standard UoP
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* PLN Quotes */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {(viewMode === "both" || viewMode === "hourly" || isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(plnHourlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary"
                          >
                            <span>{plnHourlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                        {(viewMode === "both" || viewMode === "monthly" || !isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(plnMonthlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <span>{plnMonthlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* USD Quotes */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {(viewMode === "both" || viewMode === "hourly" || isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(usdHourlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary"
                          >
                            <span>{usdHourlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                        {(viewMode === "both" || viewMode === "monthly" || !isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(usdMonthlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <span>{usdMonthlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* EUR Quotes */}
                    <TableCell className="text-right pr-4">
                      <div className="flex flex-col items-end gap-1">
                        {(viewMode === "both" || viewMode === "hourly" || isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(eurHourlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary"
                          >
                            <span>{eurHourlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                        {(viewMode === "both" || viewMode === "monthly" || !isHourly) && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(eurMonthlyText, row.scenarioLabel)}
                            className="group flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <span>{eurMonthlyText}</span>
                            <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="border-t bg-muted/15 p-3 text-center text-[11px] text-muted-foreground">
          Click any rate to copy quote to clipboard. Rates already account for your active FX buffers.
        </div>
      </CardContent>
    </Card>
  );
}
