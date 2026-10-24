"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { format, startOfMonth } from "date-fns";
import { Filter, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getBudgetSelection, getCategories, getSettings } from "./external-provider-client";
import type { ExternalProviderCategory, ExternalProviderSettings, StatPingData, StatPoint } from "./external-provider-data";
import { CpiInflationCard } from "./cpi-inflation-card";
import { transformExpenses } from "./expense-transforms";
import { FxSimulatorCard } from "./fx-simulator-card";
import type { ReportingCurrency } from "./macro-transforms";
import { useExclusionPresets } from "./use-exclusion-presets";
import { parsePointDate } from "./yoy-transforms";

export function FxInflationDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [baseDataError, setBaseDataError] = useState<Error | null>(null);

  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [isLoadingStatData, setIsLoadingStatData] = useState(true);
  const [statDataError, setStatDataError] = useState<Error | null>(null);

  const [currency, setCurrency] = useState<ReportingCurrency>("PLN");

  const presetController = useExclusionPresets(categories);

  // 40-month statistics series anchor
  const currentMonthAnchor = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);

  const loadBaseData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoadingBaseData(true);
    setBaseDataError(null);
    try {
      const [settingsRes, categoriesRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
      ]);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      } else if (!signal?.aborted) {
        setBaseDataError(
          settingsRes.reason instanceof Error ? settingsRes.reason : new Error("Failed to load settings"),
        );
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      } else if (!signal?.aborted && settingsRes.status === "fulfilled") {
        setBaseDataError(
          categoriesRes.reason instanceof Error ? categoriesRes.reason : new Error("Failed to load categories"),
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setBaseDataError(err instanceof Error ? err : new Error("Failed to load base data"));
    } finally {
      setIsLoadingBaseData(false);
    }
  }, []);

  const loadStatData = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setIsLoadingStatData(true);
      setStatDataError(null);
      try {
        const data = await getBudgetSelection({
          from: currentMonthAnchor,
          signal,
          forceRefresh,
        });
        setStatData(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatDataError(err instanceof Error ? err : new Error("Failed to load budget statistics"));
      } finally {
        setIsLoadingStatData(false);
      }
    },
    [currentMonthAnchor],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    void loadStatData(controller.signal);
    return () => controller.abort();
  }, [loadBaseData, loadStatData]);

  // Compute latest month's controllable expense run rate to pre-populate the forward simulator
  const latestControllableExpense = useMemo(() => {
    const points: StatPoint[] = statData?.selection?.points ?? [];
    if (!points.length) return 12000;

    const parsedList = points
      .map((p) => {
        const parsed = parsePointDate(p);
        if (!parsed) return null;
        return { point: p, ...parsed };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!parsedList.length) return 12000;

    const latest = parsedList[0];
    const transformed = transformExpenses({
      statCategories: latest.point.categories,
      categories,
      activePreset: presetController.activePreset,
    });

    return transformed.totalControllableExpense > 0 ? Math.round(transformed.totalControllableExpense) : 12000;
  }, [statData, categories, presetController.activePreset]);

  const isRefreshing = isLoadingBaseData || isLoadingStatData;

  const handleRefreshAll = () => {
    void loadBaseData(undefined, true);
    void loadStatData(undefined, true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-normal">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Live External API Stats
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs font-medium">
            Account Base: {settings?.defaultCurrency ?? "PLN"}
          </span>
          <span className="text-muted-foreground text-xs">•</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3" />
            <span>Preset:</span>
            <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
              {presetController.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => presetController.setActivePresetId(p.id)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    presetController.activePreset.id === p.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* CPI Inflation Erosion Analysis */}
      <div className="grid grid-cols-1 gap-4">
        <CpiInflationCard
          statPoints={statData?.selection?.points ?? []}
          categories={categories}
          activePreset={presetController.activePreset}
          currency={currency}
          onCurrencyChange={setCurrency}
          isLoading={isLoadingStatData || isLoadingBaseData}
          error={baseDataError ?? statDataError}
          onRetry={() => {
            void loadBaseData(undefined, true);
            void loadStatData(undefined, true);
          }}
        />
      </div>

      {/* Forward USD/PLN Sensitivity Simulator */}
      <div className="grid grid-cols-1 gap-4">
        <FxSimulatorCard
          currentMonthlyExpensesPln={latestControllableExpense}
          defaultUsdSalary={5000}
          defaultFxRate={3.95}
          defaultTaxPct={12}
          isLoading={isLoadingStatData}
        />
      </div>
    </div>
  );
}
