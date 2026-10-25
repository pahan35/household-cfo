"use client";

import { useMemo, useState } from "react";

import { ChevronRight, Copy, Edit2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatMoney } from "../../_components/external-provider-data";
import { computeRestructureRevisionDiff, normalizeOfferRevision } from "./compensation-engine";
import type {
  ComparatorGlobalConfig,
  NormalizedCompensationSummary,
  OfferRevision,
  OfferTrack,
  OfferTrackStatus,
  RestructureImpactDiff,
} from "./offer-types";

export interface OfferComparisonMatrixProps {
  tracks: OfferTrack[];
  config: ComparatorGlobalConfig;
  liveRates?: Record<string, number>;
  onEditRevision: (track: OfferTrack, revision: OfferRevision) => void;
  onCloneRevision: (track: OfferTrack, revision: OfferRevision) => void;
  onDeleteRevision: (trackId: string, revisionId: string) => void;
  onAddTrack: () => void;
}

export function OfferComparisonMatrix({
  tracks,
  config,
  liveRates = {},
  onEditRevision,
  onCloneRevision,
  onDeleteRevision,
  onAddTrack,
}: OfferComparisonMatrixProps) {
  const [viewMode, setViewMode] = useState<"side_by_side" | "restructure_diff">("side_by_side");

  // Track selected for restructure diff
  const [diffTrackId, setDiffTrackId] = useState<string>(tracks[0]?.id ?? "");
  const [diffBaseRevId, setDiffBaseRevId] = useState<string>("");
  const [diffTargetRevId, setDiffTargetRevId] = useState<string>("");

  const activeDiffTrack = tracks.find((t) => t.id === diffTrackId) ?? tracks[0];

  // Set default diff revisions when diffTrack changes
  const activeRevisions = activeDiffTrack?.revisions ?? [];
  const baseRev = activeRevisions.find((r) => r.id === diffBaseRevId) ?? activeRevisions[0];
  const targetRev =
    activeRevisions.find((r) => r.id === diffTargetRevId) ??
    (activeRevisions.length > 1 ? activeRevisions[1] : activeRevisions[0]);

  // Compute Restructure Diff if 2 revisions exist
  const restructureDiff: RestructureImpactDiff | null = useMemo(() => {
    if (!baseRev || !targetRev || baseRev.id === targetRev.id) return null;
    return computeRestructureRevisionDiff(baseRev, targetRev, config, liveRates);
  }, [baseRev, targetRev, config, liveRates]);

  const getStatusBadge = (status: OfferTrackStatus) => {
    switch (status) {
      case "current":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">Current Role</Badge>
        );
      case "negotiating":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px]">Negotiating Offer</Badge>;
      case "past_accepted":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">Past Accepted</Badge>;
      case "past_declined":
        return (
          <Badge variant="secondary" className="text-[10px]">
            Past Declined
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* View Mode & Header Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {viewMode === "side_by_side" ? "Side-by-Side Offer Comparison" : "Restructure & Amendment Diff"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {viewMode === "side_by_side"
              ? "Normalized into Net Monthly Cashflow, Effective Hourly Rate, and 3-Year ZUS projections."
              : "Isolate base rate gains, currency buffers, and benefit tier downgrade penalties."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("side_by_side")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                viewMode === "side_by_side"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Side-by-Side Matrix
            </button>
            <button
              type="button"
              onClick={() => setViewMode("restructure_diff")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                viewMode === "restructure_diff"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Restructure Diff
            </button>
          </div>

          <Button size="sm" onClick={onAddTrack} className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            <span>Add Offer Track</span>
          </Button>
        </div>
      </div>

      {/* VIEW 1: Side-by-Side Offer Matrix Cards */}
      {viewMode === "side_by_side" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => {
            const activeRev = track.revisions.find((r) => r.id === track.activeRevisionId) ?? track.revisions[0];
            if (!activeRev) return null;

            const summary = normalizeOfferRevision(activeRev, config, liveRates);
            const isUop = activeRev.taxProfile.regime === "uop";

            return (
              <Card
                key={track.id}
                className={`flex flex-col justify-between border bg-card shadow-xs transition-shadow hover:shadow-md ${
                  track.status === "current" ? "border-primary/40 ring-1 ring-primary/20" : ""
                }`}
              >
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(track.status)}
                        <span className="font-semibold text-sm text-foreground">{track.companyName}</span>
                      </div>
                      <span className="block text-xs text-muted-foreground">{track.roleTitle}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditRevision(track, activeRev)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Edit revision"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCloneRevision(track, activeRev)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Clone revision (model a restructure)"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Revision Switcher */}
                  {track.revisions.length > 1 && (
                    <div className="mt-2 flex items-center justify-between text-xs pt-1">
                      <span className="text-[11px] text-muted-foreground">Revision:</span>
                      <Select
                        value={activeRev.id}
                        onValueChange={(revId) => {
                          const updated = tracks.map((t) =>
                            t.id === track.id ? { ...t, activeRevisionId: revId } : t,
                          );
                          // Handle external update if needed
                        }}
                      >
                        <SelectTrigger className="h-6 text-[11px] max-w-[200px]">
                          <SelectValue>{activeRev.title}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {track.revisions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-3.5 text-xs flex-1">
                  {/* Top Gross & Contract Spec */}
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                        Base Rate
                      </span>
                      <span className="font-mono text-base font-bold text-foreground">
                        {activeRev.rateSpec.amount.toLocaleString()} {activeRev.rateSpec.currency}
                        <span className="text-xs font-normal text-muted-foreground">
                          /{activeRev.rateSpec.period === "hourly" ? "hr" : "mo"}
                        </span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                        Annual Gross
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {formatMoney(summary.annualGrossRevenuePln, "PLN")}
                      </span>
                    </div>
                  </div>

                  {/* High-level Tax & Contract Pill */}
                  <div className="rounded-lg border bg-muted/20 p-2 text-[11px] flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">
                      {isUop
                        ? `UoP ${activeRev.taxProfile.regime === "uop" && activeRev.taxProfile.hasAkup ? "(50% AKUP)" : "(Standard)"}`
                        : `B2B ${activeRev.taxProfile.regime.replace("b2b_", "").toUpperCase()}`}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      Eff. Tax: {summary.taxBreakdown.effectiveTaxRatePct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Primary Metrics Box */}
                  <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-primary text-xs">Hard Net Monthly Cashflow</span>
                      <span className="font-mono text-lg font-bold text-foreground">
                        {formatMoney(summary.hardNetMonthlyCashflowPln, "PLN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] border-t border-primary/10 pt-1.5">
                      <span className="text-muted-foreground">Effective Net Hourly:</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(summary.effectiveNetHourlyRatePln, "PLN")}/hr
                      </span>
                    </div>
                  </div>

                  {/* Two-Layer Breakdown List */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Net Salary/Invoice:</span>
                      <span className="font-mono text-foreground">
                        {formatMoney(summary.taxBreakdown.monthlyNetCashflowPln, "PLN")}
                      </span>
                    </div>

                    {summary.monthlyHardBudgetOffsetPln > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Layer 1 Budget Offsets:</span>
                        <span className="font-mono font-semibold">
                          +{formatMoney(summary.monthlyHardBudgetOffsetPln, "PLN")}
                        </span>
                      </div>
                    )}

                    {summary.monthlyLiquidEquityPln > 0 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>Post-Belka Liquid RSU:</span>
                        <span className="font-mono font-semibold">
                          +{formatMoney(summary.monthlyLiquidEquityPln, "PLN")}
                        </span>
                      </div>
                    )}

                    {summary.hasIlliquidEquity && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Startup ESOP Options:</span>
                        <Badge variant="outline" className="text-[9px]">
                          Paper Upside
                        </Badge>
                      </div>
                    )}

                    {summary.monthlySubjectiveUtilityPln > 0 && (
                      <div className="flex justify-between text-muted-foreground border-t pt-1">
                        <span>Total Perceived Comp:</span>
                        <span className="font-mono font-medium">
                          {formatMoney(summary.totalPerceivedMonthlyCompPln, "PLN")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Multi-Year Trajectory Strip */}
                  <div className="border-t pt-2 text-[10px] space-y-1">
                    <span className="text-muted-foreground font-medium block">
                      3-Year Horizon (ZUS Inflation &amp; Stages):
                    </span>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span>Yr 1: {Math.round(summary.multiYearTax.year1.monthlyNetCashflowPln).toLocaleString()}</span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                      <span>Yr 2: {Math.round(summary.multiYearTax.year2.monthlyNetCashflowPln).toLocaleString()}</span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                      <span>Yr 3: {Math.round(summary.multiYearTax.year3.monthlyNetCashflowPln).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Side-Gig Capacity Badge */}
                  {summary.sideGigSummary && (
                    <div className="rounded-md border bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
                      <span className="font-medium block">
                        Side-Gig Addon (+{summary.sideGigSummary.totalWeeklyHours}h/wk):
                      </span>
                      <span>
                        +{formatMoney(summary.sideGigSummary.marginalNetMonthlyPln, "PLN")}/mo net yield (
                        {formatMoney(summary.sideGigSummary.marginalNetHourlyRatePln, "PLN")}/hr)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Restructure Diff Mode */}
      {viewMode === "restructure_diff" && (
        <div className="flex flex-col gap-4">
          <Card className="border bg-card p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b">
              <div className="space-y-1">
                <span className="font-semibold text-sm">Select Restructure Track &amp; Revisions</span>
                <p className="text-xs text-muted-foreground">
                  Compare how an amendment or promotion impacts your real take-home cashflow.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Select value={diffTrackId} onValueChange={(tId) => setDiffTrackId(tId)}>
                  <SelectTrigger className="h-8 text-xs font-medium w-48">
                    <SelectValue placeholder="Select Employer Track" />
                  </SelectTrigger>
                  <SelectContent>
                    {tracks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Revisions selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Base Revision (Before)</Label>
                <Select value={baseRev?.id ?? ""} onValueChange={(rId) => setDiffBaseRevId(rId)}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRevisions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} ({r.rateSpec.amount} {r.rateSpec.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Target Revision (After)</Label>
                <Select value={targetRev?.id ?? ""} onValueChange={(rId) => setDiffTargetRevId(rId)}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRevisions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} ({r.rateSpec.amount} {r.rateSpec.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Diff Impact Breakdown */}
          {restructureDiff ? (
            <Card className="border bg-card p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Restructure Impact: {baseRev?.title} → {targetRev?.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Effective dates: {baseRev?.effectiveDate} to {targetRev?.effectiveDate}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      Net Monthly Gain
                    </span>
                    <span
                      className={`font-mono text-xl font-bold ${
                        restructureDiff.netMonthlyGainPln >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {restructureDiff.netMonthlyGainPln >= 0 ? "+" : ""}
                      {formatMoney(restructureDiff.netMonthlyGainPln, "PLN")} / mo
                    </span>
                  </div>
                </div>

                {/* Waterfall Diff Components */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] text-muted-foreground block">Gross Rate Delta</span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      {restructureDiff.monthlyGrossDeltaPln >= 0 ? "+" : ""}
                      {formatMoney(restructureDiff.monthlyGrossDeltaPln, "PLN")}/mo
                    </span>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] text-muted-foreground block">FX Pessimistic Buffer Drag</span>
                    <span className="font-mono font-semibold text-amber-600 text-sm">
                      -{formatMoney(restructureDiff.fxBufferDragPln, "PLN")}/mo
                    </span>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] text-muted-foreground block">Spouse Coverage Downgrade</span>
                    <span className="font-mono font-semibold text-rose-600 text-sm">
                      -{formatMoney(restructureDiff.spouseDowngradeCostPln, "PLN")}/mo
                    </span>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] text-muted-foreground block">Effective Net Hourly Delta</span>
                    <span className="font-mono font-semibold text-emerald-600 text-sm">
                      {restructureDiff.effectiveHourlyRateDeltaPln >= 0 ? "+" : ""}
                      {formatMoney(restructureDiff.effectiveHourlyRateDeltaPln, "PLN")}/hr
                    </span>
                  </div>
                </div>

                {/* Real Purchasing Power Delta if historical */}
                {restructureDiff.realPurchasingPowerDeltaPln !== undefined && (
                  <div className="rounded-lg border bg-primary/5 p-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground block">CPI-Adjusted Real Purchasing Power:</span>
                      <span className="text-[11px] text-muted-foreground">
                        Deflated using GUS Polish CPI historical index ({baseRev?.effectiveDate} vs{" "}
                        {targetRev?.effectiveDate}).
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {restructureDiff.realPurchasingPowerDeltaPln >= 0 ? "+" : ""}
                      {formatMoney(restructureDiff.realPurchasingPowerDeltaPln, "PLN")}/mo real
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              Please select two different revisions on this track to calculate the Restructure Impact Diff.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
