"use client";

import { useMemo } from "react";

import { AlertTriangle, BarChart3, Layers } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import { calculateOverlapTimeline } from "./mortgage-engine";
import type { AmortizationSummary, OverlapTimelineConfig, PropertyAcquisitionSummary } from "./mortgage-types";

interface OverlapCashflowCardProps {
  config: OverlapTimelineConfig;
  propertySummary: PropertyAcquisitionSummary;
  amortization: AmortizationSummary;
  onChange: (updated: OverlapTimelineConfig) => void;
}

export function OverlapCashflowCard({ config, propertySummary, amortization, onChange }: OverlapCashflowCardProps) {
  const update = (patch: Partial<OverlapTimelineConfig>) => {
    onChange({ ...config, ...patch });
  };

  const timeline = useMemo(() => {
    return calculateOverlapTimeline({
      propertySummary,
      amortization,
      overlapConfig: config,
    });
  }, [propertySummary, amortization, config]);

  // Sample or aggregate timeline months for the chart
  const chartData = useMemo(() => {
    return timeline.timelineMonths.map((m) => {
      let label = `M${m.monthIndex}`;
      if (m.monthIndex === config.monthsToSigning) label = `M${m.monthIndex} (Signing)`;
      if (m.monthIndex === config.monthsToSigning + config.constructionWaitMonths) label = `M${m.monthIndex} (Keys)`;
      if (m.monthIndex === config.monthsToSigning + config.constructionWaitMonths + config.finishingOverlapMonths) {
        label = `M${m.monthIndex} (Move-in)`;
      }

      return {
        month: label,
        Rent: m.rentPln,
        Mortgage: m.mortgagePln,
        "Admin Fee": m.adminFeePln,
        Total: m.totalPln,
        phase: m.phaseKey,
      };
    });
  }, [timeline.timelineMonths, config]);

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Construction Wait & Handover Overlap Cashflow</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="mr-1 size-3.5" /> Peak Cost:{" "}
              <strong>{formatMoney(timeline.peakMonthlyHousingCostPln, "PLN")}</strong>/mo
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              Pre-Move-in Total: <strong>{formatMoney(timeline.totalOverlapCostPln, "PLN")}</strong>
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Simulate the multi-phase transition: construction wait (developer tranche grace period interest + current
          rent), finishing peak overlap, and post-move-in steady state.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Timeline Timing & Housing Cost Controls */}
        <div className="border-border/50 bg-muted/20 grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="currentRent" className="text-muted-foreground text-xs">
              Current Monthly Rent (PLN)
            </Label>
            <Input
              id="currentRent"
              type="number"
              step="100"
              value={config.currentMonthlyRentPln || ""}
              onChange={(e) => update({ currentMonthlyRentPln: Number(e.target.value) || 0 })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adminFee" className="text-muted-foreground text-xs">
              New Community Fee (*Czynsz*)
            </Label>
            <Input
              id="adminFee"
              type="number"
              step="50"
              value={config.newCommunityAdminFeePln || ""}
              onChange={(e) => update({ newCommunityAdminFeePln: Number(e.target.value) || 0 })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground flex justify-between text-xs">
              <Label htmlFor="trancheDraw" className="text-xs">
                Avg Drawn Tranche %
              </Label>
              <span>{config.averageTrancheDrawnPctDuringConstruction}%</span>
            </div>
            <div className="pt-2">
              <Slider
                id="trancheDraw"
                min={20}
                max={90}
                step={5}
                value={[config.averageTrancheDrawnPctDuringConstruction]}
                onValueChange={([val]) => update({ averageTrancheDrawnPctDuringConstruction: val })}
              />
            </div>
          </div>
        </div>

        {/* Phase Duration Selectors */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border-border/50 bg-muted/10 space-y-1.5 rounded-lg border p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">1. Months to Signing</span>
              <span className="font-semibold">{config.monthsToSigning} mos</span>
            </div>
            <Slider
              min={1}
              max={24}
              step={1}
              value={[config.monthsToSigning]}
              onValueChange={([val]) => update({ monthsToSigning: val })}
            />
          </div>

          <div className="border-border/50 bg-muted/10 space-y-1.5 rounded-lg border p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">2. Construction Wait</span>
              <span className="font-semibold">{config.constructionWaitMonths} mos</span>
            </div>
            <Slider
              min={6}
              max={36}
              step={1}
              value={[config.constructionWaitMonths]}
              onValueChange={([val]) => update({ constructionWaitMonths: val })}
            />
          </div>

          <div className="border-border/50 bg-muted/10 space-y-1.5 rounded-lg border p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">3. Finishing Overlap</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {config.finishingOverlapMonths} mos (Peak)
              </span>
            </div>
            <Slider
              min={1}
              max={12}
              step={1}
              value={[config.finishingOverlapMonths]}
              onValueChange={([val]) => update({ finishingOverlapMonths: val })}
            />
          </div>
        </div>

        {/* Phase Breakdown Cards */}
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {timeline.phases.map((phase) => {
            const isPeak = phase.phaseKey === timeline.peakPhaseKey;
            return (
              <div
                key={phase.phaseKey}
                className={`space-y-1.5 rounded-lg border p-3 transition-all ${
                  isPeak ? "border-amber-500/50 bg-amber-500/10 shadow-xs" : "border-border/40 bg-muted/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{phase.phaseTitle}</span>
                  <Badge variant={isPeak ? "destructive" : "outline"} className="h-4 px-1.5 text-[10px] font-normal">
                    {phase.durationMonths} mos
                  </Badge>
                </div>

                <div className="text-foreground text-lg font-bold">
                  {formatMoney(phase.monthlyTotalHousingCostPln, "PLN")}
                  <span className="text-muted-foreground text-xs font-normal">/mo</span>
                </div>

                <div className="text-muted-foreground border-border/30 space-y-0.5 border-t pt-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Rent:</span>
                    <span>{formatMoney(phase.monthlyRentPln, "PLN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mortgage / Interest:</span>
                    <span>{formatMoney(phase.monthlyMortgagePln, "PLN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin Fee:</span>
                    <span>{formatMoney(phase.monthlyAdminFeePln, "PLN")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stacked Bar Chart of Monthly Housing Obligations */}
        <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <BarChart3 className="text-muted-foreground size-3.5" /> Housing Cashflow Composition Over Time
            </span>
            <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-xs bg-amber-500" /> Rent
              </span>
              <span className="flex items-center gap-1">
                <span className="bg-primary size-2 rounded-xs" /> Mortgage
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-xs bg-blue-400" /> Admin Fee
              </span>
            </div>
          </div>

          <div className="h-44 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis fontSize={10} tickLine={false} tickFormatter={(val) => `${Math.round(val / 1000)}k`} />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [formatMoney(Number(value) || 0, "PLN"), String(name)]}
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    borderColor: "var(--border)",
                    fontSize: "12px",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="Rent" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Mortgage" stackId="a" fill="var(--color-primary, #6366f1)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Admin Fee" stackId="a" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
