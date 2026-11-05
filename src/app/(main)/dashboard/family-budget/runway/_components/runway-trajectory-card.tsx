"use client";

import { useMemo, useState } from "react";

import { ChevronDown, ChevronUp, LineChart as LineChartIcon, Table as TableIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";

import type { RunwayScenarioResult } from "./runway-types";

interface RunwayTrajectoryCardProps {
  austerityScenario: RunwayScenarioResult;
  baselineScenario: RunwayScenarioResult;
  suspendedScenario: RunwayScenarioResult;
}

const chartConfig: ChartConfig = {
  austerity: {
    label: "Configured Austerity",
    color: "var(--color-chart-1, #2563eb)",
  },
  baseline: {
    label: "Baseline 100% Spend",
    color: "var(--color-chart-5, #f59e0b)",
  },
  suspended: {
    label: "Suspended JDG",
    color: "var(--color-chart-2, #10b981)",
  },
};

export function RunwayTrajectoryCard({
  austerityScenario,
  baselineScenario,
  suspendedScenario,
}: RunwayTrajectoryCardProps) {
  const [showTable, setShowTable] = useState(true);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showSuspendedCurve, setShowSuspendedCurve] = useState(true);

  // Prepare chart data combining the 3 scenarios
  const chartData = useMemo(() => {
    const maxLength = Math.max(
      austerityScenario.rows.length,
      baselineScenario.rows.length,
      suspendedScenario.rows.length,
    );

    const points = [];
    for (let i = 0; i < maxLength; i++) {
      const aRow = austerityScenario.rows[i];
      const bRow = baselineScenario.rows[i];
      const sRow = suspendedScenario.rows[i];

      if (!aRow && !bRow && !sRow) continue;

      const yearMonth = aRow?.yearMonth ?? bRow?.yearMonth ?? sRow?.yearMonth ?? `M${i + 1}`;
      const monthIndex = i + 1;

      // Clamping visual curves at 0 or allowing slight negative to show deficit
      points.push({
        monthIndex,
        yearMonth,
        austerity: aRow ? Math.max(0, Math.round(aRow.endingBalancePln)) : 0,
        baseline: bRow ? Math.max(0, Math.round(bRow.endingBalancePln)) : 0,
        suspended: sRow ? Math.max(0, Math.round(sRow.endingBalancePln)) : 0,
        rawAusterity: aRow?.endingBalancePln ?? 0,
      });
    }

    // Only show months until all series have been depleted for a few months to avoid 50 empty flat months
    let lastActiveMonth = 12;
    for (let i = 0; i < points.length; i++) {
      if (points[i].austerity > 0 || points[i].baseline > 0 || points[i].suspended > 0) {
        lastActiveMonth = Math.max(lastActiveMonth, i + 3);
      }
    }

    return points.slice(0, Math.min(points.length, Math.max(18, lastActiveMonth)));
  }, [austerityScenario, baselineScenario, suspendedScenario]);

  const visibleTableRows = showAllRows ? austerityScenario.rows : austerityScenario.rows.slice(0, 18);

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">Capital Depletion Trajectory</CardTitle>
              <CardDescription className="text-xs">
                Multi-year projection comparing baseline living lifestyle against configured austerity and suspended JDG
                scenarios.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSuspendedCurve(!showSuspendedCurve)}
            >
              {showSuspendedCurve ? "Hide Suspended JDG" : "Show Suspended JDG"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowTable(!showTable)}
            >
              <TableIcon className="size-3.5" />
              {showTable ? "Hide Cashflow Table" : "Show Cashflow Table"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Multi-series Recharts Depletion Chart */}
        <div className="h-[280px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="yearMonth"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-[11px] text-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(val: number) => `${Math.round(val / 1000)}k`}
                className="text-[11px] text-muted-foreground"
              />
              <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="3 3" />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const dataPoint = payload[0].payload as {
                    yearMonth: string;
                    monthIndex: number;
                    austerity: number;
                    baseline: number;
                    suspended: number;
                  };

                  return (
                    <div className="rounded-lg border border-border bg-background p-2.5 shadow-md text-xs space-y-1.5">
                      <div className="font-semibold text-foreground">
                        Month {dataPoint.monthIndex} ({dataPoint.yearMonth})
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-[var(--color-chart-1,#2563eb)]" />
                            Austerity:
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            {formatMoney(dataPoint.austerity, "PLN")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full bg-[var(--color-chart-5,#f59e0b)]" />
                            Baseline 100%:
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            {formatMoney(dataPoint.baseline, "PLN")}
                          </span>
                        </div>
                        {showSuspendedCurve && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full bg-[var(--color-chart-2,#10b981)]" />
                              Suspended JDG:
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatMoney(dataPoint.suspended, "PLN")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="baseline"
                name="Baseline 100% Spend"
                stroke="var(--color-chart-5, #f59e0b)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="austerity"
                name="Configured Austerity"
                stroke="var(--color-chart-1, #2563eb)"
                strokeWidth={2.5}
                dot={false}
              />
              {showSuspendedCurve && (
                <Line
                  type="monotone"
                  dataKey="suspended"
                  name="Suspended JDG"
                  stroke="var(--color-chart-2, #10b981)"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        </div>

        {/* Month-by-Month Cashflow Breakdown Table */}
        {showTable && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Month-by-Month Cashflow Projection (Austerity Scenario)
              </span>
              <span className="text-xs text-muted-foreground">
                Showing {visibleTableRows.length} of {austerityScenario.rows.length} simulated months
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Month</th>
                    <th className="px-3 py-2.5">Starting Capital</th>
                    <th className="px-3 py-2.5">Month-1 Tax Tail</th>
                    <th className="px-3 py-2.5">Net ZUS</th>
                    <th className="px-3 py-2.5">Health Ins.</th>
                    <th className="px-3 py-2.5">Accounting</th>
                    <th className="px-3 py-2.5">Living Burn</th>
                    <th className="px-3 py-2.5 text-right">Ending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-normal">
                  {visibleTableRows.map((row) => {
                    const isDepleted = row.endingBalancePln <= 0;
                    return (
                      <tr
                        key={row.monthIndex}
                        className={`transition-colors hover:bg-muted/30 ${
                          isDepleted ? "bg-destructive/5 text-destructive font-medium" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">#{row.monthIndex}</span>
                            <span className="text-muted-foreground">({row.yearMonth})</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-foreground">
                          {formatMoney(row.startingBalancePln, "PLN")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.month1TaxTailPln > 0 ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px]"
                            >
                              -{formatMoney(row.month1TaxTailPln, "PLN")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-foreground">
                          {row.isWakacjeSkladkoweMonth ? (
                            <Badge variant="secondary" className="px-1 text-[10px]">
                              Wakacje (0 PLN)
                            </Badge>
                          ) : (
                            formatMoney(row.netZusPln, "PLN")
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-foreground">
                          <div className="flex items-center gap-1">
                            <span>{formatMoney(row.healthPln, "PLN")}</span>
                            {row.isRyczaltTier1Reset && (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-1 text-[9px]"
                              >
                                Tier 1 Reset
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-foreground">
                          {formatMoney(row.accountingPln, "PLN")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-foreground">
                          {formatMoney(row.livingBurnPln, "PLN")}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className={isDepleted ? "font-bold text-destructive" : "font-semibold text-foreground"}>
                            {formatMoney(row.endingBalancePln, "PLN")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {austerityScenario.rows.length > 18 && (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={() => setShowAllRows(!showAllRows)}
                >
                  {showAllRows ? (
                    <>
                      <ChevronUp className="size-3.5" />
                      Show Fewer Months
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5" />
                      Show All {austerityScenario.rows.length} Projected Months
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
