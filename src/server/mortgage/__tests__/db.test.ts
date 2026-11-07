import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_HOME_GOAL_TRACKING_CONFIG,
  DEFAULT_MORTGAGE_FINANCING_CONFIG,
  DEFAULT_OVERLAP_TIMELINE_CONFIG,
  DEFAULT_PROPERTY_ACQUISITION_CONFIG,
} from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-engine";

import {
  InMemoryMortgageStore,
  type MortgageScenarioRow,
  rowToScenario,
  SupabaseRestMortgageStore,
  scenarioToRow,
} from "../db";

describe("Mortgage Scenario Serialization & Mapping", () => {
  it("converts a full database row to MortgageScenario domain object", () => {
    const mockRow: MortgageScenarioRow = {
      id: "scen-1",
      name: "Mokotów 75m² Developer",
      is_primary: true,
      pricing_mode: "area_and_price_per_sqm",
      area_sqm: "75.50",
      price_per_sqm_pln: "16500.00",
      custom_total_price_pln: "1245750.00",
      include_parking: true,
      parking_price_pln: "50000.00",
      include_storage: false,
      storage_price_pln: "0.00",
      renovation_budget_pln: "180000.00",
      renovation_contingency_pct: "12.00",
      renovation_funding_mode: "mortgage",
      bank_valuation_fee_pln: "600.00",
      custom_notary_fee_pln: "2500.00",
      down_payment_pct: "25.00",
      loan_term_years: "30",
      reference_rate_pct: "5.25",
      bank_margin_pct: "1.90",
      rate_stress_delta_pct: "1.50",
      installment_type: "decreasing",
      months_to_signing: "5",
      construction_wait_months: "12",
      finishing_overlap_months: "4",
      current_monthly_rent_pln: "4000.00",
      new_community_admin_fee_pln: "1100.00",
      avg_tranche_drawn_pct: "60",
      linked_goal_category_ids: ["cat-1", "cat-2"],
      custom_monthly_net_income_fallback_pln: "22000.00",
      lookback_window: "12m",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    const scenario = rowToScenario(mockRow);

    expect(scenario.id).toBe("scen-1");
    expect(scenario.name).toBe("Mokotów 75m² Developer");
    expect(scenario.isPrimary).toBe(true);

    // Property
    expect(scenario.config.property.areaSqm).toBe(75.5);
    expect(scenario.config.property.pricePerSqmPln).toBe(16500);
    expect(scenario.config.property.renovationFundingMode).toBe("mortgage");
    expect(scenario.config.property.customNotaryFeePln).toBe(2500);

    // Financing
    expect(scenario.config.financing.downPaymentPct).toBe(25);
    expect(scenario.config.financing.loanTermYears).toBe(30);
    expect(scenario.config.financing.installmentType).toBe("decreasing");
    expect(scenario.config.financing.rateStressDeltaPct).toBe(1.5);

    // Overlap
    expect(scenario.config.overlap.monthsToSigning).toBe(5);
    expect(scenario.config.overlap.averageTrancheDrawnPctDuringConstruction).toBe(60);

    // Goal Tracking
    expect(scenario.config.goalTracking.linkedGoalCategoryIds).toEqual(["cat-1", "cat-2"]);
    expect(scenario.config.goalTracking.customMonthlyNetIncomeFallbackPln).toBe(22000);
    expect(scenario.config.goalTracking.lookbackWindow).toBe("12m");
  });

  it("handles nulls and fallbacks safely when row has missing fields", () => {
    const sparseRow = {
      id: "scen-empty",
      name: "",
      is_primary: false,
      pricing_mode: "unknown",
      area_sqm: null as unknown as number,
      price_per_sqm_pln: undefined as unknown as number,
      custom_total_price_pln: null as unknown as number,
      include_parking: false,
      parking_price_pln: null as unknown as number,
      include_storage: false,
      storage_price_pln: null as unknown as number,
      renovation_budget_pln: null as unknown as number,
      renovation_contingency_pct: null as unknown as number,
      renovation_funding_mode: "unknown",
      bank_valuation_fee_pln: null as unknown as number,
      custom_notary_fee_pln: null,
      down_payment_pct: null as unknown as number,
      loan_term_years: null as unknown as number,
      reference_rate_pct: null as unknown as number,
      bank_margin_pct: null as unknown as number,
      rate_stress_delta_pct: null as unknown as number,
      installment_type: "unknown",
      months_to_signing: null as unknown as number,
      construction_wait_months: null as unknown as number,
      finishing_overlap_months: null as unknown as number,
      current_monthly_rent_pln: null as unknown as number,
      new_community_admin_fee_pln: null as unknown as number,
      avg_tranche_drawn_pct: null as unknown as number,
      linked_goal_category_ids: null as unknown as string[],
      custom_monthly_net_income_fallback_pln: null,
      lookback_window: "invalid-window",
      created_at: "",
      updated_at: "",
    } as MortgageScenarioRow;

    const scenario = rowToScenario(sparseRow);

    expect(scenario.name).toBe("Primary Plan");
    expect(scenario.config.property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
    expect(scenario.config.financing.downPaymentPct).toBe(DEFAULT_MORTGAGE_FINANCING_CONFIG.downPaymentPct);
    expect(scenario.config.overlap.monthsToSigning).toBe(DEFAULT_OVERLAP_TIMELINE_CONFIG.monthsToSigning);
    expect(scenario.config.goalTracking.lookbackWindow).toBe(DEFAULT_HOME_GOAL_TRACKING_CONFIG.lookbackWindow);
    expect(scenario.config.goalTracking.linkedGoalCategoryIds).toEqual([]);
  });

  it("converts domain input to DB row via scenarioToRow", () => {
    const row = scenarioToRow({
      name: "New Plan",
      isPrimary: true,
      config: {
        property: {
          ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
          areaSqm: 88,
          pricePerSqmPln: 18000,
        },
      },
    });

    expect(row.name).toBe("New Plan");
    expect(row.is_primary).toBe(true);
    expect(row.area_sqm).toBe(88);
    expect(row.price_per_sqm_pln).toBe(18000);
    expect(row.updated_at).toBeDefined();
  });
});

describe("InMemoryMortgageStore CRUD & Primary Designation Logic", () => {
  it("automatically designates first scenario as primary and subsequent as non-primary", async () => {
    const store = new InMemoryMortgageStore();

    const scen1 = await store.create({ name: "First Plan" });
    expect(scen1.isPrimary).toBe(true);

    const scen2 = await store.create({ name: "Second Plan" });
    expect(scen2.isPrimary).toBe(false);

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(scen1.id);
  });

  it("switches primary scenario atomically when setPrimary is called", async () => {
    const store = new InMemoryMortgageStore();
    const scen1 = await store.create({ name: "Plan A" });
    const scen2 = await store.create({ name: "Plan B" });

    expect(scen1.isPrimary).toBe(true);
    expect(scen2.isPrimary).toBe(false);

    const updatedB = await store.setPrimary(scen2.id);
    expect(updatedB.isPrimary).toBe(true);

    const refreshedA = await store.get(scen1.id);
    expect(refreshedA?.isPrimary).toBe(false);

    const list = await store.list();
    expect(list[0].id).toBe(scen2.id);
  });

  it("duplicates an existing scenario with copy name and isPrimary=false", async () => {
    const store = new InMemoryMortgageStore();
    const source = await store.create({
      name: "Mokotów",
      config: {
        property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 72 },
      },
    });

    const copy = await store.duplicate(source.id);
    expect(copy.name).toBe("Mokotów (Copy)");
    expect(copy.isPrimary).toBe(false);
    expect(copy.config.property.areaSqm).toBe(72);
  });

  it("reassigns primary designation when the primary scenario is deleted", async () => {
    const store = new InMemoryMortgageStore();
    const scen1 = await store.create({ name: "Plan 1" });
    const scen2 = await store.create({ name: "Plan 2" });

    expect(scen1.isPrimary).toBe(true);
    await store.delete(scen1.id);

    const remaining = await store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(scen2.id);
    expect(remaining[0].isPrimary).toBe(true);
  });
});

describe("SupabaseRestMortgageStore", () => {
  const mockUrl = "https://example.supabase.co";
  const mockKey = "test-service-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists scenarios ordered by primary and updated_at", async () => {
    const store = new SupabaseRestMortgageStore(mockUrl, mockKey);

    const mockRows: MortgageScenarioRow[] = [
      {
        id: "s1",
        name: "Primary Plan",
        is_primary: true,
        pricing_mode: "area_and_price_per_sqm",
        area_sqm: 65,
        price_per_sqm_pln: 16000,
        custom_total_price_pln: 1040000,
        include_parking: true,
        parking_price_pln: 45000,
        include_storage: true,
        storage_price_pln: 15000,
        renovation_budget_pln: 150000,
        renovation_contingency_pct: 10,
        renovation_funding_mode: "cash",
        bank_valuation_fee_pln: 500,
        custom_notary_fee_pln: null,
        down_payment_pct: 20,
        loan_term_years: 25,
        reference_rate_pct: 5.15,
        bank_margin_pct: 1.85,
        rate_stress_delta_pct: 0,
        installment_type: "equal",
        months_to_signing: 6,
        construction_wait_months: 18,
        finishing_overlap_months: 3,
        current_monthly_rent_pln: 3500,
        new_community_admin_fee_pln: 900,
        avg_tranche_drawn_pct: 50,
        linked_goal_category_ids: [],
        custom_monthly_net_income_fallback_pln: null,
        lookback_window: "6m",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRows,
    });

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("s1");
    expect(list[0].isPrimary).toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/mortgage_scenarios?select=*&order=is_primary.desc,updated_at.desc",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: mockKey,
        }),
      }),
    );
  });
});
