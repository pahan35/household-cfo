import "server-only";

import type { ExclusionPreset } from "@/app/(main)/dashboard/family-budget/_components/expense-transforms";

export type { ExclusionPreset };

export const BUILT_IN_PRESET_IDS = {
  ALL_ACTIVITY: "all-activity",
  NET_LIVING: "net-living",
  CONTROLLABLE_EXPENSES: "controllable-expenses",
} as const;

export interface BudgetExclusionPresetRow {
  id: string;
  name: string;
  income_deductions: string[];
  expense_exclusions: string[];
  is_built_in: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PresetStoreData {
  presets: ExclusionPreset[];
  activePresetId: string;
}

export interface PresetStore {
  loadAll(): Promise<PresetStoreData>;
  get(id: string): Promise<ExclusionPreset | null>;
  upsertPreset(preset: ExclusionPreset, makeActive?: boolean): Promise<ExclusionPreset>;
  setActive(id: string): Promise<string>;
  deletePreset(id: string): Promise<boolean>;
  seedIfEmpty(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData>;
  saveAll(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData>;
}

export function presetRowToDomain(row: BudgetExclusionPresetRow): ExclusionPreset {
  return {
    id: row.id,
    name: row.name,
    incomeDeductions: Array.isArray(row.income_deductions) ? row.income_deductions : [],
    expenseExclusions: Array.isArray(row.expense_exclusions) ? row.expense_exclusions : [],
    isBuiltIn: Boolean(row.is_built_in),
  };
}

export function domainToPresetRow(
  preset: ExclusionPreset,
  isActive: boolean,
  sortOrder: number,
): Partial<BudgetExclusionPresetRow> {
  return {
    id: preset.id,
    name: preset.name,
    income_deductions: Array.isArray(preset.incomeDeductions) ? preset.incomeDeductions : [],
    expense_exclusions: Array.isArray(preset.expenseExclusions) ? preset.expenseExclusions : [],
    is_built_in: Boolean(preset.isBuiltIn),
    is_active: isActive,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
}

export class InMemoryPresetStore implements PresetStore {
  private presets = new Map<string, ExclusionPreset>();
  private activePresetId: string = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;
  private sortOrders = new Map<string, number>();

  constructor(initialPresets: ExclusionPreset[] = [], initialActiveId?: string) {
    let order = 0;
    for (const p of initialPresets) {
      this.presets.set(p.id, structuredClone(p));
      this.sortOrders.set(p.id, order++);
    }
    if (initialActiveId) {
      this.activePresetId = initialActiveId;
    }
  }

  async loadAll(): Promise<PresetStoreData> {
    const sorted = Array.from(this.presets.entries())
      .sort(([idA], [idB]) => (this.sortOrders.get(idA) ?? 0) - (this.sortOrders.get(idB) ?? 0))
      .map(([, preset]) => structuredClone(preset));

    return {
      presets: sorted,
      activePresetId: this.activePresetId,
    };
  }

  async get(id: string): Promise<ExclusionPreset | null> {
    const found = this.presets.get(id);
    return found ? structuredClone(found) : null;
  }

  async upsertPreset(preset: ExclusionPreset, makeActive?: boolean): Promise<ExclusionPreset> {
    const clone = structuredClone(preset);
    if (!this.sortOrders.has(clone.id)) {
      this.sortOrders.set(clone.id, this.presets.size);
    }
    this.presets.set(clone.id, clone);

    if (makeActive) {
      this.activePresetId = clone.id;
    }

    return clone;
  }

  async setActive(id: string): Promise<string> {
    if (this.presets.has(id)) {
      this.activePresetId = id;
    }
    return this.activePresetId;
  }

  async deletePreset(id: string): Promise<boolean> {
    const deleted = this.presets.delete(id);
    this.sortOrders.delete(id);
    if (this.activePresetId === id) {
      this.activePresetId = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;
    }
    return deleted;
  }

  async seedIfEmpty(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData> {
    if (this.presets.size === 0) {
      let order = 0;
      for (const p of presets) {
        this.presets.set(p.id, structuredClone(p));
        this.sortOrders.set(p.id, order++);
      }
      if (activePresetId && this.presets.has(activePresetId)) {
        this.activePresetId = activePresetId;
      } else if (this.presets.has(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)) {
        this.activePresetId = BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;
      } else if (presets[0]) {
        this.activePresetId = presets[0].id;
      }
    }
    return this.loadAll();
  }

  async saveAll(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData> {
    this.presets.clear();
    this.sortOrders.clear();
    let order = 0;
    for (const p of presets) {
      this.presets.set(p.id, structuredClone(p));
      this.sortOrders.set(p.id, order++);
    }
    if (activePresetId && this.presets.has(activePresetId)) {
      this.activePresetId = activePresetId;
    }
    return this.loadAll();
  }
}

export class SupabaseRestPresetStore implements PresetStore {
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

  async loadAll(): Promise<PresetStoreData> {
    const rows = await this.request<BudgetExclusionPresetRow[]>(
      "/budget_exclusion_presets?select=*&order=sort_order.asc,created_at.asc",
    );

    if (!rows || !Array.isArray(rows)) {
      return { presets: [], activePresetId: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES };
    }

    const presets = rows.map(presetRowToDomain);
    const activeRow = rows.find((r) => r.is_active);
    const activePresetId =
      activeRow?.id ??
      rows.find((r) => r.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)?.id ??
      rows[0]?.id ??
      BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;

    return { presets, activePresetId };
  }

  async get(id: string): Promise<ExclusionPreset | null> {
    const rows = await this.request<BudgetExclusionPresetRow[]>(
      `/budget_exclusion_presets?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const row = rows?.[0];
    return row ? presetRowToDomain(row) : null;
  }

  async upsertPreset(preset: ExclusionPreset, makeActive?: boolean): Promise<ExclusionPreset> {
    if (makeActive) {
      await this.request("/budget_exclusion_presets?is_active=eq.true", {
        method: "PATCH",
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
      });
    }

    // Determine current sort_order if existing
    let sortOrder = 0;
    const existing = await this.get(preset.id);
    if (!existing) {
      const all = await this.loadAll();
      sortOrder = all.presets.length;
    }

    const payload = domainToPresetRow(preset, Boolean(makeActive), sortOrder);
    if (!existing) {
      payload.created_at = new Date().toISOString();
    }

    const insertedRows = await this.request<BudgetExclusionPresetRow[]>("/budget_exclusion_presets", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    const saved = insertedRows?.[0];
    if (!saved) {
      throw new Error(`Failed to upsert preset: ${preset.id}`);
    }

    return presetRowToDomain(saved);
  }

  async setActive(id: string): Promise<string> {
    await this.request("/budget_exclusion_presets?is_active=eq.true", {
      method: "PATCH",
      body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
    });

    await this.request(`/budget_exclusion_presets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: true, updated_at: new Date().toISOString() }),
    });

    return id;
  }

  async deletePreset(id: string): Promise<boolean> {
    const target = await this.get(id);
    if (!target) return false;

    await this.request(`/budget_exclusion_presets?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    // Check if active preset was deleted
    const all = await this.loadAll();
    const hasActive = all.presets.some((p) => p.id === all.activePresetId);
    if (!hasActive && all.presets.length > 0) {
      const fallbackId =
        all.presets.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)?.id ?? all.presets[0].id;
      await this.setActive(fallbackId);
    }

    return true;
  }

  async seedIfEmpty(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData> {
    const current = await this.loadAll();
    if (current.presets.length > 0) {
      return current;
    }

    return this.saveAll(presets, activePresetId);
  }

  async saveAll(presets: ExclusionPreset[], activePresetId?: string): Promise<PresetStoreData> {
    const chosenActiveId =
      activePresetId ??
      presets.find((p) => p.id === BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES)?.id ??
      presets[0]?.id ??
      BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES;

    const rows = presets.map((preset, index) => ({
      ...domainToPresetRow(preset, preset.id === chosenActiveId, index),
      created_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      await this.request<BudgetExclusionPresetRow[]>("/budget_exclusion_presets", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows),
      });
    }

    return this.loadAll();
  }
}

let activePresetStore: PresetStore | null = null;

export function getPresetStore(): PresetStore {
  if (activePresetStore) {
    return activePresetStore;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    activePresetStore = new SupabaseRestPresetStore(supabaseUrl, serviceRoleKey);
  } else {
    activePresetStore = new InMemoryPresetStore();
  }

  return activePresetStore;
}

export function setTestPresetStore(store: PresetStore | null): void {
  activePresetStore = store;
}
