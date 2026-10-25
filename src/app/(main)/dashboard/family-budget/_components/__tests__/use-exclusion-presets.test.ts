import { describe, expect, it } from "vitest";

import { CategoryType, type ExternalProviderCategory } from "../external-provider-data";
import type { ExclusionPreset } from "../expense-transforms";
import {
  BUILT_IN_PRESET_IDS,
  buildDefaultPresets,
  findCategoryIdsByPattern,
  mergePresets,
  parseStoredPresets,
  resolveActivePreset,
} from "../use-exclusion-presets";

describe("use-exclusion-presets helpers", () => {
  describe("findCategoryIdsByPattern", () => {
    it("finds category IDs matching tax and rent patterns", () => {
      const mockCategories: ExternalProviderCategory[] = [
        { id: "cat-tax-pln", name: "Podatek PIT", categoryType: CategoryType.Expense },
        { id: "cat-rent-pln", name: "Rent & Housing", categoryType: CategoryType.Expense },
        { id: "cat-groceries", name: "Groceries", categoryType: CategoryType.Expense },
      ];

      const taxIds = findCategoryIdsByPattern(mockCategories, /(?:\btax(?:es)?\b|podat|налог)/i);
      const rentIds = findCategoryIdsByPattern(mockCategories, /(rent|аренд|квартир|найм|czynsz|housing)/i);

      expect(taxIds).toEqual(["cat-tax-pln"]);
      expect(rentIds).toEqual(["cat-rent-pln"]);
    });
  });

  describe("buildDefaultPresets", () => {
    it("generates default built-in presets with tax and rent category IDs mapped", () => {
      const defaultPresets = buildDefaultPresets(["cat-tax"], ["cat-rent"]);

      expect(defaultPresets).toHaveLength(3);
      expect(defaultPresets[0].id).toBe(BUILT_IN_PRESET_IDS.ALL_ACTIVITY);
      expect(defaultPresets[0].expenseExclusions).toEqual([]);
      expect(defaultPresets[0].incomeDeductions).toEqual([]);

      expect(defaultPresets[1].id).toBe(BUILT_IN_PRESET_IDS.NET_LIVING);
      expect(defaultPresets[1].incomeDeductions).toEqual(["cat-tax"]);
      expect(defaultPresets[1].expenseExclusions).toEqual([]);

      expect(defaultPresets[2].id).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(defaultPresets[2].incomeDeductions).toEqual(["cat-tax"]);
      expect(defaultPresets[2].expenseExclusions).toEqual(["cat-rent"]);
    });
  });

  describe("parseStoredPresets (localStorage persistence)", () => {
    it("returns an empty array on null, empty string, or invalid JSON", () => {
      expect(parseStoredPresets(null)).toEqual([]);
      expect(parseStoredPresets("")).toEqual([]);
      expect(parseStoredPresets("invalid-json{")).toEqual([]);
      expect(parseStoredPresets("123")).toEqual([]);
    });

    it("filters out invalid items without required fields", () => {
      const malformed = JSON.stringify([
        { id: "p1" }, // missing name and arrays
        { id: "p2", name: "Valid Custom", expenseExclusions: ["c1"], incomeDeductions: [] },
        "string-item",
        null,
      ]);

      const result = parseStoredPresets(malformed);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p2");
      expect(result[0].name).toBe("Valid Custom");
    });

    it("retains customized built-in presets (e.g. controllable-expenses) instead of dropping them", () => {
      const stored = JSON.stringify([
        {
          id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
          name: "Controllable Expenses (Customized)",
          expenseExclusions: ["cat-rent-1", "cat-tuition"],
          incomeDeductions: ["cat-tax-1"],
          isBuiltIn: true,
        },
        {
          id: "custom-preset-1",
          name: "My Custom Preset",
          expenseExclusions: ["cat-insurance"],
          incomeDeductions: [],
          isBuiltIn: false,
        },
      ]);

      const result = parseStoredPresets(stored);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toEqual([BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES, "custom-preset-1"]);
      expect(result[0].expenseExclusions).toEqual(["cat-rent-1", "cat-tuition"]);
    });
  });

  describe("mergePresets", () => {
    it("merges defaults with customized built-ins, preserving customized category exclusions", () => {
      const defaults = buildDefaultPresets(["default-tax"], ["default-rent"]);
      const customizedBuiltIn: ExclusionPreset = {
        id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        name: "Controllable Expenses",
        expenseExclusions: ["default-rent", "custom-insurance-id"],
        incomeDeductions: ["default-tax"],
        isBuiltIn: true,
      };

      const customPreset: ExclusionPreset = {
        id: "custom-vacation",
        name: "Vacation Mode",
        expenseExclusions: ["cat-hotels"],
        incomeDeductions: [],
        isBuiltIn: false,
      };

      const merged = mergePresets(defaults, [customizedBuiltIn, customPreset]);

      expect(merged).toHaveLength(4);

      // Default All Activity and Net Living remain intact
      expect(merged.find((p) => p.id === BUILT_IN_PRESET_IDS.ALL_ACTIVITY)?.expenseExclusions).toEqual([]);
      expect(merged.find((p) => p.id === BUILT_IN_PRESET_IDS.NET_LIVING)?.expenseExclusions).toEqual([]);

      // Controllable Expenses is overridden with customized exclusions
      const mergedControllable = merged.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(mergedControllable?.expenseExclusions).toEqual(["default-rent", "custom-insurance-id"]);

      // Custom preset is appended
      expect(merged.find((p) => p.id === "custom-vacation")?.name).toBe("Vacation Mode");
    });

    it("does not duplicate customized built-in presets in the merged list", () => {
      const defaults = buildDefaultPresets([], []);
      const customized = {
        id: BUILT_IN_PRESET_IDS.NET_LIVING,
        name: "Net Living Modified",
        expenseExclusions: ["c1"],
        incomeDeductions: ["c2"],
      };

      const merged = mergePresets(defaults, [customized]);
      const netLivingItems = merged.filter((p) => p.id === BUILT_IN_PRESET_IDS.NET_LIVING);
      expect(netLivingItems).toHaveLength(1);
      expect(netLivingItems[0].name).toBe("Net Living Modified");
    });
  });

  describe("resolveActivePreset", () => {
    it("resolves the requested active preset if present", () => {
      const presets = buildDefaultPresets(["tax1"], ["rent1"]);
      const active = resolveActivePreset(presets, BUILT_IN_PRESET_IDS.NET_LIVING, presets);
      expect(active.id).toBe(BUILT_IN_PRESET_IDS.NET_LIVING);
    });

    it("falls back to controllable-expenses if requested preset does not exist", () => {
      const presets = buildDefaultPresets(["tax1"], ["rent1"]);
      const active = resolveActivePreset(presets, "non-existent-preset", presets);
      expect(active.id).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    });

    it("falls back to the first preset if controllable-expenses is not found", () => {
      const singlePreset: ExclusionPreset[] = [
        { id: "custom-only", name: "Only One", expenseExclusions: [], incomeDeductions: [] },
      ];
      const active = resolveActivePreset(singlePreset, "unknown", singlePreset);
      expect(active.id).toBe("custom-only");
    });
  });
});
