"use client";

import { useMemo, useState } from "react";

import { Plus, Search, Sliders, Trash2, TrendingDown } from "lucide-react";

import { formatMoney } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { AusterityPreset, CategoryAusterityItem, CategoryAusterityWeight, LookbackWindow } from "./runway-types";

interface CategoryAusterityMatrixProps {
  items: CategoryAusterityItem[];
  weights: Record<string, CategoryAusterityWeight>;
  lookbackWindow: LookbackWindow;
  activePresetId: string;
  customPresets: AusterityPreset[];
  onWeightsChange: (weights: Record<string, CategoryAusterityWeight>) => void;
  onLookbackWindowChange: (window: LookbackWindow) => void;
  onPresetSelect: (presetId: string) => void;
  onSaveCustomPreset: (name: string) => void;
  onDeleteCustomPreset?: (presetId: string) => void;
  baselineLivingBurnPln: number;
  currentLivingBurnPln: number;
}

export function CategoryAusterityMatrix({
  items,
  weights,
  lookbackWindow,
  activePresetId,
  customPresets,
  onWeightsChange,
  onLookbackWindowChange,
  onPresetSelect,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  baselineLivingBurnPln,
  currentLivingBurnPln,
}: CategoryAusterityMatrixProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "controllable" | "fixed">("all");
  const [newPresetName, setNewPresetName] = useState("");
  const [isAddingPreset, setIsAddingPreset] = useState(false);

  const savingsPln = Math.max(0, baselineLivingBurnPln - currentLivingBurnPln);
  const savingsPct = baselineLivingBurnPln > 0 ? (savingsPln / baselineLivingBurnPln) * 100 : 0;

  // Filtered categories
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(query)) return false;
      }
      if (filterTab === "controllable" && item.isFixed) return false;
      if (filterTab === "fixed" && !item.isFixed) return false;
      return true;
    });
  }, [items, searchTerm, filterTab]);

  const handleWeightChange = (itemId: string, patch: Partial<CategoryAusterityWeight>) => {
    const existing = weights[itemId] ?? { enabled: true, retentionPct: 100 };
    onWeightsChange({
      ...weights,
      [itemId]: {
        ...existing,
        ...patch,
      },
    });
  };

  const handleApplyPresetAction = (action: "normal" | "moderate" | "survival") => {
    const nextWeights: Record<string, CategoryAusterityWeight> = {};

    for (const item of items) {
      if (action === "normal") {
        nextWeights[item.id] = { enabled: true, retentionPct: 100 };
      } else if (action === "moderate") {
        if (item.isFixed) {
          nextWeights[item.id] = { enabled: true, retentionPct: 100 };
        } else {
          nextWeights[item.id] = { enabled: true, retentionPct: 75 };
        }
      } else if (action === "survival") {
        if (item.isFixed) {
          nextWeights[item.id] = { enabled: true, retentionPct: 100 };
        } else {
          nextWeights[item.id] = { enabled: false, retentionPct: 0 };
        }
      }
    }

    onWeightsChange(nextWeights);
    let presetId = "preset-normal";
    if (action === "moderate") {
      presetId = "preset-moderate";
    } else if (action === "survival") {
      presetId = "preset-survival";
    }
    onPresetSelect(presetId);
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSaveCustomPreset(newPresetName.trim());
    setNewPresetName("");
    setIsAddingPreset(false);
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">Living Expense Austerity Matrix</CardTitle>
              <CardDescription className="text-xs">
                Historical monthly category averages (taxes excluded). Adjust sliders to simulate household spending
                cuts.
              </CardDescription>
            </div>
          </div>

          {/* Lookback Window Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
            <span className="px-1 text-[11px] font-medium text-muted-foreground">Lookback:</span>
            {(["1m", "3m", "6m", "12m"] as LookbackWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onLookbackWindowChange(w)}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  lookbackWindow === w
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Burn Comparison & Preset Pills */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Baseline 100%: </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(baselineLivingBurnPln, "PLN")} / mo
              </span>
            </div>
            <span>•</span>
            <div>
              <span className="text-muted-foreground">Austerity: </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(currentLivingBurnPln, "PLN")} / mo
              </span>
            </div>
            {savingsPln > 10 && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingDown className="size-3" />-{formatMoney(savingsPln, "PLN")}/mo ({savingsPct.toFixed(0)}% cut)
              </span>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={activePresetId === "preset-normal" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleApplyPresetAction("normal")}
            >
              Normal 100%
            </Button>
            <Button
              type="button"
              variant={activePresetId === "preset-moderate" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleApplyPresetAction("moderate")}
            >
              Moderate Cut (-25%)
            </Button>
            <Button
              type="button"
              variant={activePresetId === "preset-survival" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleApplyPresetAction("survival")}
            >
              Survival Mode
            </Button>

            {/* Custom Presets */}
            {customPresets.map((preset) => (
              <div key={preset.id} className="flex items-center">
                <Button
                  type="button"
                  variant={activePresetId === preset.id ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-xs rounded-r-none border-r-0"
                  onClick={() => onPresetSelect(preset.id)}
                >
                  {preset.name}
                </Button>
                {onDeleteCustomPreset && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-1.5 text-muted-foreground hover:text-destructive rounded-l-none"
                    onClick={() => onDeleteCustomPreset(preset.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}

            {isAddingPreset ? (
              <form onSubmit={handleSavePreset} className="flex items-center gap-1">
                <Input
                  autoFocus
                  placeholder="Preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="h-7 w-28 text-xs"
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs"
                  onClick={() => setIsAddingPreset(false)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setIsAddingPreset(true)}
              >
                <Plus className="size-3" />
                Save Preset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search & Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search living categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">
                All ({items.length})
              </TabsTrigger>
              <TabsTrigger value="controllable" className="text-xs">
                Controllable ({items.filter((i) => !i.isFixed).length})
              </TabsTrigger>
              <TabsTrigger value="fixed" className="text-xs">
                Fixed ({items.filter((i) => i.isFixed).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Category List */}
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No categories match current search or filters.
            </div>
          ) : (
            filteredItems.map((item) => {
              const currentWeight = weights[item.id] ?? {
                enabled: item.enabled,
                retentionPct: item.retentionPct,
              };

              const isChecked = currentWeight.enabled;
              const retention = isChecked ? currentWeight.retentionPct : 0;
              const effectiveBurn = item.baselineMonthlyBurnPln * (retention / 100);

              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    isChecked ? "hover:bg-muted/30" : "bg-muted/10 opacity-60"
                  }`}
                >
                  {/* Category Name & Tags */}
                  <div className="flex items-center gap-3 sm:w-1/3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleWeightChange(item.id, { enabled: e.target.checked })}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            isChecked ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                        >
                          {item.name}
                        </span>
                        {item.isFixed ? (
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[9px] font-normal text-amber-600 dark:text-amber-400"
                          >
                            Fixed Obligation
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal text-muted-foreground">
                            Controllable
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Baseline: {formatMoney(item.baselineMonthlyBurnPln, "PLN")} / mo
                      </p>
                    </div>
                  </div>

                  {/* Retention Slider */}
                  <div className="flex items-center gap-3 sm:w-1/3">
                    <Slider
                      value={[retention]}
                      min={0}
                      max={150}
                      step={5}
                      disabled={!isChecked}
                      onValueChange={([val]) =>
                        handleWeightChange(item.id, {
                          retentionPct: val ?? 100,
                          enabled: (val ?? 0) > 0,
                        })
                      }
                      className="py-1"
                    />
                    <span className="w-12 text-right text-xs font-semibold tabular-nums text-foreground">
                      {retention}%
                    </span>
                  </div>

                  {/* Effective Monthly Burn */}
                  <div className="flex items-center justify-between sm:w-1/4 sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs font-semibold tabular-nums text-foreground">
                        {formatMoney(effectiveBurn, "PLN")}
                      </div>
                      {retention !== 100 && (
                        <div className="text-[10px] text-muted-foreground">
                          {retention < 100 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              -{formatMoney(item.baselineMonthlyBurnPln - effectiveBurn, "PLN")}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              +{formatMoney(effectiveBurn - item.baselineMonthlyBurnPln, "PLN")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
