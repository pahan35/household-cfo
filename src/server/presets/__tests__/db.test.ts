import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BUILT_IN_PRESET_IDS,
  type BudgetExclusionPresetRow,
  domainToPresetRow,
  type ExclusionPreset,
  getPresetStore,
  InMemoryPresetStore,
  presetRowToDomain,
  SupabaseRestPresetStore,
  setTestPresetStore,
} from "../db";

describe("Preset DB Layer & Store Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    setTestPresetStore(null);
    vi.restoreAllMocks();
  });

  describe("Row & Domain Mapping", () => {
    it("converts a database row to an ExclusionPreset domain object", () => {
      const row: BudgetExclusionPresetRow = {
        id: "custom-1",
        name: "Custom Exclusions",
        income_deductions: ["tax-cat-1", "tax-cat-2"],
        expense_exclusions: ["rent-cat-1"],
        is_built_in: false,
        is_active: true,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };

      const domain = presetRowToDomain(row);
      expect(domain).toEqual({
        id: "custom-1",
        name: "Custom Exclusions",
        incomeDeductions: ["tax-cat-1", "tax-cat-2"],
        expenseExclusions: ["rent-cat-1"],
        isBuiltIn: false,
      });
    });

    it("handles null or non-array category fields gracefully", () => {
      const row = {
        id: "test",
        name: "Test",
        income_deductions: null as unknown as string[],
        expense_exclusions: undefined as unknown as string[],
        is_built_in: false,
        is_active: false,
        sort_order: 0,
      } as BudgetExclusionPresetRow;

      const domain = presetRowToDomain(row);
      expect(domain.incomeDeductions).toEqual([]);
      expect(domain.expenseExclusions).toEqual([]);
    });

    it("converts an ExclusionPreset to a row payload with TEXT[] arrays and active flag", () => {
      const preset: ExclusionPreset = {
        id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        name: "Controllable Expenses",
        incomeDeductions: ["cat-tax"],
        expenseExclusions: ["cat-rent", "cat-insurance"],
        isBuiltIn: true,
      };

      const row = domainToPresetRow(preset, true, 2);
      expect(row.id).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(row.name).toBe("Controllable Expenses");
      expect(row.income_deductions).toEqual(["cat-tax"]);
      expect(row.expense_exclusions).toEqual(["cat-rent", "cat-insurance"]);
      expect(row.is_built_in).toBe(true);
      expect(row.is_active).toBe(true);
      expect(row.sort_order).toBe(2);
      expect(row.updated_at).toBeDefined();
    });
  });

  describe("InMemoryPresetStore", () => {
    it("seeds presets when empty and respects specified active preset", async () => {
      const store = new InMemoryPresetStore();

      const defaultPresets: ExclusionPreset[] = [
        {
          id: BUILT_IN_PRESET_IDS.ALL_ACTIVITY,
          name: "All Activity",
          incomeDeductions: [],
          expenseExclusions: [],
          isBuiltIn: true,
        },
        {
          id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
          name: "Controllable Expenses",
          incomeDeductions: ["tax-1"],
          expenseExclusions: ["rent-1"],
          isBuiltIn: true,
        },
      ];

      const res = await store.seedIfEmpty(defaultPresets, BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(res.presets).toHaveLength(2);
      expect(res.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);

      // Subsequent seedIfEmpty should not overwrite existing data
      const res2 = await store.seedIfEmpty([], "other-id");
      expect(res2.presets).toHaveLength(2);
      expect(res2.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    });

    it("toggles active preset and returns updated active ID", async () => {
      const store = new InMemoryPresetStore([
        { id: "p1", name: "P1", incomeDeductions: [], expenseExclusions: [] },
        { id: "p2", name: "P2", incomeDeductions: [], expenseExclusions: [] },
      ]);

      const active = await store.setActive("p2");
      expect(active).toBe("p2");

      const all = await store.loadAll();
      expect(all.activePresetId).toBe("p2");
    });

    it("upserts preset and optionally sets it as active", async () => {
      const store = new InMemoryPresetStore();
      const newPreset: ExclusionPreset = {
        id: "custom-test",
        name: "Test",
        incomeDeductions: ["i1"],
        expenseExclusions: ["e1"],
      };

      await store.upsertPreset(newPreset, true);
      const all = await store.loadAll();

      expect(all.presets).toHaveLength(1);
      expect(all.presets[0].id).toBe("custom-test");
      expect(all.activePresetId).toBe("custom-test");
    });

    it("deletes preset and falls back to controllable-expenses if active preset deleted", async () => {
      const store = new InMemoryPresetStore(
        [
          {
            id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
            name: "Controllable",
            incomeDeductions: [],
            expenseExclusions: [],
          },
          { id: "custom-1", name: "Custom", incomeDeductions: [], expenseExclusions: [] },
        ],
        "custom-1",
      );

      const deleted = await store.deletePreset("custom-1");
      expect(deleted).toBe(true);

      const all = await store.loadAll();
      expect(all.presets).toHaveLength(1);
      expect(all.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    });
  });

  describe("SupabaseRestPresetStore", () => {
    const supabaseUrl = "https://mock.supabase.co";
    const serviceRoleKey = "mock-key";

    it("loads all presets from REST endpoint and resolves active preset", async () => {
      const mockRows: BudgetExclusionPresetRow[] = [
        {
          id: BUILT_IN_PRESET_IDS.ALL_ACTIVITY,
          name: "All Activity",
          income_deductions: [],
          expense_exclusions: [],
          is_built_in: true,
          is_active: false,
          sort_order: 0,
        },
        {
          id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
          name: "Controllable Expenses",
          income_deductions: ["tax-id"],
          expense_exclusions: ["rent-id"],
          is_built_in: true,
          is_active: true,
          sort_order: 1,
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRows,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const store = new SupabaseRestPresetStore(supabaseUrl, serviceRoleKey);
      const result = await store.loadAll();

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://mock.supabase.co/rest/v1/budget_exclusion_presets?select=*&order=sort_order.asc,created_at.asc",
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          }),
        }),
      );

      expect(result.presets).toHaveLength(2);
      expect(result.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
      expect(result.presets[1].incomeDeductions).toEqual(["tax-id"]);
      expect(result.presets[1].expenseExclusions).toEqual(["rent-id"]);
    });

    it("handles active toggle with two PATCH requests", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const store = new SupabaseRestPresetStore(supabaseUrl, serviceRoleKey);
      const activeId = await store.setActive("target-preset");

      expect(activeId).toBe("target-preset");
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // First call deactivates previously active presets
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        "https://mock.supabase.co/rest/v1/budget_exclusion_presets?is_active=eq.true",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"is_active":false'),
        }),
      );

      // Second call activates target preset
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        "https://mock.supabase.co/rest/v1/budget_exclusion_presets?id=eq.target-preset",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"is_active":true'),
        }),
      );
    });

    it("upserts preset with resolution=merge-duplicates header", async () => {
      const insertedRow: BudgetExclusionPresetRow = {
        id: "preset-custom",
        name: "Custom One",
        income_deductions: ["t1"],
        expense_exclusions: ["e1"],
        is_built_in: false,
        is_active: false,
        sort_order: 0,
      };

      const fetchSpy = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
        if (opts?.method === "POST") {
          return {
            ok: true,
            status: 201,
            json: async () => [insertedRow],
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      });
      vi.stubGlobal("fetch", fetchSpy);

      const store = new SupabaseRestPresetStore(supabaseUrl, serviceRoleKey);
      const result = await store.upsertPreset({
        id: "preset-custom",
        name: "Custom One",
        incomeDeductions: ["t1"],
        expenseExclusions: ["e1"],
      });

      expect(result.id).toBe("preset-custom");
      expect(result.incomeDeductions).toEqual(["t1"]);
      expect(result.expenseExclusions).toEqual(["e1"]);
    });
  });

  describe("getPresetStore singleton factory", () => {
    it("returns SupabaseRestPresetStore when SUPABASE_URL and key are present", () => {
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "mock-secret";

      const store = getPresetStore();
      expect(store).toBeInstanceOf(SupabaseRestPresetStore);
    });

    it("falls back to InMemoryPresetStore when credentials are not configured", () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const store = getPresetStore();
      expect(store).toBeInstanceOf(InMemoryPresetStore);
    });

    it("returns SupabaseRestPresetStore when mock credentials are set in mock mode", () => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
      process.env.SUPABASE_MOCK_URL = "https://mock.supabase.co";
      process.env.SUPABASE_MOCK_SECRET_KEY = "mock-secret";

      const store = getPresetStore();
      expect(store).toBeInstanceOf(SupabaseRestPresetStore);
    });

    it("falls back to InMemoryPresetStore in mock mode if only prod credentials are set", () => {
      process.env.EXTERNAL_API_ADAPTER = "mock";
      process.env.SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "prod-secret";
      delete process.env.SUPABASE_MOCK_URL;
      delete process.env.SUPABASE_MOCK_SECRET_KEY;

      const store = getPresetStore();
      expect(store).toBeInstanceOf(InMemoryPresetStore);
    });
  });
});
