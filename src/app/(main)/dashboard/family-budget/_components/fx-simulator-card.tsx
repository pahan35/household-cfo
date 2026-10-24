"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "cn";
import { AlertTriangle, CheckCircle2, RefreshCw, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

import { formatMoney } from "./external-provider-data";
import { generateFxScenarios, simulateUsdIncome } from "./macro-transforms";
import { SectionShell } from "./section-shell";

export interface FxSimulatorCardProps {
  currentMonthlyExpensesPln?: number;
  defaultUsdSalary?: number;
  defaultFxRate?: number;
  defaultTaxPct?: number;
  isLoading?: boolean;
}

export function FxSimulatorCard({
  currentMonthlyExpensesPln = 12000,
  defaultUsdSalary = 5000,
  defaultFxRate = 3.95,
  defaultTaxPct = 12,
  isLoading = false,
}: FxSimulatorCardProps) {
  const [usdSalary, setUsdSalary] = useState<number>(defaultUsdSalary);
  const [fxRate, setFxRate] = useState<number>(defaultFxRate);
  const [taxPct, setTaxPct] = useState<number>(defaultTaxPct);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(currentMonthlyExpensesPln);

  const usdInputId = useId();
  const expenseInputId = useId();

  // Reset to defaults
  const handleReset = () => {
    setUsdSalary(defaultUsdSalary);
    setFxRate(defaultFxRate);
    setTaxPct(defaultTaxPct);
    setMonthlyExpenses(currentMonthlyExpensesPln);
  };

  const simulation = useMemo(() => {
    return simulateUsdIncome({
      usdSalaryGross: usdSalary,
      usdPlnRate: fxRate,
      taxRatePct: taxPct,
      monthlyExpensesPln: monthlyExpenses,
    });
  }, [usdSalary, fxRate, taxPct, monthlyExpenses]);

  const scenarios = useMemo(() => {
    return generateFxScenarios(usdSalary, taxPct, monthlyExpenses, fxRate);
  }, [usdSalary, taxPct, monthlyExpenses, fxRate]);

  const isSafeMargin = simulation.projectedPlnMargin > 0;
  const isComfortableBuffer = simulation.projectedSavingsRate >= 20;

  return (
    <SectionShell
      title="Forward USD/PLN Sensitivity Simulator"
      description="Model upcoming USD salary conversion, tax withholding, and PLN living expense coverage across exchange rate fluctuations."
      action={
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" />
          <span>Reset Defaults</span>
        </Button>
      }
      isLoading={isLoading}
    >
      <div className="space-y-6">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* 1. USD Gross Salary */}
          <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 space-y-3">
            <div>
              <label htmlFor={usdInputId} className="text-muted-foreground text-xs font-medium">
                USD Gross Monthly Salary
              </label>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-muted-foreground text-sm font-semibold">$</span>
                <Input
                  id={usdInputId}
                  type="number"
                  min={1000}
                  max={50000}
                  step={100}
                  value={usdSalary || ""}
                  onChange={(e) => setUsdSalary(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                  className="font-mono font-semibold"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {[4000, 5000, 6000, 7500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setUsdSalary(preset)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-mono transition-colors",
                    usdSalary === preset
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  ${preset / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* 2. USD/PLN Exchange Rate */}
          <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">USD/PLN Exchange Rate</span>
                <span className="font-mono font-bold text-sm text-foreground">{fxRate.toFixed(2)} zł</span>
              </div>
              <div className="pt-3">
                <Slider
                  min={3.5}
                  max={4.8}
                  step={0.01}
                  value={[fxRate]}
                  onValueChange={(val) => setFxRate(val[0])}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-between gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setFxRate(3.6)}
                className="rounded px-1.5 py-0.5 bg-muted text-muted-foreground hover:text-foreground"
              >
                3.60 Low
              </button>
              <button
                type="button"
                onClick={() => setFxRate(3.95)}
                className="rounded px-1.5 py-0.5 bg-muted text-muted-foreground hover:text-foreground font-semibold"
              >
                3.95 Base
              </button>
              <button
                type="button"
                onClick={() => setFxRate(4.3)}
                className="rounded px-1.5 py-0.5 bg-muted text-muted-foreground hover:text-foreground"
              >
                4.30 High
              </button>
              <button
                type="button"
                onClick={() => setFxRate(4.6)}
                className="rounded px-1.5 py-0.5 bg-muted text-muted-foreground hover:text-foreground"
              >
                4.60 Peak
              </button>
            </div>
          </div>

          {/* 3. Tax / Deductions Rate */}
          <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">Estimated Tax & Deductions</span>
                <span className="font-mono font-bold text-sm text-foreground">{taxPct}%</span>
              </div>
              <div className="pt-3">
                <Slider
                  min={0}
                  max={35}
                  step={1}
                  value={[taxPct]}
                  onValueChange={(val) => setTaxPct(val[0])}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0% None</span>
              <button
                type="button"
                onClick={() => setTaxPct(12)}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                12% Flat/B2B
              </button>
              <span>32% Scale</span>
            </div>
          </div>

          {/* 4. Monthly Living Expenses */}
          <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 space-y-3">
            <div>
              <label htmlFor={expenseInputId} className="text-muted-foreground text-xs font-medium">
                Controllable Expenses (PLN)
              </label>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Input
                  id={expenseInputId}
                  type="number"
                  min={1000}
                  max={100000}
                  step={200}
                  value={monthlyExpenses || ""}
                  onChange={(e) => setMonthlyExpenses(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                  className="font-mono font-semibold"
                />
                <span className="text-muted-foreground text-sm font-semibold">zł</span>
              </div>
            </div>
            <span className="text-muted-foreground text-[10px]">Active controllable household run-rate</span>
          </div>
        </div>

        {/* Projection KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <span className="text-muted-foreground text-xs font-medium">Projected Net Income</span>
            <div className="mt-1.5 font-bold font-mono text-xl text-foreground">
              {formatMoney(simulation.projectedPlnNet, "PLN")}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Gross: {formatMoney(simulation.projectedPlnGross, "PLN")} (Tax: -
              {formatMoney(simulation.projectedPlnTax, "PLN")})
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border p-4",
              isSafeMargin ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20",
            )}
          >
            <span className="text-muted-foreground text-xs font-medium">Projected Savings Buffer</span>
            <div
              className={cn(
                "mt-1.5 font-bold font-mono text-xl",
                isSafeMargin ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {simulation.projectedPlnMargin >= 0 ? "+" : ""}
              {formatMoney(simulation.projectedPlnMargin, "PLN")}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px]">
              {isSafeMargin ? (
                <>
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {simulation.projectedSavingsRate.toFixed(1)}% savings rate
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3 text-destructive" />
                  <span className="text-destructive font-medium">Deficit at this rate</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <span className="text-muted-foreground text-xs font-medium">Expense Coverage</span>
            <div className="mt-1.5 font-bold font-mono text-xl text-foreground">
              {simulation.expenseCoverageRatio.toFixed(2)}x
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {simulation.expenseCoverageRatio >= 1.5
                ? "Healthy liquidity buffer"
                : simulation.expenseCoverageRatio >= 1.0
                  ? "Covers expenses closely"
                  : "Under water without savings"}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <span className="text-muted-foreground text-xs font-medium">Breakeven FX Rate</span>
            <div className="mt-1.5 font-bold font-mono text-xl text-foreground">
              {simulation.breakevenFxRate.toFixed(2)} zł
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">USD/PLN floor to stay cashflow positive</div>
          </div>
        </div>

        {/* Sensitivity Rate Table / Step Breakdown */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <Scale className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold">USD/PLN Rate Sensitivity Matrix</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Assuming ${usdSalary.toLocaleString()} gross & {taxPct}% tax
            </span>
          </div>

          <div className="divide-y overflow-x-auto text-xs">
            <div className="grid grid-cols-5 px-4 py-2 font-medium text-muted-foreground bg-muted/15">
              <span>FX Rate</span>
              <span className="text-right">Projected Net (PLN)</span>
              <span className="text-right">Living Expenses</span>
              <span className="text-right">Monthly Buffer</span>
              <span className="text-right">Savings Rate</span>
            </div>

            {scenarios.map((step) => {
              const isSelected = Math.abs(step.fxRate - fxRate) < 0.005;
              const isPositive = step.projectedPlnMargin >= 0;

              return (
                <div
                  key={step.fxRate}
                  className={cn(
                    "grid grid-cols-5 items-center px-4 py-2.5 font-mono transition-colors",
                    isSelected ? "bg-primary/10 font-semibold" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{step.fxRate.toFixed(2)} zł</span>
                    {isSelected && (
                      <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                        Current
                      </Badge>
                    )}
                  </div>

                  <span className="text-right font-medium">{formatMoney(step.projectedPlnNet, "PLN")}</span>
                  <span className="text-right text-muted-foreground">{formatMoney(monthlyExpenses, "PLN")}</span>

                  <span
                    className={cn(
                      "text-right font-semibold",
                      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {formatMoney(step.projectedPlnMargin, "PLN")}
                  </span>

                  <span
                    className={cn(
                      "text-right",
                      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    {step.savingsRate.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
