"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { format } from "date-fns";
import { Banknote, Building, Coins, RotateCcw, RotateCw, Target } from "lucide-react";
import { toast } from "sonner";

import {
  getBudgetSelection,
  getCategories,
  getCurrencies,
  getSettings,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-client";
import {
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  formatMoney,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { useExternalProviderSync } from "@/app/(main)/dashboard/family-budget/_components/external-provider-sync-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { BudgetImpactCard } from "./budget-impact-card";
import { HomeGoalTrackerCard } from "./home-goal-tracker-card";
import { calculateAmortization, calculatePropertyAcquisition } from "./mortgage-engine";
import { MortgageFinancingCard } from "./mortgage-financing-card";
import { MortgageRepository } from "./mortgage-repository";
import { MortgageScenarioComparisonDialog } from "./mortgage-scenario-comparison-dialog";
import { MortgageScenarioToolbar } from "./mortgage-scenario-toolbar";
import type {
  HomeGoalTrackingConfig,
  MortgageFinancingConfig,
  MortgageScenario,
  MortgageSimulatorConfig,
  OverlapTimelineConfig,
  PropertyAcquisitionConfig,
} from "./mortgage-types";
import { OverlapCashflowCard } from "./overlap-cashflow-card";
import { PropertyAcquisitionCard } from "./property-acquisition-card";

const repository = new MortgageRepository();

export function MortgageDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [_settings, setSettings] = useState<ExternalProviderSettings>({});
  const [statPoints, setStatPoints] = useState<StatPoint[]>([]);

  // Multi-scenario state
  const [scenarios, setScenarios] = useState<MortgageScenario[]>(() => {
    const local = repository.loadLocalScenarios();
    return local.scenarios;
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    const local = repository.loadLocalScenarios();
    return local.activeScenarioId ?? local.scenarios[0]?.id ?? "local-primary";
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Simulator scenario configuration
  const [config, setConfig] = useState<MortgageSimulatorConfig>(() => {
    return repository.loadConfig();
  });

  const loadData = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setIsLoading(true);
    try {
      const currentMonthAnchor = format(new Date(), "yyyy-MM-01");

      const [settingsRes, categoriesRes, currenciesRes, statRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
        getCurrencies({ signal, forceRefresh }),
        getBudgetSelection({ from: currentMonthAnchor, signal, forceRefresh }),
      ]);

      if (settingsRes.status === "fulfilled") setSettings(settingsRes.value);
      if (categoriesRes.status === "fulfilled") setCategories(categoriesRes.value);
      if (currenciesRes.status === "fulfilled") setCurrencies(currenciesRes.value);
      if (statRes.status === "fulfilled") setStatPoints(statRes.value?.selection?.points ?? []);

      // Synchronize scenarios from Supabase
      setIsSyncing(true);
      try {
        const remote = await repository.fetchRemoteScenarios(signal);
        setScenarios(remote.scenarios);
        setActiveScenarioId(remote.activeScenarioId);
        setIsOfflineFallback(Boolean(remote.isOfflineFallback));

        const active = remote.scenarios.find((s) => s.id === remote.activeScenarioId) ?? remote.scenarios[0];
        if (active) {
          setConfig(active.config);
        }
      } catch (err) {
        console.error("Failed to sync scenarios with Supabase:", err);
      } finally {
        setIsSyncing(false);
      }
    } catch (err) {
      console.error("Failed to load mortgage dashboard data:", err);
      toast.error("Failed to load live ExternalProvider data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, syncVersion]);

  // Derived financial models
  const propertySummary = useMemo(() => {
    return calculatePropertyAcquisition(config.property, config.financing.downPaymentPct);
  }, [config.property, config.financing.downPaymentPct]);

  const amortization = useMemo(() => {
    return calculateAmortization(propertySummary.loanPrincipalPln, config.financing);
  }, [propertySummary.loanPrincipalPln, config.financing]);

  // State update handlers with persistence
  const updateConfig = (patch: Partial<MortgageSimulatorConfig>) => {
    const updated: MortgageSimulatorConfig = {
      ...config,
      ...patch,
    };
    setConfig(updated);
    setScenarios((prev) => prev.map((s) => (s.id === activeScenarioId ? { ...s, config: updated } : s)));
    repository.saveConfig(updated);
    void repository.updateRemoteScenario(activeScenarioId, { config: updated }).catch(() => {
      // Ignore background sync errors
    });
  };

  const handlePropertyChange = (property: PropertyAcquisitionConfig) => {
    updateConfig({ property });
  };

  const handleFinancingChange = (financing: MortgageFinancingConfig) => {
    updateConfig({ financing });
  };

  const handleOverlapChange = (overlap: OverlapTimelineConfig) => {
    updateConfig({ overlap });
  };

  const handleGoalTrackingChange = (goalTracking: HomeGoalTrackingConfig) => {
    updateConfig({ goalTracking });
  };

  const handleReset = () => {
    const reset = repository.resetToDefaults();
    setConfig(reset);
    updateConfig(reset);
    toast.success("Reset mortgage simulator scenario to project defaults.");
  };

  const handleRefresh = () => {
    void loadData(undefined, true);
    toast.info("Refreshed live ExternalProvider categories and cloud scenarios.");
  };

  // Scenario Management Handlers
  const handleSelectScenario = (id: string) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    setActiveScenarioId(id);
    setConfig(target.config);
    repository.saveLocalScenarios(scenarios, id);
    toast.info(`Switched to scenario: ${target.name}`);
  };

  const handleCreateScenario = async (name: string) => {
    try {
      setIsSyncing(true);
      const created = await repository.createRemoteScenario({
        name,
        isPrimary: false,
        config,
      });
      setScenarios((prev) => [...prev, created]);
      setActiveScenarioId(created.id);
      setConfig(created.config);
      toast.success(`Created scenario: ${created.name}`);
    } catch {
      toast.error("Failed to create scenario");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDuplicateScenario = async (id: string, name?: string) => {
    try {
      setIsSyncing(true);
      const duplicated = await repository.duplicateRemoteScenario(id, name);
      setScenarios((prev) => [...prev, duplicated]);
      setActiveScenarioId(duplicated.id);
      setConfig(duplicated.config);
      toast.success(`Duplicated scenario: ${duplicated.name}`);
    } catch {
      toast.error("Failed to duplicate scenario");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRenameScenario = async (id: string, newName: string) => {
    try {
      setIsSyncing(true);
      const updated = await repository.updateRemoteScenario(id, { name: newName });
      setScenarios((prev) => prev.map((s) => (s.id === id ? updated : s)));
      toast.success(`Renamed scenario to: ${updated.name}`);
    } catch {
      toast.error("Failed to rename scenario");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      setIsSyncing(true);
      await repository.deleteRemoteScenario(id);
      const nextList = scenarios.filter((s) => s.id !== id);
      setScenarios(nextList);

      if (activeScenarioId === id) {
        const nextActive = nextList.find((s) => s.isPrimary) ?? nextList[0];
        if (nextActive) {
          setActiveScenarioId(nextActive.id);
          setConfig(nextActive.config);
        }
      }
      toast.success("Deleted scenario");
    } catch {
      toast.error("Failed to delete scenario");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSetPrimaryScenario = async (id: string) => {
    try {
      setIsSyncing(true);
      const updated = await repository.setRemotePrimary(id);
      setScenarios((prev) => prev.map((s) => (s.id === id ? updated : { ...s, isPrimary: false })));
      toast.success(`Designated "${updated.name}" as primary household plan`);
    } catch {
      toast.error("Failed to update primary scenario");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton preview
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Multi-Scenario Toolbar */}
      <MortgageScenarioToolbar
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        isSyncing={isSyncing}
        isOfflineFallback={isOfflineFallback}
        onSelectScenario={handleSelectScenario}
        onCreateScenario={handleCreateScenario}
        onDuplicateScenario={handleDuplicateScenario}
        onRenameScenario={handleRenameScenario}
        onDeleteScenario={handleDeleteScenario}
        onSetPrimaryScenario={handleSetPrimaryScenario}
        onOpenCompare={() => setIsCompareOpen(true)}
      />

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            Primary Market (Rynek Pierwotny)
          </Badge>
          <Badge variant="secondary" className="text-xs font-normal">
            Amortization: {config.financing.loanTermYears} yrs @ {amortization.effectiveRatePct.toFixed(2)}%
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
          >
            <RotateCcw className="size-3.5" />
            Reset Inputs
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-muted/10 p-3 shadow-2xs">
          <CardContent className="space-y-1 p-0">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Building className="size-3.5" /> Total Property
            </span>
            <div className="text-foreground text-lg font-bold">
              {formatMoney(propertySummary.propertyTotalPln, "PLN")}
            </div>
            <p className="text-muted-foreground text-[11px]">
              {config.property.areaSqm} m² @ {formatMoney(config.property.pricePerSqmPln, "PLN")}/m²
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/10 p-3 shadow-2xs">
          <CardContent className="space-y-1 p-0">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Target className="text-primary size-3.5" /> Day-1 Upfront Cash
            </span>
            <div className="text-primary text-lg font-bold">
              {formatMoney(propertySummary.upfrontCashMilestone1Pln, "PLN")}
            </div>
            <p className="text-muted-foreground text-[11px]">
              {config.financing.downPaymentPct}% down payment + closing fees
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/10 p-3 shadow-2xs">
          <CardContent className="space-y-1 p-0">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Banknote className="size-3.5" /> Bank Loan Principal
            </span>
            <div className="text-foreground text-lg font-bold">
              {formatMoney(propertySummary.loanPrincipalPln, "PLN")}
            </div>
            <p className="text-muted-foreground text-[11px]">
              {config.financing.installmentType === "equal" ? "Equal installments" : "Decreasing installments"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/10 p-3 shadow-2xs">
          <CardContent className="space-y-1 p-0">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Coins className="size-3.5 text-emerald-600 dark:text-emerald-400" /> 1st Installment
            </span>
            <div className="text-foreground text-lg font-bold">
              {formatMoney(amortization.firstMonthInstallmentPln, "PLN")}
              <span className="text-muted-foreground text-xs font-normal">/mo</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Rate: {amortization.effectiveRatePct.toFixed(2)}% ({config.financing.loanTermYears} yrs)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Simulator Modules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PropertyAcquisitionCard config={config.property} summary={propertySummary} onChange={handlePropertyChange} />

        <MortgageFinancingCard
          config={config.financing}
          propertySummary={propertySummary}
          amortization={amortization}
          onChange={handleFinancingChange}
        />
      </div>

      <HomeGoalTrackerCard
        config={config.goalTracking}
        propertySummary={propertySummary}
        overlapConfig={config.overlap}
        allCategories={categories}
        currencies={currencies}
        statPoints={statPoints}
        onChange={handleGoalTrackingChange}
        onCategoriesUpdated={setCategories}
      />

      <OverlapCashflowCard
        config={config.overlap}
        propertySummary={propertySummary}
        amortization={amortization}
        onChange={handleOverlapChange}
      />

      <BudgetImpactCard
        propertySummary={propertySummary}
        amortization={amortization}
        overlapConfig={config.overlap}
        financing={config.financing}
        goalTracking={config.goalTracking}
        onGoalTrackingChange={handleGoalTrackingChange}
      />

      {/* Comparison Modal */}
      <MortgageScenarioComparisonDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
      />
    </div>
  );
}
