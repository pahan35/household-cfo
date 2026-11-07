import "server-only";

import {
  DEFAULT_HOME_GOAL_TRACKING_CONFIG,
  DEFAULT_MORTGAGE_FINANCING_CONFIG,
  DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
  DEFAULT_OVERLAP_TIMELINE_CONFIG,
  DEFAULT_PROPERTY_ACQUISITION_CONFIG,
} from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-engine";
import type {
  InstallmentType,
  LookbackWindow,
  MortgageFinancingConfig,
  MortgageScenario,
  MortgageSimulatorConfig,
  OverlapTimelineConfig,
  PropertyAcquisitionConfig,
  PropertyPricingMode,
  RenovationFundingMode,
} from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-types";

export type { MortgageScenario };

export interface MortgageScenarioRow {
  id: string;
  name: string;
  is_primary: boolean;
  pricing_mode: string;
  area_sqm: number | string;
  price_per_sqm_pln: number | string;
  custom_total_price_pln: number | string;
  include_parking: boolean;
  parking_price_pln: number | string;
  include_storage: boolean;
  storage_price_pln: number | string;
  renovation_budget_pln: number | string;
  renovation_contingency_pct: number | string;
  renovation_funding_mode: string;
  bank_valuation_fee_pln: number | string;
  custom_notary_fee_pln: number | string | null;
  down_payment_pct: number | string;
  loan_term_years: number | string;
  reference_rate_pct: number | string;
  bank_margin_pct: number | string;
  rate_stress_delta_pct: number | string;
  installment_type: string;
  months_to_signing: number | string;
  construction_wait_months: number | string;
  finishing_overlap_months: number | string;
  current_monthly_rent_pln: number | string;
  new_community_admin_fee_pln: number | string;
  avg_tranche_drawn_pct: number | string;
  linked_goal_category_ids: string[];
  custom_monthly_net_income_fallback_pln: number | string | null;
  lookback_window: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMortgageScenarioInput {
  id?: string;
  name?: string;
  isPrimary?: boolean;
  config?: Partial<MortgageSimulatorConfig>;
}

export interface UpdateMortgageScenarioInput {
  name?: string;
  isPrimary?: boolean;
  config?: Partial<MortgageSimulatorConfig>;
}

export interface MortgageStore {
  list(): Promise<MortgageScenario[]>;
  get(id: string): Promise<MortgageScenario | null>;
  create(input: CreateMortgageScenarioInput): Promise<MortgageScenario>;
  update(id: string, updates: UpdateMortgageScenarioInput): Promise<MortgageScenario>;
  delete(id: string): Promise<boolean>;
  setPrimary(id: string): Promise<MortgageScenario>;
  duplicate(id: string, newName?: string): Promise<MortgageScenario>;
}

export function rowToScenario(row: MortgageScenarioRow): MortgageScenario {
  const num = (v: number | string | null | undefined, fallback: number): number => {
    if (v === null || v === undefined) return fallback;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const property: PropertyAcquisitionConfig = {
    pricingMode: row.pricing_mode === "total_price" ? ("total_price" as PropertyPricingMode) : "area_and_price_per_sqm",
    areaSqm: num(row.area_sqm, DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm),
    pricePerSqmPln: num(row.price_per_sqm_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.pricePerSqmPln),
    customTotalPricePln: num(row.custom_total_price_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.customTotalPricePln),
    includeParking: Boolean(row.include_parking),
    parkingPricePln: num(row.parking_price_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.parkingPricePln),
    includeStorage: Boolean(row.include_storage),
    storagePricePln: num(row.storage_price_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.storagePricePln),
    renovationBudgetPln: num(row.renovation_budget_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.renovationBudgetPln),
    renovationContingencyPct: num(
      row.renovation_contingency_pct,
      DEFAULT_PROPERTY_ACQUISITION_CONFIG.renovationContingencyPct,
    ),
    renovationFundingMode: row.renovation_funding_mode === "mortgage" ? ("mortgage" as RenovationFundingMode) : "cash",
    bankValuationFeePln: num(row.bank_valuation_fee_pln, DEFAULT_PROPERTY_ACQUISITION_CONFIG.bankValuationFeePln),
    customNotaryFeePln:
      row.custom_notary_fee_pln !== null && row.custom_notary_fee_pln !== undefined
        ? num(row.custom_notary_fee_pln, 0)
        : undefined,
  };

  const financing: MortgageFinancingConfig = {
    downPaymentPct: num(row.down_payment_pct, DEFAULT_MORTGAGE_FINANCING_CONFIG.downPaymentPct),
    loanTermYears: num(row.loan_term_years, DEFAULT_MORTGAGE_FINANCING_CONFIG.loanTermYears),
    referenceRatePct: num(row.reference_rate_pct, DEFAULT_MORTGAGE_FINANCING_CONFIG.referenceRatePct),
    bankMarginPct: num(row.bank_margin_pct, DEFAULT_MORTGAGE_FINANCING_CONFIG.bankMarginPct),
    rateStressDeltaPct: num(row.rate_stress_delta_pct, DEFAULT_MORTGAGE_FINANCING_CONFIG.rateStressDeltaPct),
    installmentType:
      row.installment_type === "decreasing" ? ("decreasing" as InstallmentType) : ("equal" as InstallmentType),
  };

  const overlap: OverlapTimelineConfig = {
    monthsToSigning: num(row.months_to_signing, DEFAULT_OVERLAP_TIMELINE_CONFIG.monthsToSigning),
    constructionWaitMonths: num(row.construction_wait_months, DEFAULT_OVERLAP_TIMELINE_CONFIG.constructionWaitMonths),
    finishingOverlapMonths: num(row.finishing_overlap_months, DEFAULT_OVERLAP_TIMELINE_CONFIG.finishingOverlapMonths),
    currentMonthlyRentPln: num(row.current_monthly_rent_pln, DEFAULT_OVERLAP_TIMELINE_CONFIG.currentMonthlyRentPln),
    newCommunityAdminFeePln: num(
      row.new_community_admin_fee_pln,
      DEFAULT_OVERLAP_TIMELINE_CONFIG.newCommunityAdminFeePln,
    ),
    averageTrancheDrawnPctDuringConstruction: num(
      row.avg_tranche_drawn_pct,
      DEFAULT_OVERLAP_TIMELINE_CONFIG.averageTrancheDrawnPctDuringConstruction,
    ),
  };

  const validWindows: LookbackWindow[] = ["3m", "6m", "12m", "all"];
  const lookbackWindow: LookbackWindow = validWindows.includes(row.lookback_window as LookbackWindow)
    ? (row.lookback_window as LookbackWindow)
    : DEFAULT_HOME_GOAL_TRACKING_CONFIG.lookbackWindow;

  const goalTracking = {
    linkedGoalCategoryIds: Array.isArray(row.linked_goal_category_ids) ? [...row.linked_goal_category_ids] : [],
    customMonthlyNetIncomeFallbackPln:
      row.custom_monthly_net_income_fallback_pln !== null && row.custom_monthly_net_income_fallback_pln !== undefined
        ? num(row.custom_monthly_net_income_fallback_pln, 0)
        : undefined,
    lookbackWindow,
  };

  return {
    id: row.id,
    name: row.name || "Primary Plan",
    isPrimary: Boolean(row.is_primary),
    config: {
      property,
      financing,
      overlap,
      goalTracking,
    },
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function scenarioToRow(
  input: {
    id?: string;
    name?: string;
    isPrimary?: boolean;
    config?: Partial<MortgageSimulatorConfig>;
  },
  existing?: MortgageScenario,
): Partial<MortgageScenarioRow> {
  const mergedConfig: MortgageSimulatorConfig = {
    property: {
      ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
      ...existing?.config.property,
      ...input.config?.property,
    },
    financing: {
      ...DEFAULT_MORTGAGE_FINANCING_CONFIG,
      ...existing?.config.financing,
      ...input.config?.financing,
    },
    overlap: {
      ...DEFAULT_OVERLAP_TIMELINE_CONFIG,
      ...existing?.config.overlap,
      ...input.config?.overlap,
    },
    goalTracking: {
      ...DEFAULT_HOME_GOAL_TRACKING_CONFIG,
      ...existing?.config.goalTracking,
      ...input.config?.goalTracking,
    },
  };

  const row: Partial<MortgageScenarioRow> = {
    updated_at: new Date().toISOString(),
  };

  if (input.id) row.id = input.id;
  if (input.name !== undefined) row.name = input.name;
  if (input.isPrimary !== undefined) row.is_primary = input.isPrimary;

  if (input.config || !existing) {
    row.pricing_mode = mergedConfig.property.pricingMode;
    row.area_sqm = mergedConfig.property.areaSqm;
    row.price_per_sqm_pln = mergedConfig.property.pricePerSqmPln;
    row.custom_total_price_pln = mergedConfig.property.customTotalPricePln;
    row.include_parking = mergedConfig.property.includeParking;
    row.parking_price_pln = mergedConfig.property.parkingPricePln;
    row.include_storage = mergedConfig.property.includeStorage;
    row.storage_price_pln = mergedConfig.property.storagePricePln;
    row.renovation_budget_pln = mergedConfig.property.renovationBudgetPln;
    row.renovation_contingency_pct = mergedConfig.property.renovationContingencyPct;
    row.renovation_funding_mode = mergedConfig.property.renovationFundingMode;
    row.bank_valuation_fee_pln = mergedConfig.property.bankValuationFeePln;
    row.custom_notary_fee_pln = mergedConfig.property.customNotaryFeePln ?? null;

    row.down_payment_pct = mergedConfig.financing.downPaymentPct;
    row.loan_term_years = mergedConfig.financing.loanTermYears;
    row.reference_rate_pct = mergedConfig.financing.referenceRatePct;
    row.bank_margin_pct = mergedConfig.financing.bankMarginPct;
    row.rate_stress_delta_pct = mergedConfig.financing.rateStressDeltaPct;
    row.installment_type = mergedConfig.financing.installmentType;

    row.months_to_signing = mergedConfig.overlap.monthsToSigning;
    row.construction_wait_months = mergedConfig.overlap.constructionWaitMonths;
    row.finishing_overlap_months = mergedConfig.overlap.finishingOverlapMonths;
    row.current_monthly_rent_pln = mergedConfig.overlap.currentMonthlyRentPln;
    row.new_community_admin_fee_pln = mergedConfig.overlap.newCommunityAdminFeePln;
    row.avg_tranche_drawn_pct = mergedConfig.overlap.averageTrancheDrawnPctDuringConstruction;

    row.linked_goal_category_ids = [...mergedConfig.goalTracking.linkedGoalCategoryIds];
    row.custom_monthly_net_income_fallback_pln = mergedConfig.goalTracking.customMonthlyNetIncomeFallbackPln ?? null;
    row.lookback_window = mergedConfig.goalTracking.lookbackWindow;
  }

  return row;
}

export class InMemoryMortgageStore implements MortgageStore {
  private scenarios = new Map<string, MortgageScenario>();

  constructor(initialScenarios?: MortgageScenario[]) {
    if (initialScenarios) {
      for (const s of initialScenarios) {
        this.scenarios.set(s.id, { ...s });
      }
    }
  }

  async list(): Promise<MortgageScenario[]> {
    const list = Array.from(this.scenarios.values());
    list.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list.map((s) => ({ ...s, config: structuredClone(s.config) }));
  }

  async get(id: string): Promise<MortgageScenario | null> {
    const found = this.scenarios.get(id);
    if (!found) return null;
    return { ...found, config: structuredClone(found.config) };
  }

  async create(input: CreateMortgageScenarioInput): Promise<MortgageScenario> {
    const id =
      input.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `scen-${Date.now()}`);
    const isFirst = this.scenarios.size === 0;
    const isPrimary = input.isPrimary ?? isFirst;

    if (isPrimary) {
      for (const [key, existing] of this.scenarios.entries()) {
        if (existing.isPrimary) {
          this.scenarios.set(key, { ...existing, isPrimary: false, updatedAt: new Date().toISOString() });
        }
      }
    }

    const scenario: MortgageScenario = {
      id,
      name: input.name?.trim() || "Primary Plan",
      isPrimary,
      config: {
        property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, ...input.config?.property },
        financing: { ...DEFAULT_MORTGAGE_FINANCING_CONFIG, ...input.config?.financing },
        overlap: { ...DEFAULT_OVERLAP_TIMELINE_CONFIG, ...input.config?.overlap },
        goalTracking: {
          ...DEFAULT_HOME_GOAL_TRACKING_CONFIG,
          ...input.config?.goalTracking,
          linkedGoalCategoryIds: [...(input.config?.goalTracking?.linkedGoalCategoryIds ?? [])],
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.scenarios.set(id, scenario);
    return { ...scenario, config: structuredClone(scenario.config) };
  }

  async update(id: string, updates: UpdateMortgageScenarioInput): Promise<MortgageScenario> {
    const existing = this.scenarios.get(id);
    if (!existing) {
      throw new Error(`Scenario not found: ${id}`);
    }

    if (updates.isPrimary) {
      for (const [key, s] of this.scenarios.entries()) {
        if (key !== id && s.isPrimary) {
          this.scenarios.set(key, { ...s, isPrimary: false, updatedAt: new Date().toISOString() });
        }
      }
    }

    const updated: MortgageScenario = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      isPrimary: updates.isPrimary ?? existing.isPrimary,
      config: {
        property: { ...existing.config.property, ...updates.config?.property },
        financing: { ...existing.config.financing, ...updates.config?.financing },
        overlap: { ...existing.config.overlap, ...updates.config?.overlap },
        goalTracking: {
          ...existing.config.goalTracking,
          ...updates.config?.goalTracking,
          linkedGoalCategoryIds: updates.config?.goalTracking?.linkedGoalCategoryIds
            ? [...updates.config.goalTracking.linkedGoalCategoryIds]
            : existing.config.goalTracking.linkedGoalCategoryIds,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    this.scenarios.set(id, updated);
    return { ...updated, config: structuredClone(updated.config) };
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.scenarios.get(id);
    if (!existing) return false;

    this.scenarios.delete(id);

    // If deleted scenario was primary and other scenarios exist, designate the first remaining as primary
    if (existing.isPrimary && this.scenarios.size > 0) {
      const remaining = Array.from(this.scenarios.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      const newPrimary = remaining[0];
      this.scenarios.set(newPrimary.id, {
        ...newPrimary,
        isPrimary: true,
        updatedAt: new Date().toISOString(),
      });
    }

    return true;
  }

  async setPrimary(id: string): Promise<MortgageScenario> {
    const target = this.scenarios.get(id);
    if (!target) {
      throw new Error(`Scenario not found: ${id}`);
    }

    for (const [key, s] of this.scenarios.entries()) {
      if (s.isPrimary && key !== id) {
        this.scenarios.set(key, { ...s, isPrimary: false, updatedAt: new Date().toISOString() });
      }
    }

    const updated: MortgageScenario = {
      ...target,
      isPrimary: true,
      updatedAt: new Date().toISOString(),
    };
    this.scenarios.set(id, updated);
    return { ...updated, config: structuredClone(updated.config) };
  }

  async duplicate(id: string, newName?: string): Promise<MortgageScenario> {
    const source = this.scenarios.get(id);
    if (!source) {
      throw new Error(`Scenario not found: ${id}`);
    }

    return this.create({
      name: newName ?? `${source.name} (Copy)`,
      isPrimary: false,
      config: structuredClone(source.config),
    });
  }
}

export class SupabaseRestMortgageStore implements MortgageStore {
  private url: string;
  private key: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.url = supabaseUrl.replace(/\/+$/, "");
    this.key = serviceRoleKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: this.key,
        ...(!this.key.startsWith("sb_") ? { Authorization: `Bearer ${this.key}` } : {}),
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase REST error (${res.status} ${res.statusText}): ${text}`);
    }

    if (res.status === 204) {
      return null as T;
    }
    return (await res.json()) as T;
  }

  async list(): Promise<MortgageScenario[]> {
    const rows = await this.request<MortgageScenarioRow[]>(
      "/mortgage_scenarios?select=*&order=is_primary.desc,updated_at.desc",
    );
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(rowToScenario);
  }

  async get(id: string): Promise<MortgageScenario | null> {
    const rows = await this.request<MortgageScenarioRow[]>(
      `/mortgage_scenarios?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const row = rows?.[0];
    if (!row) return null;
    return rowToScenario(row);
  }

  async create(input: CreateMortgageScenarioInput): Promise<MortgageScenario> {
    const existing = await this.list();
    const isFirst = existing.length === 0;
    const isPrimary = input.isPrimary ?? isFirst;

    if (isPrimary && existing.length > 0) {
      // Unset previous primary scenarios
      await this.request("/mortgage_scenarios?is_primary=eq.true", {
        method: "PATCH",
        body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
      });
    }

    const rowPayload = scenarioToRow({
      id: input.id,
      name: input.name?.trim() || "Primary Plan",
      isPrimary,
      config: input.config ?? DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
    });

    const rows = await this.request<MortgageScenarioRow[]>("/mortgage_scenarios", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([rowPayload]),
    });

    const created = rows?.[0];
    if (!created) {
      throw new Error("Failed to create mortgage scenario in Supabase");
    }

    return rowToScenario(created);
  }

  async update(id: string, updates: UpdateMortgageScenarioInput): Promise<MortgageScenario> {
    const current = await this.get(id);
    if (!current) {
      throw new Error(`Scenario not found: ${id}`);
    }

    if (updates.isPrimary) {
      await this.request(`/mortgage_scenarios?id=neq.${encodeURIComponent(id)}&is_primary=eq.true`, {
        method: "PATCH",
        body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
      });
    }

    const rowPayload = scenarioToRow(updates, current);

    const rows = await this.request<MortgageScenarioRow[]>(`/mortgage_scenarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(rowPayload),
    });

    const updated = rows?.[0];
    if (!updated) {
      throw new Error(`Failed to update mortgage scenario: ${id}`);
    }

    return rowToScenario(updated);
  }

  async delete(id: string): Promise<boolean> {
    const current = await this.get(id);
    if (!current) return false;

    await this.request(`/mortgage_scenarios?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (current.isPrimary) {
      const remaining = await this.list();
      if (remaining.length > 0) {
        await this.setPrimary(remaining[0].id);
      }
    }

    return true;
  }

  async setPrimary(id: string): Promise<MortgageScenario> {
    // Unset all other primary
    await this.request(`/mortgage_scenarios?id=neq.${encodeURIComponent(id)}&is_primary=eq.true`, {
      method: "PATCH",
      body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
    });

    // Set target primary
    const rows = await this.request<MortgageScenarioRow[]>(`/mortgage_scenarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ is_primary: true, updated_at: new Date().toISOString() }),
    });

    const updated = rows?.[0];
    if (!updated) {
      throw new Error(`Failed to set scenario primary: ${id}`);
    }

    return rowToScenario(updated);
  }

  async duplicate(id: string, newName?: string): Promise<MortgageScenario> {
    const source = await this.get(id);
    if (!source) {
      throw new Error(`Scenario not found: ${id}`);
    }

    return this.create({
      name: newName ?? `${source.name} (Copy)`,
      isPrimary: false,
      config: source.config,
    });
  }
}

let activeMortgageStore: MortgageStore | null = null;

export function getMortgageStore(): MortgageStore {
  if (activeMortgageStore) {
    return activeMortgageStore;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    activeMortgageStore = new SupabaseRestMortgageStore(supabaseUrl, serviceRoleKey);
  } else {
    activeMortgageStore = new InMemoryMortgageStore();
  }

  return activeMortgageStore;
}

export function setTestMortgageStore(store: MortgageStore | null): void {
  activeMortgageStore = store;
}
