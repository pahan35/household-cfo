import React from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CategoryType, type ExternalProviderCategory } from "../external-provider-data";
import type { ExclusionPreset } from "../expense-transforms";
import {
  BUILT_IN_PRESET_IDS,
  buildDefaultPresets,
  findCategoryIdsByPattern,
  mergePresets,
  parseStoredPresets,
  resolveActivePreset,
  syncPresetsWithRemote,
  toggleCategoryExclusionList,
  updateCategoryExclusionList,
  useExclusionPresets,
} from "../use-exclusion-presets";

interface HookHarnessProps {
  categories?: ExternalProviderCategory[];
  fetchFn: typeof fetch;
  onMount: (controller: ReturnType<typeof useExclusionPresets>) => void;
}

function HookHarness({ categories = [], fetchFn, onMount }: HookHarnessProps) {
  const controller = useExclusionPresets(categories, {
    fetchFn,
    disableAutoSync: false,
  });
  onMount(controller);
  return null;
}

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

  describe("syncPresetsWithRemote (Cloud Sync & Auto-Migration)", () => {
    const defaultPresets = buildDefaultPresets(["cat-tax-1"], ["cat-rent-1"]);

    it("auto-migrates when remote is empty by seeding defaults and local presets", async () => {
      const localPresets: ExclusionPreset[] = [
        {
          id: "custom-local",
          name: "My Local Custom",
          expenseExclusions: ["cat-gym"],
          incomeDeductions: [],
        },
      ];

      const fetchSpy = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
        if (opts?.method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ presets: [], activePresetId: null }),
        };
      });

      const res = await syncPresetsWithRemote({
        localPresets,
        localActiveId: "custom-local",
        defaultPresets,
        fetchFn: fetchSpy as unknown as typeof fetch,
      });

      expect(res.wasAutoMigrated).toBe(true);
      expect(res.isOfflineFallback).toBe(false);
      expect(res.activePresetId).toBe("custom-local");
      expect(res.presets.some((p) => p.id === "custom-local")).toBe(true);
      expect(res.presets.some((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)).toBe(true);

      // Verify POST call was made with seed_if_empty
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/family-budget/presets",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"seed_if_empty"'),
        }),
      );
    });

    it("restores remote presets and active selection when remote data exists", async () => {
      const remotePresets: ExclusionPreset[] = [
        {
          id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
          name: "Controllable Expenses (Remote)",
          expenseExclusions: ["remote-rent-id"],
          incomeDeductions: ["remote-tax-id"],
        },
        {
          id: "custom-spouse",
          name: "Spouse Preset",
          expenseExclusions: ["remote-tuition"],
          incomeDeductions: [],
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ presets: remotePresets, activePresetId: "custom-spouse" }),
      });

      const res = await syncPresetsWithRemote({
        localPresets: [],
        localActiveId: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        defaultPresets,
        fetchFn: fetchSpy as unknown as typeof fetch,
      });

      expect(res.wasAutoMigrated).toBe(false);
      expect(res.isOfflineFallback).toBe(false);
      expect(res.presets).toEqual(remotePresets);
      expect(res.activePresetId).toBe("custom-spouse");
    });

    it("gracefully falls back to local presets on network failure", async () => {
      const localPresets: ExclusionPreset[] = [
        {
          id: "local-only",
          name: "Local Cache",
          expenseExclusions: ["local-car"],
          incomeDeductions: [],
        },
      ];

      const fetchSpy = vi.fn().mockRejectedValue(new Error("Network offline"));

      const res = await syncPresetsWithRemote({
        localPresets,
        localActiveId: "local-only",
        defaultPresets,
        fetchFn: fetchSpy as unknown as typeof fetch,
      });

      expect(res.isOfflineFallback).toBe(true);
      expect(res.wasAutoMigrated).toBe(false);
      expect(res.presets).toEqual(localPresets);
      expect(res.activePresetId).toBe("local-only");
    });

    it("gracefully falls back to local presets when server returns 500", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await syncPresetsWithRemote({
        localPresets: defaultPresets,
        localActiveId: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        defaultPresets,
        fetchFn: fetchSpy as unknown as typeof fetch,
      });

      expect(res.isOfflineFallback).toBe(true);
      expect(res.presets).toEqual(defaultPresets);
    });

    it("verifies multi-device synchronization and persistence across simulated reload", async () => {
      // Step 1: Device A modifies "Controllable Expenses" to exclude tuition and sets custom preset
      const customizedControllable: ExclusionPreset = {
        id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        name: "Controllable Expenses",
        expenseExclusions: ["cat-rent-1", "cat-tuition-1"],
        incomeDeductions: ["cat-tax-1"],
        isBuiltIn: true,
      };

      // Remote Supabase DB starts empty
      let remoteDb: ExclusionPreset[] = [];
      let remoteActivePresetId = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;

      const mockFetch = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
        if (opts?.method === "POST") {
          const body = JSON.parse(opts.body as string);
          if (body.action === "seed_if_empty") {
            remoteDb = body.presets;
            remoteActivePresetId = body.activePresetId;
            return {
              ok: true,
              status: 200,
              json: async () => ({ presets: remoteDb, activePresetId: remoteActivePresetId }),
            };
          }
          if (body.action === "upsert_preset") {
            remoteDb = [...remoteDb.filter((p) => p.id !== body.preset.id), body.preset];
            if (body.makeActive) remoteActivePresetId = body.preset.id;
            return { ok: true, status: 200, json: async () => ({ ok: true }) };
          }
          if (body.action === "set_active") {
            remoteActivePresetId = body.activePresetId;
            return { ok: true, status: 200, json: async () => ({ ok: true }) };
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ presets: remoteDb, activePresetId: remoteActivePresetId }),
        };
      });

      // Device A initializes with local customized controllable expenses
      const syncResultA = await syncPresetsWithRemote({
        localPresets: [customizedControllable],
        localActiveId: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        defaultPresets,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(syncResultA.wasAutoMigrated).toBe(true);
      expect(remoteDb.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)?.expenseExclusions).toEqual([
        "cat-rent-1",
        "cat-tuition-1",
      ]);

      // Step 2: Device B (e.g. mobile phone with zero localStorage) loads presets
      const syncResultB = await syncPresetsWithRemote({
        localPresets: [],
        localActiveId: BUILT_IN_PRESET_IDS.ALL_ACTIVITY,
        defaultPresets,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(syncResultB.wasAutoMigrated).toBe(false);
      expect(
        syncResultB.presets.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)?.expenseExclusions,
      ).toEqual(["cat-rent-1", "cat-tuition-1"]);

      // Step 3: Device B creates a new custom preset and sets it active
      await mockFetch("/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({
          action: "upsert_preset",
          preset: {
            id: "custom-device-b",
            name: "Device B Preset",
            expenseExclusions: ["cat-car"],
            incomeDeductions: [],
          },
          makeActive: true,
        }),
      });

      // Step 4: Device A reloads browser, and syncs from Supabase
      const reloadSyncA = await syncPresetsWithRemote({
        localPresets: syncResultA.presets,
        localActiveId: syncResultA.activePresetId,
        defaultPresets,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(reloadSyncA.activePresetId).toBe("custom-device-b");
      expect(reloadSyncA.presets.some((p) => p.id === "custom-device-b")).toBe(true);
    });
  });

  describe("updateCategoryExclusionList & toggleCategoryExclusionList", () => {
    it("adds category when excluded is true", () => {
      const initial = ["cat-rent"];
      const result = updateCategoryExclusionList(initial, "cat-tuition", true);
      expect(result).toEqual(["cat-rent", "cat-tuition"]);
    });

    it("does not duplicate category when excluded is true and category already exists", () => {
      const initial = ["cat-rent", "cat-tuition"];
      const result = updateCategoryExclusionList(initial, "cat-rent", true);
      expect(result).toEqual(["cat-rent", "cat-tuition"]);
    });

    it("removes category when excluded is false (regression test)", () => {
      const initial = ["cat-rent", "cat-tuition"];
      const result = updateCategoryExclusionList(initial, "cat-rent", false);
      expect(result).toEqual(["cat-tuition"]);
    });

    it("leaves exclusions unchanged when excluded is false and category is not present", () => {
      const initial = ["cat-tuition"];
      const result = updateCategoryExclusionList(initial, "cat-rent", false);
      expect(result).toEqual(["cat-tuition"]);
    });

    it("toggles category addition when absent and removal when present", () => {
      const added = toggleCategoryExclusionList(["cat-rent"], "cat-tuition");
      expect(added).toEqual(["cat-rent", "cat-tuition"]);

      const removed = toggleCategoryExclusionList(added, "cat-rent");
      expect(removed).toEqual(["cat-tuition"]);
    });
  });

  describe("useExclusionPresets hook actions (setCategoryExclusion & toggleCategoryExclusion)", () => {
    it("correctly removes category exclusion when setCategoryExclusion(id, false) is called", async () => {
      const ref = { current: null as ReturnType<typeof useExclusionPresets> | null };
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      const mockCategories: ExternalProviderCategory[] = [
        { id: "cat-rent-1", name: "Rent & Housing", categoryType: CategoryType.Expense },
      ];

      renderToString(
        React.createElement(HookHarness, {
          categories: mockCategories,
          fetchFn: fetchSpy as unknown as typeof fetch,
          onMount: (c) => {
            ref.current = c;
          },
        }),
      );

      expect(ref.current).not.toBeNull();
      const controller = ref.current;
      if (!controller) throw new Error("controller should be initialized");

      // Active preset defaults to CONTROLLABLE_EXPENSES, which includes "cat-rent-1"
      expect(controller.activePreset.expenseExclusions).toContain("cat-rent-1");

      // Clear initial GET sync call
      fetchSpy.mockClear();

      // Action: unexclude "cat-rent-1"
      controller.setCategoryExclusion("cat-rent-1", false);

      // Verify that updatePreset was invoked with "cat-rent-1" removed from exclusions
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/family-budget/presets",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"upsert_preset"'),
        }),
      );

      const lastCallBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(lastCallBody.preset.id).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(lastCallBody.preset.expenseExclusions).not.toContain("cat-rent-1");
    });

    it("correctly adds category exclusion when setCategoryExclusion(id, true) is called", async () => {
      const ref = { current: null as ReturnType<typeof useExclusionPresets> | null };
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      renderToString(
        React.createElement(HookHarness, {
          categories: [],
          fetchFn: fetchSpy as unknown as typeof fetch,
          onMount: (c) => {
            ref.current = c;
          },
        }),
      );

      expect(ref.current).not.toBeNull();
      const controller = ref.current;
      if (!controller) throw new Error("controller should be initialized");

      fetchSpy.mockClear();

      // Action: exclude "cat-tuition"
      controller.setCategoryExclusion("cat-tuition", true);

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/family-budget/presets",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"upsert_preset"'),
        }),
      );

      const lastCallBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(lastCallBody.preset.expenseExclusions).toContain("cat-tuition");
    });
  });
});
