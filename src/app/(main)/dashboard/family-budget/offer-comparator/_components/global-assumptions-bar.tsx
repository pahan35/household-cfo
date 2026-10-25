"use client";

import { useState } from "react";

import { ArrowDownUp, Coins, Download, Info, RotateCcw, Sliders, Sparkles, TrendingUp, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import { formatMoney } from "../../_components/external-provider-data";
import { resolveEffectiveFxRate } from "./compensation-engine";
import type { ComparatorGlobalConfig } from "./offer-types";

export interface GlobalAssumptionsBarProps {
  config: ComparatorGlobalConfig;
  onChange: (updated: ComparatorGlobalConfig) => void;
  liveRates?: Record<string, number>;
  onExportJson?: () => void;
  onImportJson?: () => void;
  onResetDefaults?: () => void;
}

export function GlobalAssumptionsBar({
  config,
  onChange,
  liveRates = {},
  onExportJson,
  onImportJson,
  onResetDefaults,
}: GlobalAssumptionsBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const usdFx = resolveEffectiveFxRate("USD", config, liveRates);
  const eurFx = resolveEffectiveFxRate("EUR", config, liveRates);

  const targetNetTotalPln = (config.targetMonthlyExpensePln || 0) + (config.targetMonthlySavingsPln || 0);

  const handleExpenseChange = (val: number) => {
    onChange({ ...config, targetMonthlyExpensePln: Math.max(0, val) });
  };

  const handleSavingsChange = (val: number) => {
    onChange({ ...config, targetMonthlySavingsPln: Math.max(0, val) });
  };

  const handleUsdBufferChange = (val: number[]) => {
    const buffer = (val[0] ?? 5) / 100;
    onChange({
      ...config,
      fxPessimisticBufferPct: {
        ...config.fxPessimisticBufferPct,
        USD: buffer,
      },
    });
  };

  const handleEurBufferChange = (val: number[]) => {
    const buffer = (val[0] ?? 3) / 100;
    onChange({
      ...config,
      fxPessimisticBufferPct: {
        ...config.fxPessimisticBufferPct,
        EUR: buffer,
      },
    });
  };

  const handleYearProjectionChange = (year: 1 | 2 | 3) => {
    onChange({ ...config, activeYearProjection: year });
  };

  return (
    <Card className="border bg-card/60 shadow-xs backdrop-blur-xs">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          {/* Top Row: Target Net Inputs & Key Metric Badges */}
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-4">
              {/* Monthly Expense Baseline */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  ExternalProvider Living Expense Baseline
                </Label>
                <div className="relative w-36">
                  <Input
                    type="number"
                    value={config.targetMonthlyExpensePln || ""}
                    onChange={(e) => handleExpenseChange(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs pr-9"
                    step="500"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-muted-foreground">PLN</span>
                </div>
              </div>

              {/* Monthly Savings Goal */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Monthly Savings Goal</Label>
                <div className="relative w-36">
                  <Input
                    type="number"
                    value={config.targetMonthlySavingsPln || ""}
                    onChange={(e) => handleSavingsChange(parseFloat(e.target.value) || 0)}
                    className="h-8 font-mono text-xs pr-9"
                    step="500"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-muted-foreground">PLN</span>
                </div>
              </div>

              {/* Total Target Net Metric Pill */}
              <div className="flex flex-col justify-center rounded-lg border bg-primary/5 px-3 py-1.5">
                <span className="text-[10px] font-medium text-primary">Target Net Cashflow</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {formatMoney(targetNetTotalPln, "PLN")} / mo
                </span>
              </div>

              {/* Multi-Year Horizon Projection Switcher */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Tax Horizon Projection</Label>
                <div className="flex items-center rounded-md border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleYearProjectionChange(1)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      config.activeYearProjection === 1
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Year 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleYearProjectionChange(2)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      config.activeYearProjection === 2
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Year 2 (ZUS Jump)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleYearProjectionChange(3)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      config.activeYearProjection === 3
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Year 3 (+7% Infl)
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions (Backup, Advanced Toggle) */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="h-8 gap-1.5 text-xs"
              >
                <Sliders className="size-3.5" />
                <span>{showAdvanced ? "Hide FX & Rates" : "FX & Buffers"}</span>
              </Button>

              {onExportJson && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportJson}
                  className="h-8 gap-1 text-xs"
                  title="Export comparator backup as JSON"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}

              {onImportJson && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onImportJson}
                  className="h-8 gap-1 text-xs"
                  title="Import comparator backup from JSON"
                >
                  <Upload className="size-3.5" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              )}

              {onResetDefaults && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetDefaults}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  title="Reset to default starter tracks"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible FX Stress-Test Bar */}
          {showAdvanced && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-3 pt-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {/* USD Buffer Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">USD/PLN Rate &amp; Buffer:</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Base: {usdFx.baseRate.toFixed(2)} → Eff: {usdFx.effectiveRate.toFixed(2)} PLN
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[Math.round((config.fxPessimisticBufferPct.USD ?? 0.05) * 100)]}
                    min={-15}
                    max={15}
                    step={1}
                    onValueChange={handleUsdBufferChange}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono font-medium text-muted-foreground">
                    {Math.round((config.fxPessimisticBufferPct.USD ?? 0.05) * 100)}%
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Pessimistic buffer protects against dollar volatility.
                </span>
              </div>

              {/* EUR Buffer Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">EUR/PLN Rate &amp; Buffer:</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Base: {eurFx.baseRate.toFixed(2)} → Eff: {eurFx.effectiveRate.toFixed(2)} PLN
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[Math.round((config.fxPessimisticBufferPct.EUR ?? 0.03) * 100)]}
                    min={-15}
                    max={15}
                    step={1}
                    onValueChange={handleEurBufferChange}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono font-medium text-muted-foreground">
                    {Math.round((config.fxPessimisticBufferPct.EUR ?? 0.03) * 100)}%
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Applied to EUR-denominated contracts and equity.
                </span>
              </div>

              {/* Calendar & Hours Config */}
              <div className="flex flex-col justify-between gap-1 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Working Calendar Norms:</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {config.defaultWorkingDaysPerYear} days • {config.defaultStateHolidaysCount} holidays
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Standard Polish working year has 252 weekdays and 13 weekday public holidays (2,016 billable hours).
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
