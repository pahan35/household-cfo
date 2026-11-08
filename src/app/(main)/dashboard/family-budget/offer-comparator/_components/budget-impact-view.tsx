"use client";

import { useMemo } from "react";

import { History, PiggyBank } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { formatMoney } from "../../_components/external-provider-data";
import { calculateRealValue } from "../../_components/macro-transforms";
import { normalizeOfferRevision } from "./compensation-engine";
import type { ComparatorGlobalConfig, OfferTrack } from "./offer-types";

export interface BudgetImpactViewProps {
  tracks: OfferTrack[];
  config: ComparatorGlobalConfig;
  liveRates?: Record<string, number>;
}

function getCoverageColorClass(ratio: number): string {
  if (ratio >= 1.5) return "text-emerald-600 dark:text-emerald-400";
  if (ratio >= 1.0) return "text-foreground";
  return "text-rose-600 dark:text-rose-400";
}

export function BudgetImpactView({ tracks, config, liveRates = {} }: BudgetImpactViewProps) {
  const targetExpenses = config.targetMonthlyExpensePln || 14000;
  const targetSavings = config.targetMonthlySavingsPln || 6000;
  const totalTargetNet = targetExpenses + targetSavings;

  // Active revisions evaluation
  const offerMetrics = useMemo(() => {
    return tracks.map((track) => {
      const activeRev = track.revisions.find((r) => r.id === track.activeRevisionId) || track.revisions[0];
      const summary = activeRev ? normalizeOfferRevision(activeRev, config, liveRates) : null;
      const netMonthly = summary?.hardNetMonthlyCashflowPln ?? 0;

      const coverageRatio = targetExpenses > 0 ? netMonthly / targetExpenses : 0;
      const surplusAboveExpenses = netMonthly - targetExpenses;
      const surplusAboveSavingsGoal = netMonthly - totalTargetNet;
      const savingsRatePct = netMonthly > 0 ? (surplusAboveExpenses / netMonthly) * 100 : 0;

      return {
        track,
        activeRev,
        summary,
        netMonthly,
        coverageRatio,
        surplusAboveExpenses,
        surplusAboveSavingsGoal,
        savingsRatePct,
      };
    });
  }, [tracks, config, liveRates, targetExpenses, totalTargetNet]);

  // Historical career archive revisions
  const historicalRevisions = useMemo(() => {
    const list: Array<{
      track: OfferTrack;
      revision: (typeof tracks)[0]["revisions"][0];
      nominalNetMonthlyPln: number;
      realPurchasingPowerPln: number;
    }> = [];

    for (const track of tracks) {
      for (const rev of track.revisions) {
        if (rev.isHistorical || track.status === "past_accepted") {
          const summary = normalizeOfferRevision(rev, config, liveRates);
          const nominal = summary.hardNetMonthlyCashflowPln;
          const real = rev.effectiveDate ? calculateRealValue(nominal, rev.effectiveDate) : nominal;

          list.push({
            track,
            revision: rev,
            nominalNetMonthlyPln: nominal,
            realPurchasingPowerPln: real,
          });
        }
      }
    }

    list.sort((a, b) => (a.revision.effectiveDate || "").localeCompare(b.revision.effectiveDate || ""));
    return list;
  }, [tracks, config, liveRates]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Family Budget Coverage & Savings Rate */}
      <Card className="border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-4 text-emerald-500" />
            <CardTitle className="text-base font-semibold">Family Budget Impact &amp; Expense Coverage</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Benchmarked against your ExternalProvider living expenses ({formatMoney(targetExpenses, "PLN")}/mo) and
            savings goal ({formatMoney(targetSavings, "PLN")}/mo).
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="text-xs">
                  <TableHead className="w-[240px] pl-4">Offer / Role</TableHead>
                  <TableHead className="text-right">Net Monthly Cashflow</TableHead>
                  <TableHead className="text-right">Expense Coverage</TableHead>
                  <TableHead className="text-right">Savings Goal Margin</TableHead>
                  <TableHead className="text-right pr-4">Savings Rate %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offerMetrics.map(
                  ({ track, activeRev, netMonthly, coverageRatio, surplusAboveSavingsGoal, savingsRatePct }) => {
                    if (!activeRev) return null;
                    const isPositiveSavings = surplusAboveSavingsGoal >= 0;

                    return (
                      <TableRow key={track.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="pl-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{track.companyName}</span>
                            <span className="text-[11px] text-muted-foreground">{activeRev.title}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatMoney(netMonthly, "PLN")}
                        </TableCell>

                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${getCoverageColorClass(coverageRatio)}`}>
                            {coverageRatio.toFixed(2)}x
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`font-mono font-semibold ${
                              isPositiveSavings
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isPositiveSavings ? "+" : ""}
                            {formatMoney(surplusAboveSavingsGoal, "PLN")}
                          </span>
                        </TableCell>

                        <TableCell className="text-right pr-4 font-mono font-medium">
                          {savingsRatePct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 2. Historical Career Archive & CPI Purchasing Power */}
      {historicalRevisions.length > 0 && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <History className="size-4 text-purple-500" />
              <CardTitle className="text-base font-semibold">
                Historical Career Archive &amp; Real CPI Purchasing Power
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Past accepted offers and annual rate progressions adjusted to today's purchasing power using GUS Polish
              CPI inflation.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-xs">
                    <TableHead className="w-[240px] pl-4">Past Employer &amp; Revision</TableHead>
                    <TableHead className="text-center">Effective Month</TableHead>
                    <TableHead className="text-right">Nominal Net (At The Time)</TableHead>
                    <TableHead className="text-right pr-4">Today's Real Purchasing Power</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalRevisions.map(({ track, revision, nominalNetMonthlyPln, realPurchasingPowerPln }) => {
                    return (
                      <TableRow key={revision.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="pl-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{track.companyName}</span>
                            <span className="text-[11px] text-muted-foreground">{revision.title}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-center font-mono text-[11px]">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {revision.effectiveDate || "Historical"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatMoney(nominalNetMonthlyPln, "PLN")} / mo
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-foreground">
                              {formatMoney(realPurchasingPowerPln, "PLN")} / mo
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              Today's purchasing power equivalent
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
