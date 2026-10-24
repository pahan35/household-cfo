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
 * Hook to manage exclusion presets with localStorage persistence and category auto-matching.
 */
export function useExclusionPresets(categories: ExternalProviderCategory[] = []) {
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
  const [rentExclusionOverride, setRentExclusionOverride] = useState<boolean | null>(null);

  // Initialize from localStorage on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedPresetsJson = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (storedPresetsJson) {
        const parsed = JSON.parse(storedPresetsJson);
        if (Array.isArray(parsed)) {
          setCustomPresets(parsed.filter((p) => !p.isBuiltIn));
        }
      }

      const storedActiveId = window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
      if (storedActiveId) {
        setActivePresetIdState(storedActiveId);
      }
    } catch {
      // Ignore localStorage read failures
    }
  }, []);

  const allPresets = useMemo(() => {
    const customMap = new Map(customPresets.map((p) => [p.id, p]));
    const defaults = defaultPresets.map((dp) => customMap.get(dp.id) ?? dp);
    const nonDefaultCustom = customPresets.filter((cp) => !defaultPresets.some((dp) => dp.id === cp.id));
    return [...defaults, ...nonDefaultCustom];
  }, [defaultPresets, customPresets]);

  const rawActivePreset = useMemo(() => {
    return (
      allPresets.find((p) => p.id === activePresetId) ??
      defaultPresets.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES) ??
      defaultPresets[0]
    );
  }, [allPresets, activePresetId, defaultPresets]);

  // Apply rent exclusion override if user toggled quick switch
  const activePreset = useMemo(() => {
    if (rentExclusionOverride === null) {
      return rawActivePreset;
    }

    const currentExclusions = new Set(rawActivePreset.expenseExclusions);
    if (rentExclusionOverride) {
      for (const id of detectedRentCategoryIds) {
        currentExclusions.add(id);
      }
    } else {
      for (const id of detectedRentCategoryIds) {
        currentExclusions.delete(id);
      }
    }

    return {
      ...rawActivePreset,
      expenseExclusions: Array.from(currentExclusions),
    };
  }, [rawActivePreset, rentExclusionOverride, detectedRentCategoryIds]);

  const isRentExcluded = useMemo(() => {
    if (detectedRentCategoryIds.length === 0) {
      return false;
    }
    return detectedRentCategoryIds.some((id) => activePreset.expenseExclusions.includes(id));
  }, [detectedRentCategoryIds, activePreset.expenseExclusions]);

  const setActivePresetId = useCallback((id: string) => {
    setActivePresetIdState(id);
    setRentExclusionOverride(null); // Reset quick override on explicit preset switch
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, id);
      } catch {
        // Ignore localStorage write failures
      }
    }
  }, []);

  const updatePreset = useCallback((presetToUpdate: ExclusionPreset) => {
    const presetToSave: ExclusionPreset = {
      ...presetToUpdate,
      isBuiltIn: false,
    };

    setCustomPresets((prev) => {
      const next = [...prev.filter((p) => p.id !== presetToSave.id), presetToSave];
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore localStorage write failures
        }
      }
      return next;
    });

    setRentExclusionOverride(null);
  }, []);

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
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? rawActivePreset;
      const currentExclusions = new Set(targetPreset.expenseExclusions);
      if (currentExclusions.has(categoryId)) {
        currentExclusions.delete(categoryId);
      } else {
        currentExclusions.add(categoryId);
      }
      updatePreset({
        ...targetPreset,
        expenseExclusions: Array.from(currentExclusions),
      });
    },
    [activePresetId, allPresets, rawActivePreset, updatePreset],
  );

  const setCategoryExclusion = useCallback(
    (categoryId: string, excluded: boolean, presetId = activePresetId) => {
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? rawActivePreset;
      const currentExclusions = new Set(targetPreset.expenseExclusions);
      if (excluded) {
        currentExclusions.add(categoryId);
      } else {
        currentExclusions.delete(categoryId);
      }
      updatePreset({
        ...targetPreset,
        expenseExclusions: Array.from(currentExclusions),
      });
    },
    [activePresetId, allPresets, rawActivePreset, updatePreset],
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
    },
    [activePresetId, setActivePresetId],
  );

  const toggleRentExclusion = useCallback(() => {
    setRentExclusionOverride((prev) => {
      const currentVal = prev !== null ? prev : isRentExcluded;
      return !currentVal;
    });
  }, [isRentExcluded]);

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
    isRentExcluded,
    toggleRentExclusion,
    detectedTaxCategoryIds,
    detectedRentCategoryIds,
  };
}
