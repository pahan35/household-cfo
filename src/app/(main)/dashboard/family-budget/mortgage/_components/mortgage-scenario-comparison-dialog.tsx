"use client";

import { useMemo, useState } from "react";

import { Check, Star } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { calculateAmortization, calculateOverlapTimeline, calculatePropertyAcquisition } from "./mortgage-engine";
import type { MortgageScenario } from "./mortgage-types";

export interface MortgageScenarioComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarios: MortgageScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
}

function renderCostDeltaBadge(delta: number | null) {
  if (delta === null) return null;
  if (delta === 0) {
    return <span className="text-muted-foreground text-[10px] font-normal">Same as baseline</span>;
  }
  if (delta > 0) {
    return (
      <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">+{formatMoney(delta, "PLN")}</span>
    );
  }
  return (
    <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
      -{formatMoney(Math.abs(delta), "PLN")}
    </span>
  );
}

function renderExpenseDeltaBadge(delta: number | null, unit = "") {
  if (delta === null) return null;
  if (delta === 0) {
    return <span className="text-muted-foreground text-[10px] font-normal">Same as baseline</span>;
  }
  if (delta > 0) {
    return (
      <span className="text-[10px] font-normal text-rose-600 dark:text-rose-400">
        +{formatMoney(delta, "PLN")}
        {unit}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
      -{formatMoney(Math.abs(delta), "PLN")}
      {unit}
    </span>
  );
}

export function MortgageScenarioComparisonDialog({
  open,
  onOpenChange,
  scenarios,
  activeScenarioId,
  onSelectScenario,
}: MortgageScenarioComparisonDialogProps) {
  // Selected scenarios to compare (defaults to all scenarios, up to 4)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => scenarios.slice(0, 4).map((s) => s.id));

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least one selected
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const comparedScenarios = useMemo(() => {
    return scenarios.filter((s) => selectedIds.includes(s.id));
  }, [scenarios, selectedIds]);

  // Derived financial computations for each compared scenario
  const scenarioMetrics = useMemo(() => {
    return comparedScenarios.map((scenario) => {
      const propertySummary = calculatePropertyAcquisition(
        scenario.config.property,
        scenario.config.financing.downPaymentPct,
      );
      const amortization = calculateAmortization(propertySummary.loanPrincipalPln, scenario.config.financing);
      const stressedFinancing = {
        ...scenario.config.financing,
        rateStressDeltaPct: Math.max(2.0, (scenario.config.financing.rateStressDeltaPct || 0) + 2.0),
      };
      const stressedAmortization = calculateAmortization(propertySummary.loanPrincipalPln, stressedFinancing);
      const overlapSummary = calculateOverlapTimeline({
        propertySummary,
        amortization,
        overlapConfig: scenario.config.overlap,
      });

      return {
        scenario,
        propertySummary,
        amortization,
        stressedAmortization,
        overlapSummary,
      };
    });
  }, [comparedScenarios]);

  // Baseline scenario (primary if selected, else first selected)
  const baseline = useMemo(() => {
    return scenarioMetrics.find((m) => m.scenario.isPrimary) ?? scenarioMetrics[0];
  }, [scenarioMetrics]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-xl">Mortgage Scenario Comparison Matrix</DialogTitle>
              <DialogDescription>
                Compare acquisition costs, day-1 capital requirements, monthly debt service, and overlap carrying costs
                across saved plans.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scenario Selection Checkbox Strip */}
        <div className="border-border/60 flex flex-wrap items-center gap-3 border-y py-2.5">
          <span className="text-muted-foreground text-xs font-medium">Compare:</span>
          {scenarios.map((s) => {
            const isChecked = selectedIds.includes(s.id);
            const inputId = `compare-scenario-${s.id}`;
            return (
              <div
                key={s.id}
                className="border-border/50 bg-background hover:bg-muted/30 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
              >
                <Checkbox
                  id={inputId}
                  checked={isChecked}
                  onCheckedChange={() => toggleScenario(s.id)}
                  disabled={isChecked && selectedIds.length <= 1}
                />
                <label htmlFor={inputId} className="cursor-pointer font-medium">
                  {s.name}
                </label>
                {s.isPrimary && (
                  <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                    Primary
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="border-border/70 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[200px] text-xs font-semibold">Financial Metric</TableHead>
                {scenarioMetrics.map(({ scenario }) => (
                  <TableHead key={scenario.id} className="min-w-[190px] text-xs font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{scenario.name}</span>
                      {scenario.isPrimary && <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {/* Category: Property Acquisition */}
              <TableRow className="bg-muted/20 text-muted-foreground font-semibold">
                <TableCell colSpan={scenarioMetrics.length + 1} className="py-2 text-[11px] tracking-wider uppercase">
                  Property Acquisition & Pricing
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Area & Price / m²</TableCell>
                {scenarioMetrics.map(({ scenario }) => (
                  <TableCell key={scenario.id}>
                    {scenario.config.property.areaSqm} m² @{" "}
                    {formatMoney(scenario.config.property.pricePerSqmPln, "PLN")}/m²
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Total Property Price</TableCell>
                {scenarioMetrics.map(({ scenario, propertySummary }) => {
                  const delta =
                    baseline && baseline.scenario.id !== scenario.id
                      ? propertySummary.propertyTotalPln - baseline.propertySummary.propertyTotalPln
                      : null;
                  return (
                    <TableCell key={scenario.id} className="text-foreground font-semibold">
                      <div>{formatMoney(propertySummary.propertyTotalPln, "PLN")}</div>
                      {renderCostDeltaBadge(delta)}
                    </TableCell>
                  );
                })}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Renovation Budget</TableCell>
                {scenarioMetrics.map(({ scenario, propertySummary }) => (
                  <TableCell key={scenario.id}>
                    {formatMoney(propertySummary.renovationTotalPln, "PLN")}
                    <span className="text-muted-foreground block text-[10px]">
                      (
                      {scenario.config.property.renovationFundingMode === "cash"
                        ? "Cash funded"
                        : "Bundled in mortgage"}
                      )
                    </span>
                  </TableCell>
                ))}
              </TableRow>

              {/* Category: Day-1 Capital & Financing */}
              <TableRow className="bg-muted/20 text-muted-foreground font-semibold">
                <TableCell colSpan={scenarioMetrics.length + 1} className="py-2 text-[11px] tracking-wider uppercase">
                  Financing & Day-1 Capital
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Day-1 Upfront Cash (M1)</TableCell>
                {scenarioMetrics.map(({ scenario, propertySummary }) => {
                  const delta =
                    baseline && baseline.scenario.id !== scenario.id
                      ? propertySummary.upfrontCashMilestone1Pln - baseline.propertySummary.upfrontCashMilestone1Pln
                      : null;
                  return (
                    <TableCell key={scenario.id} className="text-primary font-semibold">
                      <div>{formatMoney(propertySummary.upfrontCashMilestone1Pln, "PLN")}</div>
                      {renderExpenseDeltaBadge(delta)}
                    </TableCell>
                  );
                })}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Down Payment</TableCell>
                {scenarioMetrics.map(({ scenario, propertySummary }) => (
                  <TableCell key={scenario.id}>
                    {formatMoney(propertySummary.downPaymentPln, "PLN")} ({scenario.config.financing.downPaymentPct}%)
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Bank Loan Principal</TableCell>
                {scenarioMetrics.map(({ scenario, propertySummary }) => (
                  <TableCell key={scenario.id}>
                    {formatMoney(propertySummary.loanPrincipalPln, "PLN")}
                    <span className="text-muted-foreground block text-[10px]">
                      {scenario.config.financing.loanTermYears} years ({scenario.config.financing.installmentType})
                    </span>
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">1st Monthly Installment</TableCell>
                {scenarioMetrics.map(({ scenario, amortization }) => {
                  const delta =
                    baseline && baseline.scenario.id !== scenario.id
                      ? amortization.firstMonthInstallmentPln - baseline.amortization.firstMonthInstallmentPln
                      : null;
                  return (
                    <TableCell key={scenario.id} className="text-foreground font-semibold">
                      <div>
                        {formatMoney(amortization.firstMonthInstallmentPln, "PLN")}
                        <span className="text-muted-foreground font-normal">/mo</span>
                      </div>
                      <span className="text-muted-foreground block text-[10px]">
                        Rate: {amortization.effectiveRatePct.toFixed(2)}%
                      </span>
                      {renderExpenseDeltaBadge(delta, "/mo")}
                    </TableCell>
                  );
                })}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Stressed Installment</TableCell>
                {scenarioMetrics.map(({ scenario, stressedAmortization }) => (
                  <TableCell key={scenario.id}>
                    {formatMoney(stressedAmortization.firstMonthInstallmentPln, "PLN")}
                    <span className="text-muted-foreground font-normal">/mo</span>
                    <span className="text-muted-foreground block text-[10px]">
                      Stressed: {stressedAmortization.effectiveRatePct.toFixed(2)}%
                    </span>
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Total Loan Interest</TableCell>
                {scenarioMetrics.map(({ scenario, amortization }) => (
                  <TableCell key={scenario.id}>{formatMoney(amortization.totalInterestPln, "PLN")}</TableCell>
                ))}
              </TableRow>

              {/* Category: Construction & Overlap Timeline */}
              <TableRow className="bg-muted/20 text-muted-foreground font-semibold">
                <TableCell colSpan={scenarioMetrics.length + 1} className="py-2 text-[11px] tracking-wider uppercase">
                  Timeline & Overlap Carrying Cost
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Overlap Duration</TableCell>
                {scenarioMetrics.map(({ scenario, overlapSummary }) => (
                  <TableCell key={scenario.id}>
                    {overlapSummary.phases.reduce((acc, p) => acc + p.durationMonths, 0)} months
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="text-muted-foreground font-medium">Overlap Carrying Cost</TableCell>
                {scenarioMetrics.map(({ scenario, overlapSummary }) => (
                  <TableCell key={scenario.id}>{formatMoney(overlapSummary.totalOverlapCostPln, "PLN")}</TableCell>
                ))}
              </TableRow>

              {/* Action: Activate Scenario */}
              <TableRow className="bg-muted/10">
                <TableCell className="font-medium">Active Selection</TableCell>
                {scenarioMetrics.map(({ scenario }) => {
                  const isActive = scenario.id === activeScenarioId;
                  return (
                    <TableCell key={scenario.id}>
                      {isActive ? (
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary gap-1">
                          <Check className="size-3" />
                          Currently Active
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onSelectScenario(scenario.id);
                            onOpenChange(false);
                          }}
                          className="h-7 text-xs"
                        >
                          Switch to Plan
                        </Button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
