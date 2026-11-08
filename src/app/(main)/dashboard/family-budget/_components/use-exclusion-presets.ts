"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CloudSyncStatus,
  type ConflictRecord,
  type ConflictResolutionChoice,
  reconcileEntities,
} from "@/lib/cloud-sync-reconciler";

import type { ExternalProviderCategory } from "./external-provider-data";
import type { ExclusionPreset } from "./expense-transforms";

export const PRESETS_STORAGE_KEY = "family-budget:presets:v1";
export const ACTIVE_PRESET_STORAGE_KEY = "family-budget:active-preset:v1";
export const PRESETS_LAST_SYNCED_STORAGE_KEY = "family-budget:presets:lastSyncedAt:v1";

export const BUILT_IN_PRESET_IDS = {
  ALL_ACTIVITY: "all-activity",
  NET_LIVING: "net-living",
  CONTROLLABLE_EXPENSES: "controllable-expenses",
} as const;

const TAX_CATEGORY_REGEX = /(?:\btax(?:es)?\b|podat|налог)/i;
const RENT_CATEGORY_REGEX = /(rent|аренд|квартир|найм|czynsz|housing)/i;

/**
 * Finds category IDs whose name matches the given pattern.
 */
export function findCategoryIdsByPattern(categories: ExternalProviderCategory[], pattern: RegExp): string[] {
  return categories.filter((c) => pattern.test(c.name)).map((c) => c.id);
}

/**
 * Builds default presets with dynamically detected Tax and Rent category IDs.
 */
export function buildDefaultPresets(taxCategoryIds: string[] = [], rentCategoryIds: string[] = []): ExclusionPreset[] {
  return [
    {
      id: BUILT_IN_PRESET_IDS.ALL_ACTIVITY,
      name: "All Activity",
      incomeDeductions: [],
      expenseExclusions: [],
      isBuiltIn: true,
    },
    {
      id: BUILT_IN_PRESET_IDS.NET_LIVING,
      name: "Net Living",
      incomeDeductions: taxCategoryIds,
      expenseExclusions: [],
      isBuiltIn: true,
    },
    {
      id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
      name: "Controllable Expenses",
      incomeDeductions: taxCategoryIds,
      expenseExclusions: rentCategoryIds,
      isBuiltIn: true,
    },
  ];
}

/**
 * Parses and validates presets stored in localStorage.
 * Retains both custom presets and user-customized built-in presets.
 */
export function parseStoredPresets(storedPresetsJson: string | null): ExclusionPreset[] {
  if (!storedPresetsJson) return [];
  try {
    const parsed = JSON.parse(storedPresetsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ExclusionPreset =>
        Boolean(p) &&
        typeof p === "object" &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        Array.isArray(p.expenseExclusions) &&
        Array.isArray(p.incomeDeductions),
    );
  } catch {
    return [];
  }
}

/**
 * Merges default template presets with custom and customized built-in presets.
 */
export function mergePresets(defaultPresets: ExclusionPreset[], customPresets: ExclusionPreset[]): ExclusionPreset[] {
  const customMap = new Map(customPresets.map((p) => [p.id, p]));
  const defaults = defaultPresets.map((dp) => customMap.get(dp.id) ?? dp);
  const nonDefaultCustom = customPresets.filter((cp) => !defaultPresets.some((dp) => dp.id === cp.id));
  return [...defaults, ...nonDefaultCustom];
}

/**
 * Updates an exclusion list by adding or removing a category ID.
 */
export function updateCategoryExclusionList(
  currentExclusions: string[],
  categoryId: string,
  excluded: boolean,
): string[] {
  const set = new Set(currentExclusions);
  if (excluded) {
    set.add(categoryId);
  } else {
    set.delete(categoryId);
  }
  return Array.from(set);
}

/**
 * Toggles a category ID within an exclusion list.
 */
export function toggleCategoryExclusionList(currentExclusions: string[], categoryId: string): string[] {
  const set = new Set(currentExclusions);
  if (set.has(categoryId)) {
    set.delete(categoryId);
  } else {
    set.add(categoryId);
  }
  return Array.from(set);
}

/**
 * Resolves the currently active preset object from all available presets.
 */
export function resolveActivePreset(
  allPresets: ExclusionPreset[],
  activePresetId: string,
  defaultPresets: ExclusionPreset[],
): ExclusionPreset {
  return (
    allPresets.find((p) => p.id === activePresetId) ??
    defaultPresets.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES) ??
    defaultPresets[0]
  );
}

export interface SyncPresetsOptions {
  localPresets: ExclusionPreset[];
  localActiveId: string;
  defaultPresets: ExclusionPreset[];
  fetchFn?: typeof fetch;
  lastSyncedAt?: string | null;
  hasLocalStore?: boolean;
}

export interface SyncPresetsResult {
  presets: ExclusionPreset[];
  activePresetId: string;
  isOfflineFallback: boolean;
  wasAutoMigrated: boolean;
  conflicts: ConflictRecord<ExclusionPreset>[];
  status: CloudSyncStatus;
  lastSyncedAt?: string;
}

/**
 * Synchronizes presets with the Supabase API route, handling auto-migration,
 * offline auto-replay, conflict detection, and offline fallback.
 */
export async function syncPresetsWithRemote({
  localPresets,
  localActiveId,
  defaultPresets,
  fetchFn = fetch,
  lastSyncedAt,
  hasLocalStore = false,
}: SyncPresetsOptions): Promise<SyncPresetsResult> {
  try {
    const res = await fetchFn("/api/family-budget/presets", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch presets: HTTP ${res.status}`);
    }

    const data = await res.json();
    const remotePresets: ExclusionPreset[] = Array.isArray(data.presets) ? data.presets : [];
    const remoteActiveId: string = data.activePresetId ?? localActiveId;

    // Auto-migration (Task 3.2): if remote database is empty, seed it with merged local and default presets
    if (remotePresets.length === 0) {
      const presetsToSeed = mergePresets(defaultPresets, localPresets);
      const seedActiveId = localActiveId || BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;
      const now = new Date().toISOString();

      await fetchFn("/api/family-budget/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "seed_if_empty",
          presets: presetsToSeed,
          activePresetId: seedActiveId,
        }),
      });

      return {
        presets: presetsToSeed,
        activePresetId: seedActiveId,
        isOfflineFallback: false,
        wasAutoMigrated: true,
        conflicts: [],
        status: "synced",
        lastSyncedAt: now,
      };
    }

    // If local has no data yet (first load on this device and no local presets), adopt remote
    if (!hasLocalStore && localPresets.length === 0) {
      const now = new Date().toISOString();
      return {
        presets: remotePresets,
        activePresetId: remoteActiveId,
        isOfflineFallback: false,
        wasAutoMigrated: false,
        conflicts: [],
        status: "synced",
        lastSyncedAt: now,
      };
    }

    // Reconcile presets with auto-replay for offline-* entities and conflict detection
    const reconcileResult = await reconcileEntities<ExclusionPreset>({
      localEntities: localPresets,
      remoteEntities: remotePresets,
      lastSyncedAt,
      uploadOfflineEntity: async (preset) => {
        const serverId = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const prepared = { ...preset, id: serverId, updatedAt: new Date().toISOString() };
        await fetchFn("/api/family-budget/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert_preset", preset: prepared }),
        });
        return prepared;
      },
      getEntityName: (p) => p.name,
    });

    // If offline presets were replayed, push full updated list to remote
    if (Object.keys(reconcileResult.replayedIds).length > 0) {
      try {
        await fetchFn("/api/family-budget/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "seed_if_empty",
            presets: reconcileResult.mergedEntities,
            activePresetId: remoteActiveId,
          }),
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      presets: reconcileResult.mergedEntities,
      activePresetId: remoteActiveId,
      isOfflineFallback: false,
      wasAutoMigrated: false,
      conflicts: reconcileResult.conflicts,
      status: reconcileResult.status,
      lastSyncedAt: reconcileResult.conflicts.length === 0 ? new Date().toISOString() : undefined,
    };
  } catch {
    // Offline fallback (Task 3.1 & 3.3): return locally cached data
    return {
      presets: localPresets,
      activePresetId: localActiveId,
      isOfflineFallback: true,
      wasAutoMigrated: false,
      conflicts: [],
      status: "offline",
    };
  }
}

export interface UseExclusionPresetsOptions {
  fetchFn?: typeof fetch;
  disableAutoSync?: boolean;
}

/**
 * Hook to manage exclusion presets with localStorage persistence, Supabase synchronization,
 * and category auto-matching.
 */
export function useExclusionPresets(categories: ExternalProviderCategory[] = [], options?: UseExclusionPresetsOptions) {
  // Stable key based on category IDs & names to prevent re-detecting on re-allocated category arrays
  const categoriesKey = categories.map((c) => `${c.id}:${c.name}`).join(",");

  // Auto-detect Tax and Rent category IDs from available metadata
  // biome-ignore lint/correctness/useExhaustiveDependencies: categoriesKey captures all relevant category changes
  const detectedTaxCategoryIds = useMemo(
    () => findCategoryIdsByPattern(categories, TAX_CATEGORY_REGEX),
    [categoriesKey],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: categoriesKey captures all relevant category changes
  const detectedRentCategoryIds = useMemo(
    () => findCategoryIdsByPattern(categories, RENT_CATEGORY_REGEX),
    [categoriesKey],
  );

  const defaultPresets = useMemo(
    () => buildDefaultPresets(detectedTaxCategoryIds, detectedRentCategoryIds),
    [detectedTaxCategoryIds, detectedRentCategoryIds],
  );

  const [customPresets, setCustomPresets] = useState<ExclusionPreset[]>([]);
  const [activePresetId, setActivePresetIdState] = useState<string>(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(options?.disableAutoSync ? "synced" : "syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(PRESETS_LAST_SYNCED_STORAGE_KEY);
        return stored ? new Date(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [conflicts, setConflicts] = useState<ConflictRecord<ExclusionPreset>[]>([]);
  const [activeConflict, setActiveConflict] = useState<ConflictRecord<ExclusionPreset> | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Initialize from localStorage synchronously on mount, then trigger background Supabase synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    let localPresets: ExclusionPreset[] = [];
    let localActiveId: string = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;
    let hasLocalStore = false;
    let storedLastSyncedAt: string | null = null;

    try {
      const storedPresetsJson = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (storedPresetsJson) {
        localPresets = parseStoredPresets(storedPresetsJson);
        setCustomPresets(localPresets);
        hasLocalStore = true;
      }

      const storedActiveId = window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
      if (storedActiveId) {
        localActiveId = storedActiveId;
        setActivePresetIdState(storedActiveId);
      }

      storedLastSyncedAt = window.localStorage.getItem(PRESETS_LAST_SYNCED_STORAGE_KEY);
      if (storedLastSyncedAt) {
        setLastSyncedAt(new Date(storedLastSyncedAt));
      }
    } catch {
      // Ignore localStorage read failures
    }

    if (options?.disableAutoSync) {
      setSyncStatus("synced");
      return;
    }

    let isCancelled = false;
    setIsSyncing(true);
    setSyncStatus("syncing");

    const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);

    void syncPresetsWithRemote({
      localPresets,
      localActiveId,
      defaultPresets,
      fetchFn: fetchImpl,
      lastSyncedAt: storedLastSyncedAt,
      hasLocalStore,
    })
      .then((res) => {
        if (isCancelled) return;
        setIsOfflineFallback(res.isOfflineFallback);
        setSyncStatus(res.status);
        setConflicts(res.conflicts);
        if (res.conflicts.length > 0) {
          setActiveConflict(res.conflicts[0]);
        }
        if (res.lastSyncedAt) {
          setLastSyncedAt(new Date(res.lastSyncedAt));
          try {
            window.localStorage.setItem(PRESETS_LAST_SYNCED_STORAGE_KEY, res.lastSyncedAt);
          } catch {
            // Ignore
          }
        }
        if (!res.isOfflineFallback) {
          setCustomPresets(res.presets);
          setActivePresetIdState(res.activePresetId);
          try {
            window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(res.presets));
            window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, res.activePresetId);
          } catch {
            // Ignore localStorage write failures
          }
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsSyncing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [defaultPresets, options?.disableAutoSync, options?.fetchFn]);

  const allPresets = useMemo(() => {
    return mergePresets(defaultPresets, customPresets);
  }, [defaultPresets, customPresets]);

  const activePreset = useMemo(() => {
    return resolveActivePreset(allPresets, activePresetId, defaultPresets);
  }, [allPresets, activePresetId, defaultPresets]);

  const setActivePresetId = useCallback(
    (id: string) => {
      setActivePresetIdState(id);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, id);
        } catch {
          // Ignore localStorage write failures
        }
      }

      if (!options?.disableAutoSync) {
        const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);
        fetchImpl("/api/family-budget/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_active", activePresetId: id }),
        }).catch(() => {
          // Ignore network errors in background sync
        });
      }
    },
    [options?.disableAutoSync, options?.fetchFn],
  );

  const updatePreset = useCallback(
    (presetToUpdate: ExclusionPreset) => {
      const prepared: ExclusionPreset = {
        ...presetToUpdate,
        updatedAt: new Date().toISOString(),
      };
      setCustomPresets((prev) => {
        const next = [...prev.filter((p) => p.id !== prepared.id), prepared];
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore localStorage write failures
          }
        }
        return next;
      });

      if (!options?.disableAutoSync) {
        const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);
        fetchImpl("/api/family-budget/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert_preset", preset: prepared }),
        })
          .then(() => {
            const now = new Date().toISOString();
            setLastSyncedAt(new Date(now));
            setSyncStatus("synced");
            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem(PRESETS_LAST_SYNCED_STORAGE_KEY, now);
              } catch {
                // Ignore
              }
            }
          })
          .catch(() => {
            setSyncStatus("offline");
          });
      }
    },
    [options?.disableAutoSync, options?.fetchFn],
  );

  const savePreset = useCallback(
    (newPreset: ExclusionPreset) => {
      updatePreset(newPreset);
      setActivePresetId(newPreset.id);
    },
    [updatePreset, setActivePresetId],
  );

  const createPreset = useCallback(
    (name: string, expenseExclusions: string[] = [], incomeDeductions: string[] = []) => {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPreset: ExclusionPreset = {
        id,
        name: name.trim() || "Custom Preset",
        expenseExclusions,
        incomeDeductions,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savePreset(newPreset);
      return newPreset;
    },
    [savePreset],
  );

  const renamePreset = useCallback(
    (presetId: string, newName: string) => {
      const target = allPresets.find((p) => p.id === presetId);
      if (!target) return;
      updatePreset({ ...target, name: newName.trim() });
    },
    [allPresets, updatePreset],
  );

  const toggleCategoryExclusion = useCallback(
    (categoryId: string, presetId = activePresetId) => {
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? activePreset;
      const expenseExclusions = toggleCategoryExclusionList(targetPreset.expenseExclusions, categoryId);
      updatePreset({
        ...targetPreset,
        expenseExclusions,
      });
    },
    [activePresetId, allPresets, activePreset, updatePreset],
  );

  const setCategoryExclusion = useCallback(
    (categoryId: string, excluded: boolean, presetId = activePresetId) => {
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? activePreset;
      const expenseExclusions = updateCategoryExclusionList(targetPreset.expenseExclusions, categoryId, excluded);
      updatePreset({
        ...targetPreset,
        expenseExclusions,
      });
    },
    [activePresetId, allPresets, activePreset, updatePreset],
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      setCustomPresets((prev) => {
        const next = prev.filter((p) => p.id !== presetId);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore localStorage write failures
          }
        }
        return next;
      });

      if (activePresetId === presetId) {
        setActivePresetId(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      }

      if (!options?.disableAutoSync) {
        const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);
        fetchImpl("/api/family-budget/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_preset", presetId }),
        }).catch(() => {
          // Ignore network errors in background sync
        });
      }
    },
    [activePresetId, setActivePresetId, options?.disableAutoSync, options?.fetchFn],
  );

  const resolveConflict = useCallback(
    async (entityId: string, choice: ConflictResolutionChoice) => {
      const targetConflict = conflicts.find((c) => c.entityId === entityId) || activeConflict;
      if (!targetConflict) return;

      const chosenPreset = choice === "keep_local" ? targetConflict.localVersion : targetConflict.remoteVersion;
      const updatedPresets = customPresets.map((p) => (p.id === entityId ? chosenPreset : p));
      setCustomPresets(updatedPresets);

      const now = new Date().toISOString();
      setLastSyncedAt(new Date(now));

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
          window.localStorage.setItem(PRESETS_LAST_SYNCED_STORAGE_KEY, now);
        } catch {
          // Ignore
        }
      }

      if (choice === "keep_local" && !options?.disableAutoSync) {
        const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);
        try {
          await fetchImpl("/api/family-budget/presets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upsert_preset", preset: chosenPreset }),
          });
        } catch {
          // Ignore
        }
      }

      const remaining = conflicts.filter((c) => c.entityId !== entityId);
      setConflicts(remaining);
      if (remaining.length > 0) {
        setActiveConflict(remaining[0]);
        setSyncStatus("conflict");
      } else {
        setActiveConflict(null);
        setSyncStatus("synced");
        setIsConflictModalOpen(false);
      }
    },
    [conflicts, activeConflict, customPresets, options?.disableAutoSync, options?.fetchFn],
  );

  return {
    presets: allPresets,
    activePreset,
    activePresetId,
    setActivePresetId,
    savePreset,
    updatePreset,
    createPreset,
    renamePreset,
    toggleCategoryExclusion,
    setCategoryExclusion,
    deletePreset,
    detectedTaxCategoryIds,
    detectedRentCategoryIds,
    isSyncing,
    isOfflineFallback,
    syncStatus,
    lastSyncedAt,
    conflicts,
    activeConflict,
    resolveConflict,
    isConflictModalOpen,
    setIsConflictModalOpen,
  };
}
