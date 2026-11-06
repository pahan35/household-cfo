"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Banknote,
  Clock,
  Coins,
  GraduationCap,
  Heart,
  History,
  Home,
  Palmtree,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import { useLifestyleData } from "@/app/(main)/dashboard/family-budget/lifestyle/use-lifestyle-data";
import {
  auditSavingsPace,
  calculatePropertyAcquisition,
  computeHistoricalNetCashflowMargin,
} from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-engine";
import { MortgageRepository } from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-repository";
import { LocalStorageOfferRepository } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";
import type {
  OfferRevision,
  OfferTrack,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DualPlayerReflectionCards } from "./dual-player-reflection-cards";
import { GoalAcceleratorsGrid } from "./goal-accelerators-grid";
import { LearningRelaxRoiCard } from "./learning-relax-roi-card";
import { OpportunityMonetizationStudio } from "./opportunity-monetization-studio";
import { computeComprehensiveTimeValueSummary } from "./time-value-engine";
import { TimeValueRepository } from "./time-value-repository";
import type { TimeValueMotivatorConfig, WeeklyCheckInEntry } from "./time-value-types";
import { WeeklyCheckInLogCard } from "./weekly-checkin-log-card";

export function TimeValueDashboard() {
  const { transactions, categories, currencies, isLoading } = useLifestyleData();

  const timeValueRepo = useMemo(() => new TimeValueRepository(), []);
  const mortgageRepo = useMemo(() => new MortgageRepository(), []);
  const offerRepo = useMemo(() => new LocalStorageOfferRepository(), []);

  const [config, setConfig] = useState<TimeValueMotivatorConfig>(() => timeValueRepo.loadConfig());
  const [activeOfferRevision, setActiveOfferRevision] = useState<OfferRevision | null>(null);
  const [activeOfferTitle, setActiveOfferTitle] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("reflection");

  // Load offer comparator active revision on mount & listen for storage updates
  useEffect(() => {
    let isMounted = true;
    const loadOffer = async () => {
      try {
        const { tracks } = await offerRepo.load();
        const currentTrack = tracks.find((t: OfferTrack) => t.status === "current") ?? tracks[0];
        if (currentTrack && isMounted) {
          const rev =
            currentTrack.revisions.find((r: OfferRevision) => r.id === currentTrack.activeRevisionId) ??
            currentTrack.revisions[0];
          setActiveOfferRevision(rev || null);
          setActiveOfferTitle(`${currentTrack.companyName} (${rev?.title || "Active"})`);
        }
      } catch (err) {
        console.warn("Failed to load offer comparator track:", err);
      }
    };

    void loadOffer();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === timeValueRepo["storageKey"]) {
        setConfig(timeValueRepo.loadConfig());
      }
      if (e.key === offerRepo["storageKey"]) {
        void loadOffer();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, [offerRepo, timeValueRepo]);

  // Compute mortgage gap & baseline savings margin
  const mortgageMetrics = useMemo(() => {
    try {
      const mConfig = mortgageRepo.loadConfig();
      const propertySummary = calculatePropertyAcquisition(mConfig.property, mConfig.financing.downPaymentPct);

      const historicalNetMarginPln = computeHistoricalNetCashflowMargin({
        statPoints: [],
        categories,
        currencies,
        lookbackWindow: mConfig.goalTracking.lookbackWindow,
        fallbackMarginPln: mConfig.goalTracking.customMonthlyNetIncomeFallbackPln ?? 6000,
      });

      const audit = auditSavingsPace({
        upfrontCashMilestone1Pln: propertySummary.upfrontCashMilestone1Pln,
        upfrontCashMilestone2Pln: propertySummary.upfrontCashMilestone2Pln,
        monthsToSigning: mConfig.overlap.monthsToSigning,
        monthsToHandover: mConfig.overlap.monthsToSigning + mConfig.overlap.constructionWaitMonths,
        linkedGoalCategoryIds: mConfig.goalTracking.linkedGoalCategoryIds,
        allCategories: categories,
        currencies,
        historicalNetCashflowMarginPln: historicalNetMarginPln,
      });

      return {
        baselineMonthlySavingsPln:
          audit.historicalNetCashflowMarginPln > 0 ? audit.historicalNetCashflowMarginPln : 6000,
        milestone1GapPln: audit.milestone1GapPln,
        totalMortgageGapPln: audit.totalGapPln,
        pricePerSqmPln: mConfig.property.pricePerSqmPln || 15000,
      };
    } catch {
      return {
        baselineMonthlySavingsPln: 6000,
        milestone1GapPln: 90000,
        totalMortgageGapPln: 180000,
        pricePerSqmPln: 15000,
      };
    }
  }, [mortgageRepo, categories, currencies]);

  // Comprehensive summary
  const computed = useMemo(() => {
    return computeComprehensiveTimeValueSummary({
      config,
      activeOfferRevision,
      baselineMonthlySavingsPln: mortgageMetrics.baselineMonthlySavingsPln,
      milestone1GapPln: mortgageMetrics.milestone1GapPln,
      totalMortgageGapPln: mortgageMetrics.totalMortgageGapPln,
      pricePerSqmPln: mortgageMetrics.pricePerSqmPln,
      transactions,
      categories,
      currencies,
    });
  }, [config, activeOfferRevision, mortgageMetrics, transactions, categories, currencies]);

  const handleUpdateConfig = (updated: TimeValueMotivatorConfig) => {
    setConfig(updated);
    timeValueRepo.saveConfig(updated);
  };

  const handleAddLog = (entry: WeeklyCheckInEntry) => {
    const updated = timeValueRepo.addWeeklyCheckIn(entry);
    setConfig(updated);
  };

  const handleExportJson = () => {
    const jsonStr = timeValueRepo.exportJson(config);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-opportunity-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (jsonStr: string) => {
    const imported = timeValueRepo.importJson(jsonStr);
    setConfig(imported);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset Time & Opportunity Motivator to default configuration?")) {
      const reset = timeValueRepo.resetToDefaults();
      setConfig(reset);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI SUMMARY STRIP */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Reclaimed Weekly Drift */}
        <Card className="border-border/60 bg-muted/10 p-3.5 shadow-2xs">
          <CardContent className="p-0 space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1.5 font-medium">
              <Timer className="size-4 text-primary" />
              Reclaimed Drift Time
            </span>
            <div className="text-foreground text-xl font-bold">
              {computed.household.totalWeeklyReclaimedHours} hrs / week
            </div>
            <p className="text-muted-foreground text-[11px]">
              from {computed.household.totalWeeklyDriftHours}h total drift ({computed.household.totalWeeklyJoyHours}h
              joyful protected)
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Monthly Cashflow Boost */}
        <Card className="border-border/60 bg-muted/10 p-3.5 shadow-2xs">
          <CardContent className="p-0 space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1.5 font-medium">
              <Banknote className="size-4 text-emerald-500" />
              Monthly Extra Cashflow
            </span>
            <div className="text-emerald-600 dark:text-emerald-400 text-xl font-bold">
              +{computed.household.totalMonthlyCashflowBoostPln.toLocaleString()} PLN / mo
            </div>
            <p className="text-muted-foreground text-[11px]">
              +{computed.household.totalAnnualCashflowBoostPln.toLocaleString()} PLN/yr toward goals
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Spouse Compound Value */}
        <Card className="border-border/60 bg-muted/10 p-3.5 shadow-2xs">
          <CardContent className="p-0 space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1.5 font-medium">
              <Heart className="size-4 text-rose-500" />
              Spouse Opportunity Value
            </span>
            <div className="text-foreground text-xl font-bold">
              +{computed.household.totalSpouseMonthlyValuePln.toLocaleString()} PLN / mo
            </div>
            <p className="text-muted-foreground text-[11px]">Freelancing + pantry &amp; family automations</p>
          </CardContent>
        </Card>

        {/* KPI 4: 1st Mortgage Acceleration */}
        <Card className="border-border/60 bg-muted/10 p-3.5 shadow-2xs">
          <CardContent className="p-0 space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1.5 font-medium">
              <Home className="size-4 text-blue-500" />
              1st Mortgage Acceleration
            </span>
            <div className="text-blue-600 dark:text-blue-400 text-xl font-bold">
              -{computed.mortgageAcceleration.monthsSavedMilestone1} months
            </div>
            <p className="text-muted-foreground text-[11px]">
              +{computed.mortgageAcceleration.unlockedSqmPerYear} m²/yr unlocked at{" "}
              {mortgageMetrics.pricePerSqmPln.toLocaleString()} PLN/m²
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. SECTION NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="reflection" className="text-xs">
            Reflection &amp; Care
          </TabsTrigger>
          <TabsTrigger value="opportunity" className="text-xs">
            Opportunity Studio
          </TabsTrigger>
          <TabsTrigger value="goals" className="text-xs">
            Goal Accelerators
          </TabsTrigger>
          <TabsTrigger value="learning-relax" className="text-xs">
            Learning &amp; Relax
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            Weekly Log
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DUAL PLAYER REFLECTION & CARE CARDS */}
        <TabsContent value="reflection" className="space-y-6">
          <DualPlayerReflectionCards config={config} computed={computed} onChange={handleUpdateConfig} />
        </TabsContent>

        {/* TAB 2: OPPORTUNITY & MONETIZATION STUDIO */}
        <TabsContent value="opportunity" className="space-y-6">
          <OpportunityMonetizationStudio
            config={config}
            computed={computed}
            onChange={handleUpdateConfig}
            activeOfferTitle={activeOfferTitle}
          />
        </TabsContent>

        {/* TAB 3: GOAL ACCELERATORS GRID */}
        <TabsContent value="goals" className="space-y-6">
          <GoalAcceleratorsGrid config={config} computed={computed} onChange={handleUpdateConfig} />
        </TabsContent>

        {/* TAB 4: LEARNING & RESTORATIVE RELAX */}
        <TabsContent value="learning-relax" className="space-y-6">
          <LearningRelaxRoiCard config={config} computed={computed} onChange={handleUpdateConfig} />
        </TabsContent>

        {/* TAB 5: WEEKLY CHECK-IN LOG & BACKUP */}
        <TabsContent value="history" className="space-y-6">
          <WeeklyCheckInLogCard
            config={config}
            computed={computed}
            onAddLog={handleAddLog}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onResetDefaults={handleResetDefaults}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
