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
import {
  calculateAmortization,
  calculatePropertyAcquisition,
  DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
} from "./mortgage-engine";
import { MortgageFinancingCard } from "./mortgage-financing-card";
import { MortgageRepository } from "./mortgage-repository";
import type {
  HomeGoalTrackingConfig,
  MortgageFinancingConfig,
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

  // Simulator scenario configuration
  const [config, setConfig] = useState<MortgageSimulatorConfig>(DEFAULT_MORTGAGE_SIMULATOR_CONFIG);

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

      // Load persisted configuration from localStorage
      const loadedConfig = repository.loadConfig();
      setConfig(loadedConfig);
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
    repository.saveConfig(updated);
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
    toast.success("Reset mortgage simulator scenario to project defaults.");
  };

  const handleRefresh = () => {
    void loadData(undefined, true);
    toast.info("Refreshed live ExternalProvider categories and statistics.");
  };

  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-4">
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
            Reset Scenario
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
    </div>
  );
}
