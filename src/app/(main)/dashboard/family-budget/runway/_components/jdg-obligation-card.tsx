"use client";

import { Building2, Receipt, Sparkles } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { STATUTORY_DEFAULTS } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/polish-tax-engine";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { JdgPosture, JdgRunwayConfig, JdgTaxRegime, RyczaltYtdHealthTier } from "./runway-types";

interface JdgObligationCardProps {
  config: JdgRunwayConfig;
  onChange: (updated: JdgRunwayConfig) => void;
  autoDetectedVat7Pln?: number;
  autoDetectedPpePln?: number;
  referenceTaxMonth?: string;
}

export function JdgObligationCard({
  config,
  onChange,
  autoDetectedVat7Pln = 0,
  autoDetectedPpePln = 0,
  referenceTaxMonth,
}: JdgObligationCardProps) {
  const updateConfig = (patch: Partial<JdgRunwayConfig>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  const handleApplyAutoDetectedTaxes = () => {
    updateConfig({
      month1Vat7Pln: autoDetectedVat7Pln,
      month1PpePln: autoDetectedPpePln,
      includeMonth1TaxTail: true,
    });
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <CardTitle className="text-base font-semibold">Statutory JDG Zero-Revenue Engine</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Polish B2B Posture
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Configure statutory ZUS, health insurance tiers, and lagged tax obligations when client invoicing drops to 0
          PLN.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 1. Posture Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Operational Posture
          </Label>
          <Tabs
            value={config.posture}
            onValueChange={(val) => updateConfig({ posture: val as JdgPosture })}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active" className="text-xs">
                Active JDG
              </TabsTrigger>
              <TabsTrigger value="wakacje_skladkowe" className="text-xs">
                Wakacje Składkowe
              </TabsTrigger>
              <TabsTrigger value="suspended" className="text-xs">
                Suspended (Zawieszenie)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
            {config.posture === "active" && (
              <p>
                <strong>Active JDG:</strong> Obligated to pay monthly ZUS Społeczny, Składka Zdrowotna, and accounting.
                PPE and VAT-7 drop to 0 PLN from Month 2 onward.
              </p>
            )}
            {config.posture === "wakacje_skladkowe" && (
              <p>
                <strong>Wakacje Składkowe:</strong> Exempts ZUS Społeczny (and PFRON rebate) for 1 month/year. Składka
                Zdrowotna remains due during the holiday month.
              </p>
            )}
            {config.posture === "suspended" && (
              <p>
                <strong>Suspended (Zawieszenie działalności):</strong> 0 PLN ZUS Społeczny and 0 PLN mandatory health
                insurance. Free family NFZ coverage if registered under spouse's UoP.
              </p>
            )}
          </div>
        </div>

        {/* 2. ZUS & Health Settings (Visible if Active or Wakacje Składkowe) */}
        {config.posture !== "suspended" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Regime */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tax Regime</Label>
              <Select value={config.regime} onValueChange={(v) => updateConfig({ regime: v as JdgTaxRegime })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b_ryczalt" className="text-xs">
                    B2B Ryczałt (3-Tier Health)
                  </SelectItem>
                  <SelectItem value="b2b_liniowy" className="text-xs">
                    B2B Liniowy (Min Health)
                  </SelectItem>
                  <SelectItem value="b2b_skala" className="text-xs">
                    B2B Skala (Min Health)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ZUS Stage */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ZUS Stage</Label>
              <Select
                value={config.zusStage}
                onValueChange={(v) => updateConfig({ zusStage: v as typeof config.zusStage })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duzy_zus" className="text-xs">
                    Duży ZUS (Standard)
                  </SelectItem>
                  <SelectItem value="preferencyjny" className="text-xs">
                    Preferencyjny ZUS (Mały ZUS)
                  </SelectItem>
                  <SelectItem value="ulga_na_start" className="text-xs">
                    Ulga na start (0 ZUS)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ryczałt YTD Health Tier */}
            {config.regime === "b2b_ryczalt" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Current YTD Health Tier</Label>
                  <Badge variant="secondary" className="px-1 text-[10px] font-normal">
                    Jan 1 resets to Tier 1
                  </Badge>
                </div>
                <Select
                  value={config.ryczaltYtdHealthTier}
                  onValueChange={(v) => updateConfig({ ryczaltYtdHealthTier: v as RyczaltYtdHealthTier })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier1" className="text-xs">
                      Tier 1 (&lt;= 60k PLN) — {formatMoney(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY, "PLN")}
                    </SelectItem>
                    <SelectItem value="tier2" className="text-xs">
                      Tier 2 (60k–300k PLN) — {formatMoney(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY, "PLN")}
                    </SelectItem>
                    <SelectItem value="tier3" className="text-xs">
                      Tier 3 (&gt; 300k PLN) — {formatMoney(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY, "PLN")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Statutory Min Health</Label>
                <div className="flex h-8 items-center rounded-md border border-border/60 bg-muted/40 px-3 text-xs tabular-nums text-foreground">
                  {formatMoney(STATUTORY_DEFAULTS.LINIOWY_MIN_HEALTH_MONTHLY, "PLN")} / mo
                </div>
              </div>
            )}

            {/* Voluntary Sickness */}
            <div className="flex items-center justify-between rounded-md border border-border/60 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Voluntary Sickness (Chorobowe)</Label>
                <p className="text-[11px] text-muted-foreground">+~115 PLN/mo</p>
              </div>
              <Switch
                checked={config.voluntarySickness}
                onCheckedChange={(checked) => updateConfig({ voluntarySickness: checked })}
              />
            </div>

            {/* Wakacje Składkowe designated month */}
            {config.posture === "wakacje_skladkowe" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Holiday Month</Label>
                <Select
                  value={String(config.wakacjeMonthIndex)}
                  onValueChange={(v) => updateConfig({ wakacjeMonthIndex: Number(v) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = i + 1;
                      const date = new Date(2024, i, 1);
                      return (
                        <SelectItem key={m} value={String(m)} className="text-xs">
                          {date.toLocaleString("en-US", { month: "long" })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* PFRON Rebate */}
            <div className="flex items-center justify-between rounded-md border border-border/60 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">PFRON Disability ZUS Rebate</Label>
                <p className="text-[11px] text-muted-foreground">
                  {config.pfronRebate.enabled ? `${config.pfronRebate.percentage}% pension/disability` : "Disabled"}
                </p>
              </div>
              <Switch
                checked={config.pfronRebate.enabled}
                onCheckedChange={(checked) =>
                  updateConfig({
                    pfronRebate: {
                      ...config.pfronRebate,
                      enabled: checked,
                      percentage: config.pfronRebate.percentage || 60,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* Suspended Posture Extras */}
        {config.posture === "suspended" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Voluntary NFZ Insurance</Label>
                <p className="text-[11px] text-muted-foreground">
                  {config.voluntaryNfzWhenSuspended
                    ? `Self-paid voluntary NFZ (~${formatMoney(config.statutoryVoluntaryNfzPln, "PLN")}/mo)`
                    : "0 PLN (covered under spouse's UoP contract)"}
                </p>
              </div>
              <Switch
                checked={config.voluntaryNfzWhenSuspended}
                onCheckedChange={(checked) => updateConfig({ voluntaryNfzWhenSuspended: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Dormant Accounting Fee (PLN/mo)</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={config.suspendedAccountingCostPln}
                onChange={(e) => updateConfig({ suspendedAccountingCostPln: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}

        {/* 3. Monthly Overheads & Secondary Inflows */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {config.posture === "suspended" ? "Standard Accounting (PLN/mo)" : "Monthly Accounting (PLN)"}
            </Label>
            <Input
              type="number"
              min={0}
              className="h-8 text-xs"
              value={config.monthlyAccountingCostPln}
              onChange={(e) => updateConfig({ monthlyAccountingCostPln: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Benefit Replacement Cost</Label>
              <span className="text-[10px] text-muted-foreground">Private medical/sport</span>
            </div>
            <Input
              type="number"
              min={0}
              className="h-8 text-xs"
              value={config.benefitLossReplacementPln}
              onChange={(e) => updateConfig({ benefitLossReplacementPln: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Residual Income (PLN/mo)</Label>
              <span className="text-[10px] text-muted-foreground">Spouse/rental/dividends</span>
            </div>
            <Input
              type="number"
              min={0}
              className="h-8 text-xs"
              value={config.residualMonthlyIncomePln}
              onChange={(e) => updateConfig({ residualMonthlyIncomePln: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* 4. Month-1 Lagged Tax Settlement Tail */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-amber-500" />
              <div>
                <Label className="text-xs font-semibold">Month-1 Tax Settlement Tail (#VAT-7 & #PPE)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Cash-basis lag: taxes for the final billing month are paid in Month 1, then drop to 0 PLN.
                </p>
              </div>
            </div>
            <Switch
              checked={config.includeMonth1TaxTail}
              onCheckedChange={(checked) => updateConfig({ includeMonth1TaxTail: checked })}
            />
          </div>

          {config.includeMonth1TaxTail && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Month-1 #VAT-7 Outflow (PLN)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    value={config.month1Vat7Pln}
                    onChange={(e) => updateConfig({ month1Vat7Pln: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Month-1 #PPE / PIT Outflow (PLN)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    value={config.month1PpePln}
                    onChange={(e) => updateConfig({ month1PpePln: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {(autoDetectedVat7Pln > 0 || autoDetectedPpePln > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>
                      Detected from {referenceTaxMonth ?? "recent"} tax transactions:{" "}
                      <strong>VAT-7: {formatMoney(autoDetectedVat7Pln, "PLN")}</strong>,{" "}
                      <strong>PPE: {formatMoney(autoDetectedPpePln, "PLN")}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAutoDetectedTaxes}
                    className="cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Apply Detected
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
