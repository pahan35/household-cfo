import "server-only";

import type {
  OfferRevision,
  ZusStage,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import {
  DEFAULT_CAPITAL_POOL_CONFIG,
  DEFAULT_JDG_RUNWAY_CONFIG,
} from "@/app/(main)/dashboard/family-budget/runway/_components/runway-engine";
import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgPosture,
  JdgRunwayConfig,
  JdgTaxRegime,
  LookbackWindow,
  RunwayScenario,
  RyczaltYtdHealthTier,
} from "@/app/(main)/dashboard/family-budget/runway/_components/runway-types";
import { getOfferStore, type OfferRevisionRow, revisionRowToDomain } from "@/server/offers/db";

export type { RunwayScenario };

export interface RunwayScenarioRow {
  id: string;
  name: string;
  is_primary: boolean;
  posture: string;
  regime: string;
  zus_stage: string;
  voluntary_sickness: boolean;
  ryczalt_ytd_health_tier: string;
  pfron_rebate_json: unknown;
  monthly_accounting_cost_pln: number | string;
  suspended_accounting_cost_pln: number | string;
  voluntary_nfz_when_suspended: boolean;
  statutory_voluntary_nfz_pln: number | string;
  wakacje_month_index: number | string;
  include_month1_tax_tail: boolean;
  month1_vat7_pln: number | string;
  month1_ppe_pln: number | string;
  benefit_loss_replacement_pln: number | string;
  residual_monthly_income_pln: number | string;
  capital_pool_config_json: unknown;
  baseline_offer_revision_id: string | null;
  lookback_window: string;
  active_preset_id: string;
  custom_presets_json: unknown;
  created_at: string;
  updated_at: string;
}

export interface RunwayCategoryCutRow {
  id?: string;
  scenario_id: string;
  category_id: string;
  retention_pct: number | string;
  is_included: boolean;
  created_at?: string;
}

export interface CreateRunwayScenarioInput {
  id?: string;
  name?: string;
  isPrimary?: boolean;
  jdgConfig?: Partial<JdgRunwayConfig>;
  capitalPoolConfig?: Partial<CapitalPoolConfig>;
  lookbackWindow?: LookbackWindow;
  activePresetId?: string;
  customPresets?: AusterityPreset[];
  categoryCuts?: Record<string, CategoryAusterityWeight>;
  baselineOfferRevisionId?: string | null;
}

export interface UpdateRunwayScenarioInput {
  name?: string;
  isPrimary?: boolean;
  jdgConfig?: Partial<JdgRunwayConfig>;
  capitalPoolConfig?: Partial<CapitalPoolConfig>;
  lookbackWindow?: LookbackWindow;
  activePresetId?: string;
  customPresets?: AusterityPreset[];
  categoryCuts?: Record<string, CategoryAusterityWeight>;
  baselineOfferRevisionId?: string | null;
}

export interface RunwayStore {
  list(): Promise<RunwayScenario[]>;
  get(id: string): Promise<RunwayScenario | null>;
  create(input: CreateRunwayScenarioInput): Promise<RunwayScenario>;
  update(id: string, updates: UpdateRunwayScenarioInput): Promise<RunwayScenario>;
  delete(id: string): Promise<boolean>;
  setPrimary(id: string): Promise<RunwayScenario>;
  duplicate(id: string, newName?: string): Promise<RunwayScenario>;
  getLinkedOfferRevision(scenarioId: string): Promise<OfferRevision | null>;
}

export function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val as T;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function num(v: number | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function rowToScenario(row: RunwayScenarioRow, cuts: RunwayCategoryCutRow[] = []): RunwayScenario {
  const pfronRebate = parseJsonSafe(row.pfron_rebate_json, DEFAULT_JDG_RUNWAY_CONFIG.pfronRebate);
  const capitalPoolConfig = parseJsonSafe(row.capital_pool_config_json, DEFAULT_CAPITAL_POOL_CONFIG);
  const customPresets = parseJsonSafe<AusterityPreset[]>(row.custom_presets_json, []);

  const categoryCuts: Record<string, CategoryAusterityWeight> = {};
  for (const cut of cuts) {
    if (cut.category_id) {
      categoryCuts[cut.category_id] = {
        enabled: Boolean(cut.is_included),
        retentionPct: num(cut.retention_pct, 100),
      };
    }
  }

  const jdgConfig: JdgRunwayConfig = {
    posture: (row.posture as JdgPosture) || DEFAULT_JDG_RUNWAY_CONFIG.posture,
    regime: (row.regime as JdgTaxRegime) || DEFAULT_JDG_RUNWAY_CONFIG.regime,
    zusStage: (row.zus_stage as ZusStage) || DEFAULT_JDG_RUNWAY_CONFIG.zusStage,
    voluntarySickness: Boolean(row.voluntary_sickness),
    ryczaltYtdHealthTier:
      (row.ryczalt_ytd_health_tier as RyczaltYtdHealthTier) || DEFAULT_JDG_RUNWAY_CONFIG.ryczaltYtdHealthTier,
    pfronRebate,
    monthlyAccountingCostPln: num(row.monthly_accounting_cost_pln, DEFAULT_JDG_RUNWAY_CONFIG.monthlyAccountingCostPln),
    suspendedAccountingCostPln: num(
      row.suspended_accounting_cost_pln,
      DEFAULT_JDG_RUNWAY_CONFIG.suspendedAccountingCostPln,
    ),
    voluntaryNfzWhenSuspended: Boolean(row.voluntary_nfz_when_suspended),
    statutoryVoluntaryNfzPln: num(row.statutory_voluntary_nfz_pln, DEFAULT_JDG_RUNWAY_CONFIG.statutoryVoluntaryNfzPln),
    wakacjeMonthIndex: num(row.wakacje_month_index, DEFAULT_JDG_RUNWAY_CONFIG.wakacjeMonthIndex),
    includeMonth1TaxTail: Boolean(row.include_month1_tax_tail),
    month1Vat7Pln: num(row.month1_vat7_pln, 0),
    month1PpePln: num(row.month1_ppe_pln, 0),
    benefitLossReplacementPln: num(row.benefit_loss_replacement_pln, 0),
    residualMonthlyIncomePln: num(row.residual_monthly_income_pln, 0),
  };

  return {
    id: row.id,
    name: row.name || "Baseline Austerity",
    isPrimary: Boolean(row.is_primary),
    jdgConfig,
    capitalPoolConfig,
    lookbackWindow: (row.lookback_window as LookbackWindow) || "3m",
    activePresetId: row.active_preset_id || "preset-normal",
    customPresets,
    categoryCuts,
    baselineOfferRevisionId: row.baseline_offer_revision_id ?? null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function scenarioToRow(
  scenario: Partial<Omit<RunwayScenario, "jdgConfig">> & { jdgConfig?: Partial<JdgRunwayConfig> },
): Partial<RunwayScenarioRow> {
  const row: Partial<RunwayScenarioRow> = {};

  if (scenario.id !== undefined) row.id = scenario.id;
  if (scenario.name !== undefined) row.name = scenario.name;
  if (scenario.isPrimary !== undefined) row.is_primary = scenario.isPrimary;

  if (scenario.jdgConfig) {
    const c = scenario.jdgConfig;
    if (c.posture !== undefined) row.posture = c.posture;
    if (c.regime !== undefined) row.regime = c.regime;
    if (c.zusStage !== undefined) row.zus_stage = c.zusStage;
    if (c.voluntarySickness !== undefined) row.voluntary_sickness = c.voluntarySickness;
    if (c.ryczaltYtdHealthTier !== undefined) row.ryczalt_ytd_health_tier = c.ryczaltYtdHealthTier;
    if (c.pfronRebate !== undefined) row.pfron_rebate_json = c.pfronRebate;
    if (c.monthlyAccountingCostPln !== undefined) row.monthly_accounting_cost_pln = c.monthlyAccountingCostPln;
    if (c.suspendedAccountingCostPln !== undefined) row.suspended_accounting_cost_pln = c.suspendedAccountingCostPln;
    if (c.voluntaryNfzWhenSuspended !== undefined) row.voluntary_nfz_when_suspended = c.voluntaryNfzWhenSuspended;
    if (c.statutoryVoluntaryNfzPln !== undefined) row.statutory_voluntary_nfz_pln = c.statutoryVoluntaryNfzPln;
    if (c.wakacjeMonthIndex !== undefined) row.wakacje_month_index = c.wakacjeMonthIndex;
    if (c.includeMonth1TaxTail !== undefined) row.include_month1_tax_tail = c.includeMonth1TaxTail;
    if (c.month1Vat7Pln !== undefined) row.month1_vat7_pln = c.month1Vat7Pln;
    if (c.month1PpePln !== undefined) row.month1_ppe_pln = c.month1PpePln;
    if (c.benefitLossReplacementPln !== undefined) row.benefit_loss_replacement_pln = c.benefitLossReplacementPln;
    if (c.residualMonthlyIncomePln !== undefined) row.residual_monthly_income_pln = c.residualMonthlyIncomePln;
  }

  if (scenario.capitalPoolConfig !== undefined) {
    row.capital_pool_config_json = scenario.capitalPoolConfig;
  }

  if (scenario.lookbackWindow !== undefined) {
    row.lookback_window = scenario.lookbackWindow;
  }

  if (scenario.activePresetId !== undefined) {
    row.active_preset_id = scenario.activePresetId;
  }

  if (scenario.customPresets !== undefined) {
    row.custom_presets_json = scenario.customPresets;
  }

  if (scenario.baselineOfferRevisionId !== undefined) {
    row.baseline_offer_revision_id = scenario.baselineOfferRevisionId;
  }

  if (scenario.updatedAt !== undefined) {
    row.updated_at = scenario.updatedAt;
  }

  return row;
}

export class InMemoryRunwayStore implements RunwayStore {
  private scenarios = new Map<string, RunwayScenario>();
  private cuts = new Map<string, RunwayCategoryCutRow[]>(); // scenario_id -> cuts
  private mockOfferRevisions = new Map<string, OfferRevision>();

  constructor(initialScenarios: RunwayScenario[] = []) {
    for (const s of initialScenarios) {
      this.scenarios.set(s.id, structuredClone(s));
      const cutRows: RunwayCategoryCutRow[] = Object.entries(s.categoryCuts).map(([categoryId, weight]) => ({
        scenario_id: s.id,
        category_id: categoryId,
        retention_pct: weight.retentionPct,
        is_included: weight.enabled,
      }));
      this.cuts.set(s.id, cutRows);
    }
  }

  public setMockOfferRevision(revision: OfferRevision): void {
    this.mockOfferRevisions.set(revision.id, revision);
  }

  async list(): Promise<RunwayScenario[]> {
    const list = Array.from(this.scenarios.values());
    list.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list.map((s) => structuredClone(s));
  }

  async get(id: string): Promise<RunwayScenario | null> {
    const found = this.scenarios.get(id);
    if (!found) return null;
    return structuredClone(found);
  }

  async create(input: CreateRunwayScenarioInput): Promise<RunwayScenario> {
    const id =
      input.id ??
      (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `runway-scen-${Date.now()}`);

    const isFirst = this.scenarios.size === 0;
    const isPrimary = input.isPrimary ?? isFirst;

    if (isPrimary) {
      for (const [key, existing] of this.scenarios.entries()) {
        if (existing.isPrimary) {
          this.scenarios.set(key, {
            ...existing,
            isPrimary: false,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const categoryCuts = { ...(input.categoryCuts ?? {}) };

    const scenario: RunwayScenario = {
      id,
      name: input.name?.trim() || "Baseline Austerity",
      isPrimary,
      jdgConfig: {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        ...input.jdgConfig,
      },
      capitalPoolConfig: {
        ...DEFAULT_CAPITAL_POOL_CONFIG,
        ...input.capitalPoolConfig,
      },
      lookbackWindow: input.lookbackWindow ?? "3m",
      activePresetId: input.activePresetId ?? "preset-normal",
      customPresets: input.customPresets ? [...input.customPresets] : [],
      categoryCuts,
      baselineOfferRevisionId: input.baselineOfferRevisionId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.scenarios.set(id, scenario);

    const cutRows: RunwayCategoryCutRow[] = Object.entries(categoryCuts).map(([catId, weight]) => ({
      scenario_id: id,
      category_id: catId,
      retention_pct: weight.retentionPct,
      is_included: weight.enabled,
    }));
    this.cuts.set(id, cutRows);

    return structuredClone(scenario);
  }

  async update(id: string, updates: UpdateRunwayScenarioInput): Promise<RunwayScenario> {
    const existing = this.scenarios.get(id);
    if (!existing) {
      throw new Error(`Runway scenario not found: ${id}`);
    }

    if (updates.isPrimary) {
      for (const [key, s] of this.scenarios.entries()) {
        if (key !== id && s.isPrimary) {
          this.scenarios.set(key, {
            ...s,
            isPrimary: false,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const updatedCategoryCuts = updates.categoryCuts ? { ...updates.categoryCuts } : { ...existing.categoryCuts };

    const updated: RunwayScenario = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      isPrimary: updates.isPrimary ?? existing.isPrimary,
      jdgConfig: {
        ...existing.jdgConfig,
        ...updates.jdgConfig,
      },
      capitalPoolConfig: {
        ...existing.capitalPoolConfig,
        ...updates.capitalPoolConfig,
      },
      lookbackWindow: updates.lookbackWindow ?? existing.lookbackWindow,
      activePresetId: updates.activePresetId ?? existing.activePresetId,
      customPresets: updates.customPresets ? [...updates.customPresets] : [...existing.customPresets],
      categoryCuts: updatedCategoryCuts,
      baselineOfferRevisionId: updates.baselineOfferRevisionId ?? existing.baselineOfferRevisionId,
      updatedAt: new Date().toISOString(),
    };

    this.scenarios.set(id, updated);

    if (updates.categoryCuts !== undefined) {
      const cutRows: RunwayCategoryCutRow[] = Object.entries(updatedCategoryCuts).map(([catId, weight]) => ({
        scenario_id: id,
        category_id: catId,
        retention_pct: weight.retentionPct,
        is_included: weight.enabled,
      }));
      this.cuts.set(id, cutRows);
    }

    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.scenarios.get(id);
    if (!existing) return false;

    this.scenarios.delete(id);
    // Simulate ON DELETE CASCADE
    this.cuts.delete(id);

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

  async setPrimary(id: string): Promise<RunwayScenario> {
    const target = this.scenarios.get(id);
    if (!target) {
      throw new Error(`Runway scenario not found: ${id}`);
    }

    for (const [key, s] of this.scenarios.entries()) {
      if (s.isPrimary && key !== id) {
        this.scenarios.set(key, {
          ...s,
          isPrimary: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const updated: RunwayScenario = {
      ...target,
      isPrimary: true,
      updatedAt: new Date().toISOString(),
    };
    this.scenarios.set(id, updated);
    return structuredClone(updated);
  }

  async duplicate(id: string, newName?: string): Promise<RunwayScenario> {
    const source = this.scenarios.get(id);
    if (!source) {
      throw new Error(`Runway scenario not found: ${id}`);
    }

    return this.create({
      name: newName ?? `${source.name} (Copy)`,
      isPrimary: false,
      jdgConfig: structuredClone(source.jdgConfig),
      capitalPoolConfig: structuredClone(source.capitalPoolConfig),
      lookbackWindow: source.lookbackWindow,
      activePresetId: source.activePresetId,
      customPresets: structuredClone(source.customPresets),
      categoryCuts: structuredClone(source.categoryCuts),
      baselineOfferRevisionId: source.baselineOfferRevisionId,
    });
  }

  async getLinkedOfferRevision(scenarioId: string): Promise<OfferRevision | null> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario?.baselineOfferRevisionId) return null;

    const mock = this.mockOfferRevisions.get(scenario.baselineOfferRevisionId);
    if (mock) {
      return structuredClone(mock);
    }

    try {
      const offerStore = getOfferStore();
      const all = await offerStore.loadAll();
      for (const track of all.tracks) {
        const found = track.revisions.find((r) => r.id === scenario.baselineOfferRevisionId);
        if (found) return structuredClone(found);
      }
    } catch {
      // ignore
    }

    return null;
  }
}

export class SupabaseRestRunwayStore implements RunwayStore {
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

  async list(): Promise<RunwayScenario[]> {
    const [rows, allCuts] = await Promise.all([
      this.request<RunwayScenarioRow[]>("/runway_scenarios?select=*&order=is_primary.desc,updated_at.desc"),
      this.request<RunwayCategoryCutRow[]>("/runway_category_cuts?select=*"),
    ]);

    if (!rows || !Array.isArray(rows)) return [];

    const cutsByScenario = new Map<string, RunwayCategoryCutRow[]>();
    if (Array.isArray(allCuts)) {
      for (const cut of allCuts) {
        const list = cutsByScenario.get(cut.scenario_id) ?? [];
        list.push(cut);
        cutsByScenario.set(cut.scenario_id, list);
      }
    }

    return rows.map((row) => rowToScenario(row, cutsByScenario.get(row.id) ?? []));
  }

  async get(id: string): Promise<RunwayScenario | null> {
    const [rows, cuts] = await Promise.all([
      this.request<RunwayScenarioRow[]>(`/runway_scenarios?id=eq.${encodeURIComponent(id)}&select=*`),
      this.request<RunwayCategoryCutRow[]>(`/runway_category_cuts?scenario_id=eq.${encodeURIComponent(id)}&select=*`),
    ]);

    const row = rows?.[0];
    if (!row) return null;
    return rowToScenario(row, cuts ?? []);
  }

  async create(input: CreateRunwayScenarioInput): Promise<RunwayScenario> {
    const existing = await this.list();
    const isFirst = existing.length === 0;
    const isPrimary = input.isPrimary ?? isFirst;

    if (isPrimary && existing.length > 0) {
      await this.request("/runway_scenarios?is_primary=eq.true", {
        method: "PATCH",
        body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
      });
    }

    const payload: Partial<RunwayScenarioRow> = {
      ...(input.id ? { id: input.id } : {}),
      name: input.name?.trim() || "Baseline Austerity",
      is_primary: isPrimary,
      posture: input.jdgConfig?.posture ?? DEFAULT_JDG_RUNWAY_CONFIG.posture,
      regime: input.jdgConfig?.regime ?? DEFAULT_JDG_RUNWAY_CONFIG.regime,
      zus_stage: input.jdgConfig?.zusStage ?? DEFAULT_JDG_RUNWAY_CONFIG.zusStage,
      voluntary_sickness: input.jdgConfig?.voluntarySickness ?? DEFAULT_JDG_RUNWAY_CONFIG.voluntarySickness,
      ryczalt_ytd_health_tier: input.jdgConfig?.ryczaltYtdHealthTier ?? DEFAULT_JDG_RUNWAY_CONFIG.ryczaltYtdHealthTier,
      pfron_rebate_json: input.jdgConfig?.pfronRebate ?? DEFAULT_JDG_RUNWAY_CONFIG.pfronRebate,
      monthly_accounting_cost_pln:
        input.jdgConfig?.monthlyAccountingCostPln ?? DEFAULT_JDG_RUNWAY_CONFIG.monthlyAccountingCostPln,
      suspended_accounting_cost_pln:
        input.jdgConfig?.suspendedAccountingCostPln ?? DEFAULT_JDG_RUNWAY_CONFIG.suspendedAccountingCostPln,
      voluntary_nfz_when_suspended:
        input.jdgConfig?.voluntaryNfzWhenSuspended ?? DEFAULT_JDG_RUNWAY_CONFIG.voluntaryNfzWhenSuspended,
      statutory_voluntary_nfz_pln:
        input.jdgConfig?.statutoryVoluntaryNfzPln ?? DEFAULT_JDG_RUNWAY_CONFIG.statutoryVoluntaryNfzPln,
      wakacje_month_index: input.jdgConfig?.wakacjeMonthIndex ?? DEFAULT_JDG_RUNWAY_CONFIG.wakacjeMonthIndex,
      include_month1_tax_tail: input.jdgConfig?.includeMonth1TaxTail ?? DEFAULT_JDG_RUNWAY_CONFIG.includeMonth1TaxTail,
      month1_vat7_pln: input.jdgConfig?.month1Vat7Pln ?? 0,
      month1_ppe_pln: input.jdgConfig?.month1PpePln ?? 0,
      benefit_loss_replacement_pln: input.jdgConfig?.benefitLossReplacementPln ?? 0,
      residual_monthly_income_pln: input.jdgConfig?.residualMonthlyIncomePln ?? 0,
      capital_pool_config_json: {
        ...DEFAULT_CAPITAL_POOL_CONFIG,
        ...input.capitalPoolConfig,
      },
      lookback_window: input.lookbackWindow ?? "3m",
      active_preset_id: input.activePresetId ?? "preset-normal",
      custom_presets_json: input.customPresets ?? [],
      baseline_offer_revision_id: input.baselineOfferRevisionId ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertedRows = await this.request<RunwayScenarioRow[]>("/runway_scenarios", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });

    const created = insertedRows?.[0];
    if (!created) {
      throw new Error("Failed to insert runway scenario into Supabase");
    }

    // Insert category cuts if provided
    let insertedCuts: RunwayCategoryCutRow[] = [];
    if (input.categoryCuts && Object.keys(input.categoryCuts).length > 0) {
      const cutRows = Object.entries(input.categoryCuts).map(([catId, weight]) => ({
        scenario_id: created.id,
        category_id: catId,
        retention_pct: weight.retentionPct,
        is_included: weight.enabled,
      }));

      insertedCuts =
        (await this.request<RunwayCategoryCutRow[]>("/runway_category_cuts", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(cutRows),
        })) ?? [];
    }

    return rowToScenario(created, insertedCuts);
  }

  async update(id: string, updates: UpdateRunwayScenarioInput): Promise<RunwayScenario> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Runway scenario not found: ${id}`);
    }

    if (updates.isPrimary) {
      await this.request(`/runway_scenarios?id=neq.${encodeURIComponent(id)}&is_primary=eq.true`, {
        method: "PATCH",
        body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
      });
    }

    const patchRow = scenarioToRow({
      name: updates.name,
      isPrimary: updates.isPrimary,
      jdgConfig: updates.jdgConfig ? ({ ...existing.jdgConfig, ...updates.jdgConfig } as JdgRunwayConfig) : undefined,
      capitalPoolConfig: updates.capitalPoolConfig
        ? ({ ...existing.capitalPoolConfig, ...updates.capitalPoolConfig } as CapitalPoolConfig)
        : undefined,
      lookbackWindow: updates.lookbackWindow,
      activePresetId: updates.activePresetId,
      customPresets: updates.customPresets,
      baselineOfferRevisionId: updates.baselineOfferRevisionId,
      updatedAt: new Date().toISOString(),
    });

    const updatedRows = await this.request<RunwayScenarioRow[]>(`/runway_scenarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patchRow),
    });

    const updated = updatedRows?.[0];
    if (!updated) {
      throw new Error(`Failed to update runway scenario: ${id}`);
    }

    // Update cuts if provided
    let currentCuts: RunwayCategoryCutRow[] = [];
    if (updates.categoryCuts !== undefined) {
      // Delete existing cuts
      await this.request(`/runway_category_cuts?scenario_id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (Object.keys(updates.categoryCuts).length > 0) {
        const cutRows = Object.entries(updates.categoryCuts).map(([catId, weight]) => ({
          scenario_id: id,
          category_id: catId,
          retention_pct: weight.retentionPct,
          is_included: weight.enabled,
        }));

        currentCuts =
          (await this.request<RunwayCategoryCutRow[]>("/runway_category_cuts", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(cutRows),
          })) ?? [];
      }
    } else {
      currentCuts =
        (await this.request<RunwayCategoryCutRow[]>(
          `/runway_category_cuts?scenario_id=eq.${encodeURIComponent(id)}&select=*`,
        )) ?? [];
    }

    return rowToScenario(updated, currentCuts);
  }

  async delete(id: string): Promise<boolean> {
    const current = await this.get(id);
    if (!current) return false;

    // Foreign key constraint handles cascading category cuts deletion
    await this.request(`/runway_scenarios?id=eq.${encodeURIComponent(id)}`, {
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

  async setPrimary(id: string): Promise<RunwayScenario> {
    await this.request(`/runway_scenarios?id=neq.${encodeURIComponent(id)}&is_primary=eq.true`, {
      method: "PATCH",
      body: JSON.stringify({ is_primary: false, updated_at: new Date().toISOString() }),
    });

    const rows = await this.request<RunwayScenarioRow[]>(`/runway_scenarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ is_primary: true, updated_at: new Date().toISOString() }),
    });

    const updated = rows?.[0];
    if (!updated) {
      throw new Error(`Failed to set runway scenario primary: ${id}`);
    }

    const cuts =
      (await this.request<RunwayCategoryCutRow[]>(
        `/runway_category_cuts?scenario_id=eq.${encodeURIComponent(id)}&select=*`,
      )) ?? [];

    return rowToScenario(updated, cuts);
  }

  async duplicate(id: string, newName?: string): Promise<RunwayScenario> {
    const source = await this.get(id);
    if (!source) {
      throw new Error(`Runway scenario not found: ${id}`);
    }

    return this.create({
      name: newName ?? `${source.name} (Copy)`,
      isPrimary: false,
      jdgConfig: structuredClone(source.jdgConfig),
      capitalPoolConfig: structuredClone(source.capitalPoolConfig),
      lookbackWindow: source.lookbackWindow,
      activePresetId: source.activePresetId,
      customPresets: structuredClone(source.customPresets),
      categoryCuts: structuredClone(source.categoryCuts),
      baselineOfferRevisionId: source.baselineOfferRevisionId,
    });
  }

  async getLinkedOfferRevision(scenarioId: string): Promise<OfferRevision | null> {
    const scenario = await this.get(scenarioId);
    if (!scenario?.baselineOfferRevisionId) return null;

    try {
      const rows = await this.request<OfferRevisionRow[]>(
        `/offer_revisions?id=eq.${encodeURIComponent(scenario.baselineOfferRevisionId)}&select=*`,
      );
      const row = rows?.[0];
      if (!row) return null;
      return revisionRowToDomain(row);
    } catch {
      return null;
    }
  }
}

let activeRunwayStore: RunwayStore | null = null;

export function getRunwayStore(): RunwayStore {
  if (activeRunwayStore) {
    return activeRunwayStore;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    activeRunwayStore = new SupabaseRestRunwayStore(supabaseUrl, serviceRoleKey);
  } else {
    activeRunwayStore = new InMemoryRunwayStore();
  }

  return activeRunwayStore;
}

export function setTestRunwayStore(store: RunwayStore | null): void {
  activeRunwayStore = store;
}
