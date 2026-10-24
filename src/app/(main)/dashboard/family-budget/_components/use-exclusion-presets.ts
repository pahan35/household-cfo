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
    return [...defaultPresets, ...customPresets];
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

  const savePreset = useCallback(
    (newPreset: ExclusionPreset) => {
      const presetToSave: ExclusionPreset = {
        ...newPreset,
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

      setActivePresetId(presetToSave.id);
    },
    [setActivePresetId],
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
    deletePreset,
    isRentExcluded,
    toggleRentExclusion,
    detectedTaxCategoryIds,
    detectedRentCategoryIds,
  };
}
