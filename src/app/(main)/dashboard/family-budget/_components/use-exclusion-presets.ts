"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExternalProviderCategory } from "./external-provider-data";
import type { ExclusionPreset } from "./expense-transforms";

export const PRESETS_STORAGE_KEY = "family-budget:presets:v1";
export const ACTIVE_PRESET_STORAGE_KEY = "family-budget:active-preset:v1";

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
}

export interface SyncPresetsResult {
  presets: ExclusionPreset[];
  activePresetId: string;
  isOfflineFallback: boolean;
  wasAutoMigrated: boolean;
}

/**
 * Synchronizes presets with the Supabase API route, handling auto-migration and offline fallback.
 */
export async function syncPresetsWithRemote({
  localPresets,
  localActiveId,
  defaultPresets,
  fetchFn = fetch,
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
      };
    }

    return {
      presets: remotePresets,
      activePresetId: remoteActiveId,
      isOfflineFallback: false,
      wasAutoMigrated: false,
    };
  } catch {
    // Offline fallback (Task 3.1 & 3.3): return locally cached data
    return {
      presets: localPresets,
      activePresetId: localActiveId,
      isOfflineFallback: true,
      wasAutoMigrated: false,
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
  // Auto-detect Tax and Rent category IDs from available metadata
  const detectedTaxCategoryIds = useMemo(() => findCategoryIdsByPattern(categories, TAX_CATEGORY_REGEX), [categories]);

  const detectedRentCategoryIds = useMemo(
    () => findCategoryIdsByPattern(categories, RENT_CATEGORY_REGEX),
    [categories],
  );

  const defaultPresets = useMemo(
    () => buildDefaultPresets(detectedTaxCategoryIds, detectedRentCategoryIds),
    [detectedTaxCategoryIds, detectedRentCategoryIds],
  );

  const [customPresets, setCustomPresets] = useState<ExclusionPreset[]>([]);
  const [activePresetId, setActivePresetIdState] = useState<string>(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);

  // Initialize from localStorage synchronously on mount, then trigger background Supabase synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    let localPresets: ExclusionPreset[] = [];
    let localActiveId: string = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;

    try {
      const storedPresetsJson = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (storedPresetsJson) {
        localPresets = parseStoredPresets(storedPresetsJson);
        setCustomPresets(localPresets);
      }

      const storedActiveId = window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
      if (storedActiveId) {
        localActiveId = storedActiveId;
        setActivePresetIdState(storedActiveId);
      }
    } catch {
      // Ignore localStorage read failures
    }

    if (options?.disableAutoSync) return;

    let isCancelled = false;
    setIsSyncing(true);

    const fetchImpl = options?.fetchFn ?? (typeof window !== "undefined" ? window.fetch.bind(window) : fetch);

    void syncPresetsWithRemote({
      localPresets,
      localActiveId,
      defaultPresets,
      fetchFn: fetchImpl,
    })
      .then((res) => {
        if (isCancelled) return;
        setIsOfflineFallback(res.isOfflineFallback);
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
      setCustomPresets((prev) => {
        const next = [...prev.filter((p) => p.id !== presetToUpdate.id), presetToUpdate];
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
          body: JSON.stringify({ action: "upsert_preset", preset: presetToUpdate }),
        }).catch(() => {
          // Ignore network errors in background sync
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
  };
}
