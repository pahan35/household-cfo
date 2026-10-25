"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import { getCategories, getCurrencies, getSettings, getTransactionPage } from "../../_components/external-provider-client";
import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
} from "../../_components/external-provider-data";
import { type BenefitCeilingsSummary, computeBenefitSpendCeilings } from "./benefit-matcher";
import { BudgetImpactView } from "./budget-impact-view";
import { DEFAULT_COMPARATOR_CONFIG } from "./compensation-engine";
import { GlobalAssumptionsBar } from "./global-assumptions-bar";
import { OfferComparisonMatrix } from "./offer-comparison-matrix";
import { LocalStorageOfferRepository } from "./offer-repository";
import { OfferRevisionSheet } from "./offer-revision-sheet";
import type { ComparatorGlobalConfig, OfferRevision, OfferTrack } from "./offer-types";
import { ReverseRecruiterCard } from "./reverse-recruiter-card";

const repository = new LocalStorageOfferRepository();

export function OfferComparatorDashboard() {
  // State for tracks and config
  const [tracks, setTracks] = useState<OfferTrack[]>([]);
  const [config, setConfig] = useState<ComparatorGlobalConfig>(DEFAULT_COMPARATOR_CONFIG);
  const [isRepoLoaded, setIsRepoLoaded] = useState(false);

  // ExternalProvider live data
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [liveRates, setLiveRates] = useState<Record<string, number>>({});

  // Editor sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<OfferTrack | null>(null);
  const [editingRevision, setEditingRevision] = useState<OfferRevision | null>(null);
  const [isNewTrack, setIsNewTrack] = useState(false);

  // 1. Load repository tracks and config
  useEffect(() => {
    async function initRepo() {
      try {
        const data = await repository.load();
        setTracks(data.tracks);
        setConfig(data.globalConfig);
      } catch (e) {
        console.error("Failed to initialize offer comparator repository", e);
      } finally {
        setIsRepoLoaded(true);
      }
    }
    void initRepo();
  }, []);

  // 2. Fetch ExternalProvider live data
  useEffect(() => {
    async function loadExternalProvider() {
      try {
        const [catRes, curRes, txRes] = await Promise.allSettled([
          getCategories(),
          getCurrencies(),
          getTransactionPage({ skip: 0, take: 500 }),
        ]);

        if (catRes.status === "fulfilled") {
          setCategories(catRes.value);
        }
        if (curRes.status === "fulfilled") {
          setCurrencies(curRes.value);
          const rateMap: Record<string, number> = {};
          for (const c of curRes.value) {
            if (c.id && c.rate) {
              rateMap[c.id.toUpperCase()] = c.rate;
            }
          }
          setLiveRates(rateMap);
        }
        if (txRes.status === "fulfilled") {
          setTransactions(txRes.value.transactions || []);
        }
      } catch {
        // ExternalProvider may not be configured; comparator operates in standalone mode
      }
    }
    void loadExternalProvider();
  }, []);

  // 3. Compute live benefit spend ceilings
  const ceilings: BenefitCeilingsSummary = useMemo(() => {
    return computeBenefitSpendCeilings({
      transactions,
      categories,
      currencies,
      defaultCurrency: "PLN",
      monthsWindow: 12,
    });
  }, [transactions, categories, currencies]);

  // Save changes to repository
  const handleConfigChange = useCallback(
    (updatedConfig: ComparatorGlobalConfig) => {
      setConfig(updatedConfig);
      void repository.save(tracks, updatedConfig);
    },
    [tracks],
  );

  const handleSaveRevision = useCallback(
    (savedTrack: OfferTrack, savedRevision: OfferRevision) => {
      const existingIndex = tracks.findIndex((t) => t.id === savedTrack.id);
      let updatedTracks: OfferTrack[];

      if (existingIndex >= 0) {
        updatedTracks = [...tracks];
        updatedTracks[existingIndex] = savedTrack;
      } else {
        updatedTracks = [...tracks, savedTrack];
      }

      setTracks(updatedTracks);
      void repository.save(updatedTracks, config);
      toast.success(`Saved revision: ${savedRevision.title}`);
    },
    [tracks, config],
  );

  const handleEditRevision = useCallback((track: OfferTrack, revision: OfferRevision) => {
    setEditingTrack(track);
    setEditingRevision(revision);
    setIsNewTrack(false);
    setIsSheetOpen(true);
  }, []);

  const handleCloneRevision = useCallback((track: OfferTrack, revision: OfferRevision) => {
    const clonedRev: OfferRevision = {
      ...revision,
      id: `rev-${Date.now()}`,
      title: `${revision.title} (Clone)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEditingTrack(track);
    setEditingRevision(clonedRev);
    setIsNewTrack(false);
    setIsSheetOpen(true);
    toast.info("Cloned revision. Make adjustments and click Save.");
  }, []);

  const handleDeleteRevision = useCallback(
    (trackId: string, revisionId: string) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;

      if (track.revisions.length <= 1) {
        // Remove entire track
        const updated = tracks.filter((t) => t.id !== trackId);
        setTracks(updated);
        void repository.save(updated, config);
        toast.success(`Removed track: ${track.companyName}`);
      } else {
        const remainingRevisions = track.revisions.filter((r) => r.id !== revisionId);
        const updatedTrack: OfferTrack = {
          ...track,
          revisions: remainingRevisions,
          activeRevisionId: track.activeRevisionId === revisionId ? remainingRevisions[0].id : track.activeRevisionId,
        };
        const updatedTracks = tracks.map((t) => (t.id === trackId ? updatedTrack : t));
        setTracks(updatedTracks);
        void repository.save(updatedTracks, config);
        toast.success("Removed revision");
      }
    },
    [tracks, config],
  );

  const handleAddTrack = useCallback(() => {
    setEditingTrack(null);
    setEditingRevision(null);
    setIsNewTrack(true);
    setIsSheetOpen(true);
  }, []);

  // Export JSON handler
  const handleExportJson = useCallback(() => {
    try {
      const json = repository.exportJson(tracks, config);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offer-comparator-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Exported comparator state to JSON file");
    } catch {
      toast.error("Failed to export JSON backup");
    }
  }, [tracks, config]);

  // Import JSON handler
  const handleImportJson = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = repository.importJson(text);
        setTracks(imported.tracks);
        setConfig(imported.globalConfig);
        await repository.save(imported.tracks, imported.globalConfig);
        toast.success(`Imported ${imported.tracks.length} offer tracks successfully`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import JSON file");
      }
    };
    input.click();
  }, []);

  // Reset defaults handler
  const handleResetDefaults = useCallback(async () => {
    if (confirm("Reset all offer tracks and comparator settings to default starter data?")) {
      const reset = await repository.resetToDefaults();
      setTracks(reset.tracks);
      setConfig(reset.globalConfig);
      toast.success("Reset offer comparator to defaults");
    }
  }, []);

  const targetNetTotalPln = (config.targetMonthlyExpensePln || 0) + (config.targetMonthlySavingsPln || 0);

  if (!isRepoLoaded) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-card p-6 text-xs text-muted-foreground">
        Loading offer comparator tracks and configuration...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Global Assumptions & FX Stress-Test Bar */}
      <GlobalAssumptionsBar
        config={config}
        onChange={handleConfigChange}
        liveRates={liveRates}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetDefaults={handleResetDefaults}
      />

      {/* 2. Reverse Recruiter Quick-Quote Matrix Card */}
      <ReverseRecruiterCard targetNetMonthlyPln={targetNetTotalPln} config={config} liveRates={liveRates} />

      {/* 3. Side-by-Side Offer Comparison Matrix & Restructure Diff */}
      <OfferComparisonMatrix
        tracks={tracks}
        config={config}
        liveRates={liveRates}
        onEditRevision={handleEditRevision}
        onCloneRevision={handleCloneRevision}
        onDeleteRevision={handleDeleteRevision}
        onAddTrack={handleAddTrack}
      />

      {/* 4. Family Budget Impact & Historical Career Archive View */}
      <BudgetImpactView tracks={tracks} config={config} liveRates={liveRates} />

      {/* 5. Offer Track & Revision Editor Drawer/Sheet */}
      <OfferRevisionSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        track={editingTrack}
        revision={editingRevision}
        isNewTrack={isNewTrack}
        ceilings={ceilings}
        onSave={handleSaveRevision}
        config={config}
        liveRates={liveRates}
      />
    </div>
  );
}
