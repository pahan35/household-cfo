"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { format } from "date-fns";
import { AlertCircle, RotateCcw, RotateCw, ShieldCheck } from "lucide-react";

import {
  getBudgetSelection,
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-client";
import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
  StatPingData,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { useExclusionPresets } from "@/app/(main)/dashboard/family-budget/_components/use-exclusion-presets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { CapitalPoolCard } from "./capital-pool-card";
import { CategoryAusterityMatrix } from "./category-austerity-matrix";
import { JdgObligationCard } from "./jdg-obligation-card";
import {
  buildCapitalPoolItems,
  calculateAusterityLivingBurn,
  calculateCapitalPool,
  computeHistoricalCategoryBurn,
  DEFAULT_CAPITAL_POOL_CONFIG,
  DEFAULT_JDG_RUNWAY_CONFIG,
  detectLatestTaxOutflows,
  projectRunwayScenario,
} from "./runway-engine";
import { RunwayKpiStrip } from "./runway-kpi-strip";
import { runwayRepository } from "./runway-repository";
import { RunwayTrajectoryCard } from "./runway-trajectory-card";
import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  LookbackWindow,
  RunwaySimulatorStoragePayload,
} from "./runway-types";

export function RunwayDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [statData, setStatData] = useState<StatPingData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Persistence State
  const [jdgConfig, setJdgConfig] = useState<JdgRunwayConfig>(DEFAULT_JDG_RUNWAY_CONFIG);
  const [capitalPoolConfig, setCapitalPoolConfig] = useState<CapitalPoolConfig>(DEFAULT_CAPITAL_POOL_CONFIG);
  const [lookbackWindow, setLookbackWindow] = useState<LookbackWindow>("3m");
  const [activePresetId, setActivePresetId] = useState("preset-normal");
  const [customPresets, setCustomPresets] = useState<AusterityPreset[]>([]);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, CategoryAusterityWeight>>({});

  const { activePreset } = useExclusionPresets(categories);
  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

  // 1. Initial Load of ExternalProvider Data and Stored Runway Configuration
  const loadData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      const currentMonthAnchor = format(new Date(), "yyyy-MM-dd");

      const [settingsRes, categoriesRes, currenciesRes, transactionsRes, statRes, storagePayload] =
        await Promise.allSettled([
          getSettings({ signal, forceRefresh }),
          getCategories({ signal, forceRefresh }),
          getCurrencies({ signal, forceRefresh }),
          getTransactionPage({ skip: 0, take: 500, signal, forceRefresh }),
          getBudgetSelection({ from: currentMonthAnchor, signal, forceRefresh }),
          runwayRepository.load(),
        ]);

      if (settingsRes.status === "fulfilled") setSettings(settingsRes.value);
      if (categoriesRes.status === "fulfilled") setCategories(categoriesRes.value);
      if (currenciesRes.status === "fulfilled") setCurrencies(currenciesRes.value);
      if (transactionsRes.status === "fulfilled") setTransactions(transactionsRes.value.transactions ?? []);
      if (statRes.status === "fulfilled") setStatData(statRes.value);

      if (storagePayload.status === "fulfilled") {
        const payload = storagePayload.value;
        setJdgConfig({
          ...DEFAULT_JDG_RUNWAY_CONFIG,
          ...payload.jdgConfig,
        });
        setCapitalPoolConfig({
          ...DEFAULT_CAPITAL_POOL_CONFIG,
          ...payload.capitalPoolConfig,
        });
        setLookbackWindow(payload.lookbackWindow);
        setActivePresetId(payload.activePresetId);
        setCustomPresets(payload.customPresets || []);
        setCategoryWeights(payload.categoryWeights || {});
      }
    } catch (err) {
      console.error("Failed to load runway dashboard data:", err);
      setError(err instanceof Error ? err : new Error("Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // 2. Auto-detect recent Month-1 VAT-7 and PPE outflows from transactions
  const detectedTaxes = useMemo(() => {
    return detectLatestTaxOutflows(transactions, currencies, defaultCurrency);
  }, [transactions, currencies, defaultCurrency]);

  // Seed default Month-1 tax tail amounts if not already customized
  useEffect(() => {
    if (
      jdgConfig.month1Vat7Pln === 0 &&
      jdgConfig.month1PpePln === 0 &&
      (detectedTaxes.vat7Pln > 0 || detectedTaxes.ppePln > 0)
    ) {
      setJdgConfig((prev) => ({
        ...prev,
        month1Vat7Pln: detectedTaxes.vat7Pln,
        month1PpePln: detectedTaxes.ppePln,
      }));
    }
  }, [detectedTaxes, jdgConfig.month1Vat7Pln, jdgConfig.month1PpePln]);

  // 3. Persist State Changes
  const handleSaveState = useCallback(
    (patch: Partial<RunwaySimulatorStoragePayload>) => {
      const updated: RunwaySimulatorStoragePayload = {
        version: 1,
        jdgConfig: patch.jdgConfig ?? jdgConfig,
        capitalPoolConfig: patch.capitalPoolConfig ?? capitalPoolConfig,
        lookbackWindow: patch.lookbackWindow ?? lookbackWindow,
        activePresetId: patch.activePresetId ?? activePresetId,
        customPresets: patch.customPresets ?? customPresets,
        categoryWeights: patch.categoryWeights ?? categoryWeights,
      };
      void runwayRepository.save(updated);
    },
    [jdgConfig, capitalPoolConfig, lookbackWindow, activePresetId, customPresets, categoryWeights],
  );

  const handleJdgConfigChange = (updated: JdgRunwayConfig) => {
    setJdgConfig(updated);
    handleSaveState({ jdgConfig: updated });
  };

  const handleCapitalPoolConfigChange = (updated: CapitalPoolConfig) => {
    setCapitalPoolConfig(updated);
    handleSaveState({ capitalPoolConfig: updated });
  };

  const handleWeightsChange = (weights: Record<string, CategoryAusterityWeight>) => {
    setCategoryWeights(weights);
    handleSaveState({ categoryWeights: weights });
  };

  const handleLookbackWindowChange = (window: LookbackWindow) => {
    setLookbackWindow(window);
    handleSaveState({ lookbackWindow: window });
  };

  const handlePresetSelect = (presetId: string) => {
    setActivePresetId(presetId);
    handleSaveState({ activePresetId: presetId });
  };

  const handleSaveCustomPreset = (name: string) => {
    const newPreset: AusterityPreset = {
      id: `custom-preset-${Date.now()}`,
      name,
      isBuiltIn: false,
      weights: { ...categoryWeights },
    };
    const updatedCustom = [...customPresets, newPreset];
    setCustomPresets(updatedCustom);
    setActivePresetId(newPreset.id);
    handleSaveState({
      customPresets: updatedCustom,
      activePresetId: newPreset.id,
    });
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    const updatedCustom = customPresets.filter((p) => p.id !== presetId);
    setCustomPresets(updatedCustom);
    if (activePresetId === presetId) {
      setActivePresetId("preset-normal");
      handleSaveState({ customPresets: updatedCustom, activePresetId: "preset-normal" });
    } else {
      handleSaveState({ customPresets: updatedCustom });
    }
  };

  const handleResetToDefaults = async () => {
    const reset = await runwayRepository.resetToDefaults();
    setJdgConfig({
      ...DEFAULT_JDG_RUNWAY_CONFIG,
      ...reset.jdgConfig,
    });
    setCapitalPoolConfig({
      ...DEFAULT_CAPITAL_POOL_CONFIG,
      ...reset.capitalPoolConfig,
    });
    setLookbackWindow(reset.lookbackWindow);
    setActivePresetId(reset.activePresetId);
    setCustomPresets(reset.customPresets);
    setCategoryWeights(reset.categoryWeights);
  };

  // 4. Derived Computations
  const capitalItems = useMemo(() => {
    return buildCapitalPoolItems(categories, currencies, defaultCurrency);
  }, [categories, currencies, defaultCurrency]);

  const capitalPoolSummary = useMemo(() => {
    return calculateCapitalPool(capitalItems, capitalPoolConfig);
  }, [capitalItems, capitalPoolConfig]);

  const historicalBurnItems = useMemo(() => {
    return computeHistoricalCategoryBurn({
      statPoints: statData?.selection?.points ?? [],
      categories,
      currencies,
      lookbackWindow,
      activePreset,
      defaultCurrency,
    });
  }, [statData?.selection?.points, categories, currencies, lookbackWindow, activePreset, defaultCurrency]);

  const baselineLivingBurnPln = useMemo(() => {
    return historicalBurnItems.reduce((sum, item) => sum + item.baselineMonthlyBurnPln, 0);
  }, [historicalBurnItems]);

  const austerityLivingBurnPln = useMemo(() => {
    return calculateAusterityLivingBurn(historicalBurnItems, categoryWeights);
  }, [historicalBurnItems, categoryWeights]);

  const startYearMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // 5. Scenarios
  const austerityScenario = useMemo(() => {
    return projectRunwayScenario({
      startingCapitalPln: capitalPoolSummary.usableCapitalPln,
      jdgConfig,
      monthlyLivingBurnPln: austerityLivingBurnPln,
      startYearMonth,
    });
  }, [capitalPoolSummary.usableCapitalPln, jdgConfig, austerityLivingBurnPln, startYearMonth]);

  const baselineScenario = useMemo(() => {
    return projectRunwayScenario({
      startingCapitalPln: capitalPoolSummary.usableCapitalPln,
      jdgConfig,
      monthlyLivingBurnPln: baselineLivingBurnPln,
      startYearMonth,
    });
  }, [capitalPoolSummary.usableCapitalPln, jdgConfig, baselineLivingBurnPln, startYearMonth]);

  const suspendedScenario = useMemo(() => {
    return projectRunwayScenario({
      startingCapitalPln: capitalPoolSummary.usableCapitalPln,
      jdgConfig: {
        ...jdgConfig,
        posture: "suspended",
      },
      monthlyLivingBurnPln: austerityLivingBurnPln,
      startYearMonth,
    });
  }, [capitalPoolSummary.usableCapitalPln, jdgConfig, austerityLivingBurnPln, startYearMonth]);

  // Loading Skeleton
  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error State
  if (error && categories.length === 0) {
    return (
      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load runway simulator data</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3">
          <p>{error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => void loadData(undefined, true)}
          >
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span className="text-xs text-muted-foreground">
            Zero-revenue simulation across <strong>{capitalItems.length} accounts</strong> and{" "}
            <strong>{historicalBurnItems.length} living categories</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={handleResetToDefaults}
          >
            <RotateCcw className="size-3.5" />
            Reset Defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={isLoading}
            onClick={() => void loadData(undefined, true)}
          >
            <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 1. Summary KPI Strip */}
      <RunwayKpiStrip
        usableCapitalPln={capitalPoolSummary.usableCapitalPln}
        month1TaxTailPln={austerityScenario.rows[0]?.month1TaxTailPln ?? 0}
        usableCapitalAfterTaxTailPln={austerityScenario.usableCapitalAfterTaxTailPln}
        ongoingMonthlyBurnPln={austerityScenario.ongoingMonthlyBurnPln}
        baselineOngoingMonthlyBurnPln={baselineScenario.ongoingMonthlyBurnPln}
        runwayMonths={austerityScenario.runwayMonths}
        baselineRunwayMonths={baselineScenario.runwayMonths}
        exhaustionDate={austerityScenario.exhaustionDate}
        isCashflowPositive={austerityScenario.isCashflowPositive}
        residualIncomePln={jdgConfig.residualMonthlyIncomePln}
        isLoading={isLoading}
      />

      {/* 2. Statutory JDG Engine & Capital Pool Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <JdgObligationCard
          config={jdgConfig}
          onChange={handleJdgConfigChange}
          autoDetectedVat7Pln={detectedTaxes.vat7Pln}
          autoDetectedPpePln={detectedTaxes.ppePln}
          referenceTaxMonth={detectedTaxes.referenceMonth}
        />

        <CapitalPoolCard
          items={capitalItems}
          config={capitalPoolConfig}
          summary={capitalPoolSummary}
          onChange={handleCapitalPoolConfigChange}
        />
      </div>

      {/* 3. Category Austerity Matrix */}
      <CategoryAusterityMatrix
        items={historicalBurnItems}
        weights={categoryWeights}
        lookbackWindow={lookbackWindow}
        activePresetId={activePresetId}
        customPresets={customPresets}
        onWeightsChange={handleWeightsChange}
        onLookbackWindowChange={handleLookbackWindowChange}
        onPresetSelect={handlePresetSelect}
        onSaveCustomPreset={handleSaveCustomPreset}
        onDeleteCustomPreset={handleDeleteCustomPreset}
        baselineLivingBurnPln={baselineLivingBurnPln}
        currentLivingBurnPln={austerityLivingBurnPln}
      />

      {/* 4. Multi-scenario Capital Depletion Trajectory Chart & Breakdown Table */}
      <RunwayTrajectoryCard
        austerityScenario={austerityScenario}
        baselineScenario={baselineScenario}
        suspendedScenario={suspendedScenario}
      />
    </div>
  );
}
