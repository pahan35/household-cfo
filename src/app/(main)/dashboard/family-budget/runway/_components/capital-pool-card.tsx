"use client";

import { Coins, PiggyBank, ShieldAlert, Wallet } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import type { CapitalPoolConfig, CapitalPoolItem, CapitalPoolSummary } from "./runway-types";

interface CapitalPoolCardProps {
  items: CapitalPoolItem[];
  config: CapitalPoolConfig;
  summary: CapitalPoolSummary;
  onChange: (updated: CapitalPoolConfig) => void;
}

export function CapitalPoolCard({ items, config, summary, onChange }: CapitalPoolCardProps) {
  const updateConfig = (patch: Partial<CapitalPoolConfig>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  const handleToggleItem = (itemId: string, currentlyIncluded: boolean) => {
    const excludedSet = new Set(config.excludedItemIds);
    if (currentlyIncluded) {
      excludedSet.add(itemId);
    } else {
      excludedSet.delete(itemId);
    }
    updateConfig({ excludedItemIds: Array.from(excludedSet) });
  };

  const handleSelectAll = () => {
    updateConfig({ excludedItemIds: [] });
  };

  const handleDeselectAll = () => {
    updateConfig({ excludedItemIds: items.map((i) => i.id) });
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="size-5 text-emerald-500" />
            <CardTitle className="text-base font-semibold">Emergency Capital Pool & FX Buffer</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Usable: <strong>{formatMoney(summary.usableCapitalPln, "PLN")}</strong>
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Select accounts and goals to fund living and JDG expenses during income loss. Apply foreign-currency stress
          haircuts and reserve floors.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Safety Floor & FX Haircut Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Safety Floor */}
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Untouchable Safety Floor (PLN)</Label>
              <ShieldAlert className="size-3.5 text-muted-foreground" />
            </div>
            <Input
              type="number"
              min={0}
              step={1000}
              className="h-8 text-xs font-medium"
              value={config.safetyFloorPln}
              onChange={(e) => updateConfig({ safetyFloorPln: Math.max(0, Number(e.target.value) || 0) })}
            />
            <p className="text-[11px] text-muted-foreground">
              Absolute emergency minimum reserve preserved untouched during runway depletion.
            </p>
          </div>

          {/* FX Haircut Slider */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Foreign-Currency (FX) Haircut</Label>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {config.fxHaircutPct > 0 ? `+${config.fxHaircutPct}%` : `${config.fxHaircutPct}%`}
              </span>
            </div>
            <Slider
              value={[config.fxHaircutPct]}
              min={-15}
              max={15}
              step={1}
              onValueChange={([val]) => updateConfig({ fxHaircutPct: val ?? 0 })}
              className="py-1"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>-15% (Pessimistic FX Crash)</span>
              {summary.fxAdjustmentPln !== 0 && (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {summary.fxAdjustmentPln > 0 ? "+" : ""}
                  {formatMoney(summary.fxAdjustmentPln, "PLN")} buffer
                </span>
              )}
              <span>+15% (Optimistic)</span>
            </div>
          </div>
        </div>

        {/* Global Pool Toggles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium">Include Off-Balance Savings</Label>
              <p className="text-[11px] text-muted-foreground">Accounts tagged 'exceptFromBalance' in ExternalProvider</p>
            </div>
            <Switch
              checked={config.includeOffBalanceAccounts}
              onCheckedChange={(checked) => updateConfig({ includeOffBalanceAccounts: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium">Include Goal Categories</Label>
              <p className="text-[11px] text-muted-foreground">Earmarked savings targets (e.g. Travel, Car)</p>
            </div>
            <Switch
              checked={config.includeGoals}
              onCheckedChange={(checked) => updateConfig({ includeGoals: checked })}
            />
          </div>
        </div>

        {/* Accounts & Goals List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Available Emergency Accounts ({summary.items.filter((i) => i.included).length}/{items.length} Active)
            </span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handleSelectAll}
                className="cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="divide-y divide-border/60 rounded-md border border-border/60">
            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No accounts or goals found.</div>
            ) : (
              items.map((item) => {
                const isExcludedByConfig =
                  (item.isOffBalance && !config.includeOffBalanceAccounts) || (item.isGoal && !config.includeGoals);

                const isChecked = item.included && !isExcludedByConfig;
                const isNonPln = item.currencyCode.toUpperCase() !== "PLN";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExcludedByConfig}
                        onChange={() => handleToggleItem(item.id, isChecked)}
                        className="size-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {item.isGoal ? (
                            <PiggyBank className="size-3.5 text-muted-foreground" />
                          ) : (
                            <Wallet className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs font-medium text-foreground">{item.name}</span>
                          {item.isOffBalance && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">
                              Off-balance
                            </Badge>
                          )}
                          {item.isGoal && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">
                              Goal
                            </Badge>
                          )}
                        </div>
                        {isNonPln && (
                          <p className="text-[11px] text-muted-foreground">
                            Native: {formatMoney(item.nativeBalance, item.currencyCode)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-semibold tabular-nums text-foreground">
                        {formatMoney(item.convertedPln, "PLN")}
                      </div>
                      {isNonPln && config.fxHaircutPct !== 0 && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          Stress: {formatMoney(item.convertedPln * (1 + config.fxHaircutPct / 100), "PLN")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
