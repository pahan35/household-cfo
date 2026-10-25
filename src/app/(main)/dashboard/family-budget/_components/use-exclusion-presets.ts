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

  // Initialize from localStorage on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedPresetsJson = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (storedPresetsJson) {
        const validPresets = parseStoredPresets(storedPresetsJson);
        setCustomPresets(validPresets);
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
    return mergePresets(defaultPresets, customPresets);
  }, [defaultPresets, customPresets]);

  const activePreset = useMemo(() => {
    return resolveActivePreset(allPresets, activePresetId, defaultPresets);
  }, [allPresets, activePresetId, defaultPresets]);

  const setActivePresetId = useCallback((id: string) => {
    setActivePresetIdState(id);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, id);
      } catch {
        // Ignore localStorage write failures
      }
    }
  }, []);

  const updatePreset = useCallback((presetToUpdate: ExclusionPreset) => {
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
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? activePreset;
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
    [activePresetId, allPresets, activePreset, updatePreset],
  );

  const setCategoryExclusion = useCallback(
    (categoryId: string, excluded: boolean, presetId = activePresetId) => {
      const targetPreset = allPresets.find((p) => p.id === presetId) ?? activePreset;
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
    },
    [activePresetId, setActivePresetId],
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
  };
}
