"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";

import { format } from "date-fns";
import { AlertCircle, RotateCcw, RotateCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  getBudgetSelection,
  getTransactionPage,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-client";
import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
  StatPingData,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { useExternalProviderSync } from "@/app/(main)/dashboard/family-budget/_components/external-provider-sync-toolbar";
import { useExclusionPresets } from "@/app/(main)/dashboard/family-budget/_components/use-exclusion-presets";
import {
  useCategoriesQuery,
  useCurrenciesQuery,
  useSettingsQuery,
} from "@/app/(main)/dashboard/family-budget/_components/use-external-provider-queries";
import { revalidateScenarios } from "@/app/(main)/dashboard/family-budget/_components/use-scenarios-query";
import type { OfferRevision } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloudSyncState } from "@/hooks/use-cloud-sync-state";
import { createActionScenarioTransport } from "@/lib/scenario-transport";
import {
  createRunwayScenarioAction,
  deleteRunwayScenarioAction,
  duplicateRunwayScenarioAction,
  listRunwayScenariosAction,
  setPrimaryRunwayScenarioAction,
  updateRunwayScenarioAction,
} from "@/server/actions/runway-actions";

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
import { RUNWAY_STORAGE_KEY, RunwayRepository } from "./runway-repository";
import { RunwayScenarioToolbar } from "./runway-scenario-toolbar";
import { RunwayTrajectoryCard } from "./runway-trajectory-card";
import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  LookbackWindow,
  RunwayScenario,
} from "./runway-types";

const runwayActionTransport = createActionScenarioTransport(
  {
    list: listRunwayScenariosAction,
    create: createRunwayScenarioAction,
    update: updateRunwayScenarioAction,
    delete: deleteRunwayScenarioAction,
    setPrimary: setPrimaryRunwayScenarioAction,
    duplicate: duplicateRunwayScenarioAction,
  },
  {
    onMutated: () => void revalidateScenarios("runway"),
  },
);

const runwayRepository = new RunwayRepository(RUNWAY_STORAGE_KEY, undefined, undefined, runwayActionTransport);

export function RunwayDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const categoriesQuery = useCategoriesQuery();
  const currenciesQuery = useCurrenciesQuery();
  const settingsQuery = useSettingsQuery();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const currencies = useMemo(() => currenciesQuery.data ?? [], [currenciesQuery.data]);
  const settings = settingsQuery.data ?? null;
  const { mutate: mutateCategories } = categoriesQuery;
  const { mutate: mutateCurrencies } = currenciesQuery;
  const { mutate: mutateSettings } = settingsQuery;

  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [statData, setStatData] = useState<StatPingData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Multi-Scenario Cloud State
  const [scenarios, setScenarios] = useState<RunwayScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("");
  const [linkedOffer, setLinkedOffer] = useState<OfferRevision | null>(null);

  const syncState = useCloudSyncState<RunwayScenario>({
    initialStatus: "syncing",
    storageSyncKey: `${RUNWAY_STORAGE_KEY}:lastSyncedAt`,
    onConflictResolved: async (_entityId, choice, record) => {
      const updated = await runwayRepository.resolveConflict(record, choice);
      setScenarios(updated);
      const active = updated.find((s) => s.id === activeScenarioId) ?? updated[0];
      if (active) {
        setJdgConfig(active.jdgConfig);
        setCapitalPoolConfig(active.capitalPoolConfig);
        setLookbackWindow(active.lookbackWindow);
        setActivePresetId(active.activePresetId);
        setCustomPresets(active.customPresets || []);
        setCategoryWeights(active.categoryCuts || {});
      }
      toast.success("Conflict resolved");
    },
  });

  const { setSyncing, setSynced, setOffline, setConflictDetected } = syncState;

  // Active Configuration State (projected from active scenario)
  const [jdgConfig, setJdgConfig] = useState<JdgRunwayConfig>(DEFAULT_JDG_RUNWAY_CONFIG);
  const [capitalPoolConfig, setCapitalPoolConfig] = useState<CapitalPoolConfig>(DEFAULT_CAPITAL_POOL_CONFIG);
  const [lookbackWindow, setLookbackWindow] = useState<LookbackWindow>("3m");
  const [activePresetId, setActivePresetId] = useState("preset-normal");
  const [customPresets, setCustomPresets] = useState<AusterityPreset[]>([]);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, CategoryAusterityWeight>>({});

  const { activePreset } = useExclusionPresets(categories);
  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

  // 1. Initial Load of ExternalProvider Data and Stored Runway Configuration
  const loadData = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setIsLoading(true);
      setError(null);
      setSyncing();

      try {
        const currentMonthAnchor = format(new Date(), "yyyy-MM-dd");

        if (forceRefresh) {
          void mutateCategories();
          void mutateCurrencies();
          void mutateSettings();
        }

        const [transactionsRes, statRes, scenariosRes] = await Promise.allSettled([
          getTransactionPage({ skip: 0, take: 500, signal, forceRefresh }),
          getBudgetSelection({ from: currentMonthAnchor, signal, forceRefresh }),
          runwayRepository.fetchRemoteScenarios(signal),
        ]);

        if (transactionsRes.status === "fulfilled") setTransactions(transactionsRes.value.transactions ?? []);
        if (statRes.status === "fulfilled") setStatData(statRes.value);

        if (scenariosRes.status === "fulfilled") {
          const {
            scenarios: loadedScenarios,
            activeScenarioId: loadedActiveId,
            isOfflineFallback: offline,
            conflicts,
          } = scenariosRes.value;

          setScenarios(loadedScenarios);
          setActiveScenarioId(loadedActiveId);

          if (conflicts && conflicts.length > 0) {
            setConflictDetected(conflicts);
          } else if (offline) {
            setOffline();
          } else {
            setSynced();
          }

          const active =
            loadedScenarios.find((s) => s.id === loadedActiveId) ??
            loadedScenarios.find((s) => s.isPrimary) ??
            loadedScenarios[0];

          if (active) {
            setJdgConfig(active.jdgConfig);
            setCapitalPoolConfig(active.capitalPoolConfig);
            setLookbackWindow(active.lookbackWindow);
            setActivePresetId(active.activePresetId);
            setCustomPresets(active.customPresets || []);
            setCategoryWeights(active.categoryCuts || {});
          }
        }
      } catch (err) {
        console.error("Failed to load runway dashboard data:", err);
        setOffline();
        setError(err instanceof Error ? err : new Error("Failed to load data"));
      } finally {
        setIsLoading(false);
      }
    },
    [setSyncing, setSynced, setOffline, setConflictDetected, mutateCategories, mutateCurrencies, mutateSettings],
  );

  const onSyncData = useEffectEvent(async (signal: AbortSignal) => {
    await loadData(signal, false);
  });

  useEffect(() => {
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void onSyncData(controller.signal);
    return () => controller.abort();
  }, [syncVersion]);

  // Fetch linked OfferRevision if active scenario is tied to Offer Comparator track
  useEffect(() => {
    if (!activeScenarioId) return;
    const current = scenarios.find((s) => s.id === activeScenarioId);
    if (current?.baselineOfferRevisionId) {
      void runwayRepository.fetchLinkedOfferRevision(activeScenarioId).then((rev) => {
        setLinkedOffer(rev);
      });
    } else {
      setLinkedOffer(null);
    }
  }, [activeScenarioId, scenarios]);

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
  const updateScenarioConfig = useCallback(
    (patch: {
      jdgConfig?: JdgRunwayConfig;
      capitalPoolConfig?: CapitalPoolConfig;
      lookbackWindow?: LookbackWindow;
      activePresetId?: string;
      customPresets?: AusterityPreset[];
      categoryCuts?: Record<string, CategoryAusterityWeight>;
    }) => {
      if (!activeScenarioId) return;

      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== activeScenarioId) return s;
          return {
            ...s,
            ...(patch.jdgConfig ? { jdgConfig: patch.jdgConfig } : {}),
            ...(patch.capitalPoolConfig ? { capitalPoolConfig: patch.capitalPoolConfig } : {}),
            ...(patch.lookbackWindow ? { lookbackWindow: patch.lookbackWindow } : {}),
            ...(patch.activePresetId ? { activePresetId: patch.activePresetId } : {}),
            ...(patch.customPresets ? { customPresets: patch.customPresets } : {}),
            ...(patch.categoryCuts ? { categoryCuts: patch.categoryCuts } : {}),
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      // Async remote update in background with local cache persistence
      void runwayRepository.updateRemoteScenario(activeScenarioId, patch).catch((err) => {
        console.warn("Background runway scenario sync error:", err);
      });
    },
    [activeScenarioId],
  );

  const handleJdgConfigChange = (updated: JdgRunwayConfig) => {
    setJdgConfig(updated);
    updateScenarioConfig({ jdgConfig: updated });
  };

  const handleCapitalPoolConfigChange = (updated: CapitalPoolConfig) => {
    setCapitalPoolConfig(updated);
    updateScenarioConfig({ capitalPoolConfig: updated });
  };

  const handleWeightsChange = (weights: Record<string, CategoryAusterityWeight>) => {
    setCategoryWeights(weights);
    updateScenarioConfig({ categoryCuts: weights });
  };

  const handleLookbackWindowChange = (window: LookbackWindow) => {
    setLookbackWindow(window);
    updateScenarioConfig({ lookbackWindow: window });
  };

  const handlePresetSelect = (presetId: string) => {
    setActivePresetId(presetId);
    updateScenarioConfig({ activePresetId: presetId });
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
    updateScenarioConfig({
      customPresets: updatedCustom,
      activePresetId: newPreset.id,
    });
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    const updatedCustom = customPresets.filter((p) => p.id !== presetId);
    setCustomPresets(updatedCustom);
    if (activePresetId === presetId) {
      setActivePresetId("preset-normal");
      updateScenarioConfig({ customPresets: updatedCustom, activePresetId: "preset-normal" });
    } else {
      updateScenarioConfig({ customPresets: updatedCustom });
    }
  };

  // Scenario Management Handlers
  const handleSelectScenario = (id: string) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    setActiveScenarioId(id);
    setJdgConfig(target.jdgConfig);
    setCapitalPoolConfig(target.capitalPoolConfig);
    setLookbackWindow(target.lookbackWindow);
    setActivePresetId(target.activePresetId);
    setCustomPresets(target.customPresets || []);
    setCategoryWeights(target.categoryCuts || {});
    runwayRepository.saveLocalScenarios(scenarios, id);
    toast.info(`Switched to scenario: ${target.name}`);
  };

  const handleCreateScenario = async (name: string) => {
    try {
      syncState.setSyncing();
      const created = await runwayRepository.createRemoteScenario({
        name,
        isPrimary: false,
        jdgConfig,
        capitalPoolConfig,
        lookbackWindow,
        activePresetId,
        customPresets,
        categoryCuts: categoryWeights,
      });
      setScenarios((prev) => [...prev, created]);
      setActiveScenarioId(created.id);
      setJdgConfig(created.jdgConfig);
      setCapitalPoolConfig(created.capitalPoolConfig);
      setLookbackWindow(created.lookbackWindow);
      setActivePresetId(created.activePresetId);
      setCustomPresets(created.customPresets);
      setCategoryWeights(created.categoryCuts);
      syncState.setSynced();
      toast.success(`Created scenario: ${created.name}`);
    } catch {
      syncState.setOffline();
      toast.error("Failed to create scenario");
    }
  };

  const handleDuplicateScenario = async (id: string, name?: string) => {
    try {
      syncState.setSyncing();
      const duplicated = await runwayRepository.duplicateRemoteScenario(id, name);
      setScenarios((prev) => [...prev, duplicated]);
      setActiveScenarioId(duplicated.id);
      setJdgConfig(duplicated.jdgConfig);
      setCapitalPoolConfig(duplicated.capitalPoolConfig);
      setLookbackWindow(duplicated.lookbackWindow);
      setActivePresetId(duplicated.activePresetId);
      setCustomPresets(duplicated.customPresets);
      setCategoryWeights(duplicated.categoryCuts);
      syncState.setSynced();
      toast.success(`Duplicated scenario: ${duplicated.name}`);
    } catch {
      syncState.setOffline();
      toast.error("Failed to duplicate scenario");
    }
  };

  const handleRenameScenario = async (id: string, newName: string) => {
    try {
      syncState.setSyncing();
      const updated = await runwayRepository.updateRemoteScenario(id, { name: newName });
      setScenarios((prev) => prev.map((s) => (s.id === id ? updated : s)));
      syncState.setSynced();
      toast.success(`Renamed scenario to: ${updated.name}`);
    } catch {
      syncState.setOffline();
      toast.error("Failed to rename scenario");
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      syncState.setSyncing();
      await runwayRepository.deleteRemoteScenario(id);
      const nextList = scenarios.filter((s) => s.id !== id);
      setScenarios(nextList);

      if (activeScenarioId === id) {
        const nextActive = nextList.find((s) => s.isPrimary) ?? nextList[0];
        if (nextActive) {
          setActiveScenarioId(nextActive.id);
          setJdgConfig(nextActive.jdgConfig);
          setCapitalPoolConfig(nextActive.capitalPoolConfig);
          setLookbackWindow(nextActive.lookbackWindow);
          setActivePresetId(nextActive.activePresetId);
          setCustomPresets(nextActive.customPresets);
          setCategoryWeights(nextActive.categoryCuts);
        }
      }
      syncState.setSynced();
      toast.success("Deleted scenario");
    } catch {
      syncState.setOffline();
      toast.error("Failed to delete scenario");
    }
  };

  const handleSetPrimaryScenario = async (id: string) => {
    try {
      syncState.setSyncing();
      const updated = await runwayRepository.setPrimaryRemoteScenario(id);
      setScenarios((prev) => prev.map((s) => (s.id === id ? updated : { ...s, isPrimary: false })));
      syncState.setSynced();
      toast.success(`Designated "${updated.name}" as primary household plan`);
    } catch {
      syncState.setOffline();
      toast.error("Failed to update primary scenario");
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
    setLookbackWindow(reset.lookbackWindow ?? "3m");
    setActivePresetId(reset.activePresetId ?? "preset-normal");
    setCustomPresets(reset.customPresets ?? []);
    setCategoryWeights(reset.categoryWeights ?? {});
    toast.success("Reset runway scenario to project defaults.");
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
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Error State
  if (error && categories.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load runway simulator data</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData(undefined, true)}
            className="gap-1.5"
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
      {/* Multi-scenario Toolbar */}
      <RunwayScenarioToolbar
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        syncStatus={syncState.status}
        conflicts={syncState.conflicts}
        activeConflict={syncState.activeConflict}
        onResolveConflict={syncState.resolveConflict}
        linkedOfferTitle={linkedOffer?.title ?? null}
        onSelectScenario={handleSelectScenario}
        onCreateScenario={handleCreateScenario}
        onDuplicateScenario={handleDuplicateScenario}
        onRenameScenario={handleRenameScenario}
        onDeleteScenario={handleDeleteScenario}
        onSetPrimaryScenario={handleSetPrimaryScenario}
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span className="text-muted-foreground text-xs">
            Zero-revenue simulation across <strong>{capitalItems.length} accounts</strong> and{" "}
            <strong>{historicalBurnItems.length} living categories</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 gap-1.5 text-xs"
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
