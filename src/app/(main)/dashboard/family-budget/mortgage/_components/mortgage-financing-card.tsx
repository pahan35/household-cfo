"use client";

import { Banknote, Percent } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { AmortizationSummary, MortgageFinancingConfig, PropertyAcquisitionSummary } from "./mortgage-types";

interface MortgageFinancingCardProps {
  config: MortgageFinancingConfig;
  propertySummary: PropertyAcquisitionSummary;
  amortization: AmortizationSummary;
  onChange: (updated: MortgageFinancingConfig) => void;
}

const COMMON_DOWN_PAYMENTS = [10, 15, 20, 25, 30];

export function MortgageFinancingCard({ config, propertySummary, amortization, onChange }: MortgageFinancingCardProps) {
  const update = (patch: Partial<MortgageFinancingConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Banknote className="text-primary size-5" />
            <CardTitle className="text-base font-semibold">Mortgage Financing & Loan Structure</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              Principal: <strong>{formatMoney(propertySummary.loanPrincipalPln, "PLN")}</strong>
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              1st Installment: <strong>{formatMoney(amortization.firstMonthInstallmentPln, "PLN")}</strong>
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Select down payment ratio, mortgage amortization schedule (Equal vs Decreasing), reference rates, and stress
          delta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Down Payment Selector */}
        <div className="border-border/50 bg-muted/20 space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-foreground text-xs font-medium">Down Payment (*Wkład własny*)</Label>
              <p className="text-muted-foreground text-[11px]">
                Minimum 10% (with low-down-payment insurance) or 20% standard.
              </p>
            </div>
            <div className="text-right">
              <span className="text-foreground text-sm font-semibold">
                {formatMoney(propertySummary.downPaymentPln, "PLN")}
              </span>
              <span className="text-muted-foreground ml-1.5 text-xs">({config.downPaymentPct}%)</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {COMMON_DOWN_PAYMENTS.map((pct) => (
              <Button
                key={pct}
                type="button"
                variant={config.downPaymentPct === pct ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => update({ downPaymentPct: pct })}
              >
                {pct}%
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <Label htmlFor="customDownPayment" className="text-muted-foreground text-xs">
                Custom %:
              </Label>
              <Input
                id="customDownPayment"
                type="number"
                min="5"
                max="80"
                step="1"
                value={config.downPaymentPct || ""}
                onChange={(e) => update({ downPaymentPct: Math.min(90, Math.max(0, Number(e.target.value) || 0)) })}
                className="h-7 w-16 text-center text-xs"
              />
            </div>
          </div>
        </div>

        {/* Schedule & Term */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Installment Type */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <Label className="text-xs font-medium">Installment Schedule</Label>
            <Tabs
              value={config.installmentType}
              onValueChange={(val) => update({ installmentType: val as MortgageFinancingConfig["installmentType"] })}
            >
              <TabsList className="grid h-8 w-full grid-cols-2 text-xs">
                <TabsTrigger value="equal" className="text-xs">
                  Equal (Równe)
                </TabsTrigger>
                <TabsTrigger value="decreasing" className="text-xs">
                  Decreasing (Malejące)
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-[11px]">
              {config.installmentType === "equal"
                ? "Predictable constant monthly payment. Higher lifetime interest."
                : "Initial payments are higher, but faster principal decay saves lifetime interest."}
            </p>
          </div>

          {/* Loan Term */}
          <div className="border-border/50 bg-muted/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="loanTermYears" className="text-xs font-medium">
                Loan Term (Years)
              </Label>
              <span className="text-xs font-semibold">
                {config.loanTermYears} years ({config.loanTermYears * 12} mos)
              </span>
            </div>
            <div className="pt-2">
              <Slider
                id="loanTermYears"
                min={10}
                max={35}
                step={5}
                value={[config.loanTermYears]}
                onValueChange={([val]) => update({ loanTermYears: val })}
              />
            </div>
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>10 yrs</span>
              <span>20 yrs</span>
              <span>25 yrs</span>
              <span>30 yrs</span>
              <span>35 yrs</span>
            </div>
          </div>
        </div>

        {/* Interest Rates & Margin */}
        <div className="border-border/50 bg-muted/10 space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Percent className="text-muted-foreground size-4" />
              <Label className="text-xs font-medium">Interest Rate Components</Label>
            </div>
            <div className="text-foreground text-xs font-semibold">
              Total Rate: {amortization.effectiveRatePct.toFixed(2)}%
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="referenceRate" className="text-muted-foreground text-xs">
                Reference Rate (WIBOR / WIRON %)
              </Label>
              <Input
                id="referenceRate"
                type="number"
                step="0.05"
                min="0"
                max="20"
                value={config.referenceRatePct}
                onChange={(e) => update({ referenceRatePct: Number(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankMargin" className="text-muted-foreground text-xs">
                Bank Margin (*Marża banku* %)
              </Label>
              <Input
                id="bankMargin"
                type="number"
                step="0.05"
                min="0"
                max="10"
                value={config.bankMarginPct}
                onChange={(e) => update({ bankMarginPct: Number(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Interactive Stress Slider */}
          <div className="border-border/40 space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                Rate Stress Delta:
                <strong className={config.rateStressDeltaPct > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                  {config.rateStressDeltaPct > 0
                    ? `+${config.rateStressDeltaPct.toFixed(2)}%`
                    : `${config.rateStressDeltaPct.toFixed(2)}%`}
                </strong>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-5 px-1.5 text-[11px]"
                onClick={() => update({ rateStressDeltaPct: 0 })}
              >
                Reset Stress
              </Button>
            </div>
            <Slider
              min={-2}
              max={3}
              step={0.25}
              value={[config.rateStressDeltaPct]}
              onValueChange={([val]) => update({ rateStressDeltaPct: val })}
            />
          </div>
        </div>

        {/* Amortization KPI Strip */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-4">
          <div className="border-border/40 bg-muted/20 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[11px]">Loan Principal</span>
            <span className="text-foreground text-sm font-semibold">
              {formatMoney(propertySummary.loanPrincipalPln, "PLN")}
            </span>
          </div>
          <div className="border-border/40 bg-muted/20 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[11px]">First Installment</span>
            <span className="text-foreground text-sm font-semibold">
              {formatMoney(amortization.firstMonthInstallmentPln, "PLN")}
            </span>
          </div>
          <div className="border-border/40 bg-muted/20 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[11px]">Total Interest</span>
            <span className="text-foreground text-sm font-semibold">
              {formatMoney(amortization.totalInterestPln, "PLN")}
            </span>
          </div>
          <div className="border-border/40 bg-muted/20 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[11px]">Day-1 Cash Needed</span>
            <span className="text-primary text-sm font-semibold">
              {formatMoney(propertySummary.upfrontCashMilestone1Pln, "PLN")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
