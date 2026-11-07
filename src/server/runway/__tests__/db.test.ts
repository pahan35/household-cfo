import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { OfferRevision } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import {
  DEFAULT_CAPITAL_POOL_CONFIG,
  DEFAULT_JDG_RUNWAY_CONFIG,
} from "@/app/(main)/dashboard/family-budget/runway/_components/runway-engine";
import type { RunwayScenario } from "@/app/(main)/dashboard/family-budget/runway/_components/runway-types";

import {
  InMemoryRunwayStore,
  type RunwayCategoryCutRow,
  type RunwayScenarioRow,
  rowToScenario,
  SupabaseRestRunwayStore,
  scenarioToRow,
  setTestRunwayStore,
} from "../db";

describe("Runway DB Layer & Store Tests", () => {
  afterEach(() => {
    setTestRunwayStore(null);
    vi.restoreAllMocks();
  });

  describe("Serialization & Deserialization", () => {
    it("converts a full database row and category cuts to RunwayScenario domain object", () => {
      const mockRow: RunwayScenarioRow = {
        id: "scen-runway-1",
        name: "Deep Freeze 2026",
        is_primary: true,
        posture: "suspended",
        regime: "b2b_ryczalt",
        zus_stage: "duzy_zus",
        voluntary_sickness: true,
        ryczalt_ytd_health_tier: "tier3",
        pfron_rebate_json: {
          enabled: true,
          type: "fixed_amount",
          percentage: 0,
          fixedAmountPln: 250,
        },
        monthly_accounting_cost_pln: "350.00",
        suspended_accounting_cost_pln: "80.00",
        voluntary_nfz_when_suspended: true,
        statutory_voluntary_nfz_pln: "720.00",
        wakacje_month_index: "8",
        include_month1_tax_tail: true,
        month1_vat7_pln: "4500.00",
        month1_ppe_pln: "3200.00",
        benefit_loss_replacement_pln: "850.00",
        residual_monthly_income_pln: "1500.00",
        capital_pool_config_json: {
          excludedItemIds: ["acc-1"],
          includeOffBalanceAccounts: false,
          includeGoals: true,
          safetyFloorPln: 25000,
          fxHaircutPct: 5,
        },
        baseline_offer_revision_id: "rev-uuid-123",
        lookback_window: "6m",
        active_preset_id: "preset-aggressive",
        custom_presets_json: [
          {
            id: "cust-1",
            name: "Winter Cut",
            isBuiltIn: false,
            weights: { "cat-food": { enabled: true, retentionPct: 60 } },
          },
        ],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      };

      const mockCuts: RunwayCategoryCutRow[] = [
        {
          scenario_id: "scen-runway-1",
          category_id: "cat-dining",
          retention_pct: "0.00",
          is_included: true,
        },
        {
          scenario_id: "scen-runway-1",
          category_id: "cat-groceries",
          retention_pct: "80.00",
          is_included: true,
        },
      ];

      const domain = rowToScenario(mockRow, mockCuts);

      expect(domain.id).toBe("scen-runway-1");
      expect(domain.name).toBe("Deep Freeze 2026");
      expect(domain.isPrimary).toBe(true);
      expect(domain.jdgConfig.posture).toBe("suspended");
      expect(domain.jdgConfig.regime).toBe("b2b_ryczalt");
      expect(domain.jdgConfig.ryczaltYtdHealthTier).toBe("tier3");
      expect(domain.jdgConfig.monthlyAccountingCostPln).toBe(350);
      expect(domain.jdgConfig.suspendedAccountingCostPln).toBe(80);
      expect(domain.jdgConfig.voluntaryNfzWhenSuspended).toBe(true);
      expect(domain.jdgConfig.statutoryVoluntaryNfzPln).toBe(720);
      expect(domain.jdgConfig.wakacjeMonthIndex).toBe(8);
      expect(domain.jdgConfig.includeMonth1TaxTail).toBe(true);
      expect(domain.jdgConfig.month1Vat7Pln).toBe(4500);
      expect(domain.jdgConfig.month1PpePln).toBe(3200);
      expect(domain.jdgConfig.benefitLossReplacementPln).toBe(850);
      expect(domain.jdgConfig.residualMonthlyIncomePln).toBe(1500);
      expect(domain.capitalPoolConfig.safetyFloorPln).toBe(25000);
      expect(domain.baselineOfferRevisionId).toBe("rev-uuid-123");
      expect(domain.lookbackWindow).toBe("6m");
      expect(domain.activePresetId).toBe("preset-aggressive");
      expect(domain.customPresets).toHaveLength(1);
      expect(domain.categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 0 });
      expect(domain.categoryCuts["cat-groceries"]).toEqual({ enabled: true, retentionPct: 80 });
    });

    it("handles null and sparse rows gracefully with safe defaults", () => {
      const sparseRow: RunwayScenarioRow = {
        id: "scen-sparse",
        name: "",
        is_primary: false,
        posture: "",
        regime: "",
        zus_stage: "",
        voluntary_sickness: false,
        ryczalt_ytd_health_tier: "",
        pfron_rebate_json: null,
        monthly_accounting_cost_pln: null as unknown as number,
        suspended_accounting_cost_pln: undefined as unknown as number,
        voluntary_nfz_when_suspended: false,
        statutory_voluntary_nfz_pln: null as unknown as number,
        wakacje_month_index: null as unknown as number,
        include_month1_tax_tail: false,
        month1_vat7_pln: null as unknown as number,
        month1_ppe_pln: null as unknown as number,
        benefit_loss_replacement_pln: null as unknown as number,
        residual_monthly_income_pln: null as unknown as number,
        capital_pool_config_json: null,
        baseline_offer_revision_id: null,
        lookback_window: "",
        active_preset_id: "",
        custom_presets_json: null,
        created_at: "",
        updated_at: "",
      };

      const domain = rowToScenario(sparseRow);
      expect(domain.id).toBe("scen-sparse");
      expect(domain.name).toBe("Baseline Austerity");
      expect(domain.isPrimary).toBe(false);
      expect(domain.jdgConfig.posture).toBe(DEFAULT_JDG_RUNWAY_CONFIG.posture);
      expect(domain.jdgConfig.regime).toBe(DEFAULT_JDG_RUNWAY_CONFIG.regime);
      expect(domain.jdgConfig.month1Vat7Pln).toBe(0);
      expect(domain.capitalPoolConfig).toEqual(DEFAULT_CAPITAL_POOL_CONFIG);
      expect(domain.categoryCuts).toEqual({});
      expect(domain.lookbackWindow).toBe("3m");
    });

    it("converts domain scenario back to partial row", () => {
      const scenario: Partial<RunwayScenario> = {
        name: "Test Scenario",
        isPrimary: true,
        jdgConfig: {
          ...DEFAULT_JDG_RUNWAY_CONFIG,
          posture: "wakacje_skladkowe",
          month1Vat7Pln: 2000,
        },
        lookbackWindow: "12m",
        baselineOfferRevisionId: "rev-456",
      };

      const row = scenarioToRow(scenario);
      expect(row.name).toBe("Test Scenario");
      expect(row.is_primary).toBe(true);
      expect(row.posture).toBe("wakacje_skladkowe");
      expect(row.month1_vat7_pln).toBe(2000);
      expect(row.lookback_window).toBe("12m");
      expect(row.baseline_offer_revision_id).toBe("rev-456");
    });
  });

  describe("InMemoryRunwayStore Operations & Cascades", () => {
    it("creates, retrieves, and lists scenarios", async () => {
      const store = new InMemoryRunwayStore();

      const created = await store.create({
        name: "Austerity Plan A",
        categoryCuts: {
          "cat-1": { enabled: true, retentionPct: 50 },
        },
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Austerity Plan A");
      expect(created.isPrimary).toBe(true); // First scenario is primary
      expect(created.categoryCuts["cat-1"]).toEqual({ enabled: true, retentionPct: 50 });

      const fetched = await store.get(created.id);
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.categoryCuts["cat-1"]).toEqual({ enabled: true, retentionPct: 50 });

      const list = await store.list();
      expect(list).toHaveLength(1);
    });

    it("updates scenario and overwrites category cuts cleanly", async () => {
      const store = new InMemoryRunwayStore();
      const s = await store.create({
        name: "Plan 1",
        categoryCuts: {
          "cat-old": { enabled: true, retentionPct: 20 },
        },
      });

      const updated = await store.update(s.id, {
        name: "Plan 1 Renamed",
        categoryCuts: {
          "cat-new": { enabled: false, retentionPct: 75 },
        },
      });

      expect(updated.name).toBe("Plan 1 Renamed");
      expect(updated.categoryCuts["cat-new"]).toEqual({ enabled: false, retentionPct: 75 });
      expect(updated.categoryCuts["cat-old"]).toBeUndefined();
    });

    it("cascades category cuts on scenario deletion and promotes next primary", async () => {
      const store = new InMemoryRunwayStore();
      const s1 = await store.create({
        name: "Primary Plan",
        isPrimary: true,
        categoryCuts: { "cat-1": { enabled: true, retentionPct: 0 } },
      });
      const s2 = await store.create({
        name: "Secondary Plan",
        isPrimary: false,
        categoryCuts: { "cat-2": { enabled: true, retentionPct: 50 } },
      });

      const deleted = await store.delete(s1.id);
      expect(deleted).toBe(true);

      const afterDeleteS1 = await store.get(s1.id);
      expect(afterDeleteS1).toBeNull();

      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(s2.id);
      expect(list[0].isPrimary).toBe(true); // Promoted to primary
    });

    it("duplicates scenario with cloned cuts and distinct non-primary state", async () => {
      const store = new InMemoryRunwayStore();
      const s1 = await store.create({
        name: "Original Plan",
        isPrimary: true,
        categoryCuts: { "cat-dining": { enabled: true, retentionPct: 10 } },
      });

      const dup = await store.duplicate(s1.id, "Original Plan (Duplicated)");
      expect(dup.id).not.toBe(s1.id);
      expect(dup.name).toBe("Original Plan (Duplicated)");
      expect(dup.isPrimary).toBe(false);
      expect(dup.categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 10 });
    });

    it("sets primary scenario and unsets previous primary", async () => {
      const store = new InMemoryRunwayStore();
      const s1 = await store.create({ name: "Plan 1", isPrimary: true });
      const s2 = await store.create({ name: "Plan 2", isPrimary: false });

      await store.setPrimary(s2.id);

      const updatedS1 = await store.get(s1.id);
      const updatedS2 = await store.get(s2.id);

      expect(updatedS1?.isPrimary).toBe(false);
      expect(updatedS2?.isPrimary).toBe(true);
    });

    it("links to active offer revision and retrieves baseline compensation", async () => {
      const store = new InMemoryRunwayStore();
      const mockOfferRev: OfferRevision = {
        id: "offer-rev-abc",
        trackId: "track-1",
        title: "Active B2B Contract",
        effectiveDate: "2026-01",
        rateSpec: { amount: 28000, currency: "PLN", period: "monthly" },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
          monthlyAccountingCostPln: 300,
        },
        timeOff: {
          model: "model_b_combined",
          combinedPtoDays: 26,
          stateHolidaysDeductedFromPool: false,
          paidStateHolidaysCount: 13,
        },
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        benefits: [
          {
            id: "b1",
            name: "Medicover",
            category: "health",
            nominalValuePln: 300,
            monthlyBudgetOffsetPln: 300,
            subjectiveUtilityWeightPct: 100,
          },
        ],
        equityGrants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.setMockOfferRevision(mockOfferRev);

      const scenario = await store.create({
        name: "Offer Linked Scenario",
        baselineOfferRevisionId: "offer-rev-abc",
      });

      const linkedRev = await store.getLinkedOfferRevision(scenario.id);
      expect(linkedRev).not.toBeNull();
      expect(linkedRev?.id).toBe("offer-rev-abc");
      expect(linkedRev?.rateSpec.amount).toBe(28000);
    });
  });

  describe("SupabaseRestRunwayStore REST integration", () => {
    it("calls Supabase REST endpoints for scenario and category cut CRUD", async () => {
      const mockScenarioRow: RunwayScenarioRow = {
        id: "scen-rest-1",
        name: "Rest Scenario",
        is_primary: true,
        posture: "active",
        regime: "b2b_ryczalt",
        zus_stage: "pelny_zus",
        voluntary_sickness: true,
        ryczalt_ytd_health_tier: "tier2",
        pfron_rebate_json: DEFAULT_JDG_RUNWAY_CONFIG.pfronRebate,
        monthly_accounting_cost_pln: 250,
        suspended_accounting_cost_pln: 50,
        voluntary_nfz_when_suspended: false,
        statutory_voluntary_nfz_pln: 700,
        wakacje_month_index: 12,
        include_month1_tax_tail: true,
        month1_vat7_pln: 0,
        month1_ppe_pln: 0,
        benefit_loss_replacement_pln: 0,
        residual_monthly_income_pln: 0,
        capital_pool_config_json: DEFAULT_CAPITAL_POOL_CONFIG,
        baseline_offer_revision_id: null,
        lookback_window: "3m",
        active_preset_id: "preset-normal",
        custom_presets_json: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockCutRow: RunwayCategoryCutRow = {
        id: "cut-1",
        scenario_id: "scen-rest-1",
        category_id: "cat-dining",
        retention_pct: 40,
        is_included: true,
      };

      const fetchMock = vi.fn().mockImplementation((url: string, _opts?: RequestInit) => {
        if (url.includes("/runway_scenarios?select=")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [mockScenarioRow],
          });
        }
        if (url.includes("/runway_category_cuts?select=*")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [mockCutRow],
          });
        }
        if (url.includes("/runway_scenarios?id=eq.scen-rest-1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [mockScenarioRow],
          });
        }
        if (url.includes("/runway_category_cuts?scenario_id=eq.scen-rest-1")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [mockCutRow],
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      });

      globalThis.fetch = fetchMock;

      const store = new SupabaseRestRunwayStore("https://example.supabase.co", "service-key");
      const list = await store.list();

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("scen-rest-1");
      expect(list[0].categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 40 });

      const item = await store.get("scen-rest-1");
      expect(item?.id).toBe("scen-rest-1");
      expect(item?.categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 40 });
    });
  });
});
