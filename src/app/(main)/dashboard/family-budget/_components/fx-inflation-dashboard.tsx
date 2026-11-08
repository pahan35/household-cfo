"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { format, startOfMonth } from "date-fns";
import { Filter, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getBudgetSelection, getCategories, getSettings } from "./external-provider-client";
import type { ExternalProviderCategory, StatPingData, StatPoint } from "./external-provider-data";
import { useExternalProviderSync } from "./external-provider-sync-toolbar";
import { CpiInflationCard } from "./cpi-inflation-card";
import { transformExpenses } from "./expense-transforms";
import { FxSimulatorCard } from "./fx-simulator-card";
import type { ReportingCurrency } from "./macro-transforms";
import { useCategoriesQuery, useSettingsQuery } from "./use-external-provider-queries";
import { useExclusionPresets } from "./use-exclusion-presets";
import { parsePointDate } from "./yoy-transforms";

export function FxInflationDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const settingsQuery = useSettingsQuery();
  const categoriesQuery = useCategoriesQuery();
  const settings = settingsQuery.data ?? null;
  const categories = useMemo<ExternalProviderCategory[]>(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const isLoadingBaseData = settingsQuery.isLoading || categoriesQuery.isLoading;
  const baseDataError = settingsQuery.error ?? categoriesQuery.error ?? null;
  const { mutate: mutateSettings } = settingsQuery;
  const { mutate: mutateCategories } = categoriesQuery;

  const [statData, setStatData] = useState<StatPingData | null>(null);
  const [isLoadingStatData, setIsLoadingStatData] = useState(true);
  const [statDataError, setStatDataError] = useState<Error | null>(null);

  const [currency, setCurrency] = useState<ReportingCurrency>("PLN");

  const presetController = useExclusionPresets(categories);

  // 40-month statistics series anchor
  const currentMonthAnchor = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);

  const reloadBaseData = useCallback(() => {
    void mutateSettings(getSettings({ forceRefresh: true }));
    void mutateCategories(getCategories({ forceRefresh: true }));
  }, [mutateSettings, mutateCategories]);

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
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void loadStatData(controller.signal);
    return () => controller.abort();
  }, [loadStatData, syncVersion]);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex items-center gap-2" />
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
            reloadBaseData();
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
