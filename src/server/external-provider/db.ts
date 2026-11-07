import "server-only";

import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
  StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import fs from "node:fs";
import path from "node:path";

export interface ExternalProviderSyncConfig {
  id: string;
  sync_version: number;
  sync_status: "idle" | "syncing" | "reconciling" | "error";
  last_synced_at: string | null;
  last_warm_reconcile_at: string | null;
  last_full_reconcile_at: string | null;
  last_cron_run_at: string | null;
  last_error: string | null;
  watermark_tx_ticks: number;
  hot_pull_months: number;
  auto_poll_interval_minutes: number;
  settings_json: ExternalProviderSettings;
  currencies_json: ExternalProviderCurrency[];
  updated_at: string;
}

export interface ExternalProviderSnapshot {
  syncConfig: ExternalProviderSyncConfig;
  settings: ExternalProviderSettings;
  currencies: ExternalProviderCurrency[];
  categories: ExternalProviderCategory[];
  transactions: ExternalProviderTransaction[];
  statPoints: StatPoint[];
}

export interface StatPointInput {
  monthKey: string;
  periodParams?: unknown;
  point: StatPoint;
}

export interface TransactionQueryParams {
  sinceTicks?: number;
  fromDate?: number;
  toDate?: number;
  limit?: number;
  offset?: number;
}

export interface ExternalProviderStore {
  getSyncConfig(): Promise<ExternalProviderSyncConfig>;
  updateSyncConfig(updates: Partial<ExternalProviderSyncConfig>): Promise<ExternalProviderSyncConfig>;
  getCategories(includeDeleted?: boolean): Promise<ExternalProviderCategory[]>;
  upsertCategories(categories: ExternalProviderCategory[]): Promise<void>;
  getCurrencies(): Promise<ExternalProviderCurrency[]>;
  saveCurrencies(currencies: ExternalProviderCurrency[]): Promise<void>;
  getSettings(): Promise<ExternalProviderSettings>;
  saveSettings(settings: ExternalProviderSettings): Promise<void>;
  getTransactions(query?: TransactionQueryParams): Promise<ExternalProviderTransaction[]>;
  upsertTransactions(transactions: ExternalProviderTransaction[]): Promise<void>;
  getStatPoints(monthKeys?: string[]): Promise<StatPoint[]>;
  upsertStatPoints(points: StatPointInput[]): Promise<void>;
  getFullSnapshot(): Promise<ExternalProviderSnapshot>;
  resetStore(): Promise<void>;
}

export const DEFAULT_SYNC_CONFIG: ExternalProviderSyncConfig = {
  id: "default",
  sync_version: 0,
  sync_status: "idle",
  last_synced_at: null,
  last_warm_reconcile_at: null,
  last_full_reconcile_at: null,
  last_cron_run_at: null,
  last_error: null,
  watermark_tx_ticks: 0,
  hot_pull_months: 3,
  auto_poll_interval_minutes: 0,
  settings_json: {},
  currencies_json: [],
  updated_at: new Date(0).toISOString(),
};

interface LocalStoreState {
  config: ExternalProviderSyncConfig;
  categories: Map<string, ExternalProviderCategory>;
  transactions: Map<string, ExternalProviderTransaction>;
  statPoints: Map<string, { monthKey: string; periodParams?: unknown; point: StatPoint }>;
}

export class LocalFileExternalProviderStore implements ExternalProviderStore {
  private filePath?: string;
  private state: LocalStoreState;

  constructor(options?: { filePath?: string; inMemory?: boolean }) {
    if (!options?.inMemory) {
      this.filePath = options?.filePath ?? path.join(process.cwd(), ".cache", "external-provider-store.json");
    }
    this.state = this.loadInitialState();
  }

  private loadInitialState(): LocalStoreState {
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          config: { ...DEFAULT_SYNC_CONFIG, ...parsed.config },
          categories: new Map(Object.entries(parsed.categories || {})),
          transactions: new Map(Object.entries(parsed.transactions || {})),
          statPoints: new Map(Object.entries(parsed.statPoints || {})),
        };
      } catch {
        // Fall back to clean state on read error
      }
    }

    return {
      config: { ...DEFAULT_SYNC_CONFIG },
      categories: new Map(),
      transactions: new Map(),
      statPoints: new Map(),
    };
  }

  private persistState(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serialized = {
        config: this.state.config,
        categories: Object.fromEntries(this.state.categories),
        transactions: Object.fromEntries(this.state.transactions),
        statPoints: Object.fromEntries(this.state.statPoints),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(serialized, null, 2), "utf-8");
    } catch {
      // Ignored in read-only / restricted environments
    }
  }

  async getSyncConfig(): Promise<ExternalProviderSyncConfig> {
    return { ...this.state.config };
  }

  async updateSyncConfig(updates: Partial<ExternalProviderSyncConfig>): Promise<ExternalProviderSyncConfig> {
    this.state.config = {
      ...this.state.config,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persistState();
    return { ...this.state.config };
  }

  async getCategories(includeDeleted = false): Promise<ExternalProviderCategory[]> {
    const list = Array.from(this.state.categories.values());
    const filtered = includeDeleted ? list : list.filter((c) => !c.deleted);
    return filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async upsertCategories(categories: ExternalProviderCategory[]): Promise<void> {
    for (const cat of categories) {
      if (cat.id) {
        this.state.categories.set(cat.id, { ...cat });
      }
    }
    this.persistState();
  }

  async getCurrencies(): Promise<ExternalProviderCurrency[]> {
    return this.state.config.currencies_json;
  }

  async saveCurrencies(currencies: ExternalProviderCurrency[]): Promise<void> {
    this.state.config.currencies_json = currencies;
    this.state.config.updated_at = new Date().toISOString();
    this.persistState();
  }

  async getSettings(): Promise<ExternalProviderSettings> {
    return this.state.config.settings_json || {};
  }

  async saveSettings(settings: ExternalProviderSettings): Promise<void> {
    this.state.config.settings_json = settings;
    this.state.config.updated_at = new Date().toISOString();
    this.persistState();
  }

  async getTransactions(query?: TransactionQueryParams): Promise<ExternalProviderTransaction[]> {
    let list = Array.from(this.state.transactions.values());

    if (query?.sinceTicks !== undefined) {
      const since = query.sinceTicks;
      list = list.filter((tx) => (tx.timestamp ?? 0) > since);
    }
    if (query?.fromDate !== undefined) {
      const from = query.fromDate;
      list = list.filter((tx) => (tx.dateTimestamp ?? 0) >= from);
    }
    if (query?.toDate !== undefined) {
      const to = query.toDate;
      list = list.filter((tx) => (tx.dateTimestamp ?? 0) <= to);
    }

    // Sort descending by dateTimestamp, then timestamp (.NET ticks)
    list.sort((a, b) => {
      const dateA = a.dateTimestamp ?? 0;
      const dateB = b.dateTimestamp ?? 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    });

    if (query?.offset !== undefined || query?.limit !== undefined) {
      const offset = query.offset ?? 0;
      const limit = query.limit ?? list.length;
      return list.slice(offset, offset + limit);
    }

    return list;
  }

  async upsertTransactions(transactions: ExternalProviderTransaction[]): Promise<void> {
    for (const tx of transactions) {
      if (tx.id) {
        this.state.transactions.set(tx.id, { ...tx });
      }
    }
    this.persistState();
  }

  async getStatPoints(monthKeys?: string[]): Promise<StatPoint[]> {
    const list = Array.from(this.state.statPoints.values());
    if (monthKeys && monthKeys.length > 0) {
      const set = new Set(monthKeys);
      return list.filter((item) => set.has(item.monthKey)).map((item) => item.point);
    }
    return list.map((item) => item.point);
  }

  async upsertStatPoints(points: StatPointInput[]): Promise<void> {
    for (const p of points) {
      if (p.monthKey) {
        this.state.statPoints.set(p.monthKey, {
          monthKey: p.monthKey,
          periodParams: p.periodParams,
          point: p.point,
        });
      }
    }
    this.persistState();
  }

  async getFullSnapshot(): Promise<ExternalProviderSnapshot> {
    const config = await this.getSyncConfig();
    const categories = await this.getCategories(true);
    const transactions = await this.getTransactions();
    const statPoints = await this.getStatPoints();
    return {
      syncConfig: config,
      settings: config.settings_json,
      currencies: config.currencies_json,
      categories,
      transactions,
      statPoints,
    };
  }

  async resetStore(): Promise<void> {
    this.state = {
      config: { ...DEFAULT_SYNC_CONFIG },
      categories: new Map(),
      transactions: new Map(),
      statPoints: new Map(),
    };
    this.persistState();
  }
}

export class SupabaseRestExternalProviderStore implements ExternalProviderStore {
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

  async getSyncConfig(): Promise<ExternalProviderSyncConfig> {
    const records = await this.request<ExternalProviderSyncConfig[]>("/ext_sync_config?id=eq.default&select=*");
    const rec = records?.[0];
    if (rec) {
      return {
        ...DEFAULT_SYNC_CONFIG,
        ...rec,
        sync_version: Number(rec.sync_version) || 0,
        watermark_tx_ticks: Number(rec.watermark_tx_ticks) || 0,
        hot_pull_months: Number(rec.hot_pull_months) || 3,
        auto_poll_interval_minutes: Number(rec.auto_poll_interval_minutes) || 0,
        settings_json: rec.settings_json || {},
        currencies_json: rec.currencies_json || [],
      };
    }

    // Initialize default row if not present
    await this.request("/ext_sync_config", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([DEFAULT_SYNC_CONFIG]),
    });
    return { ...DEFAULT_SYNC_CONFIG };
  }

  async updateSyncConfig(updates: Partial<ExternalProviderSyncConfig>): Promise<ExternalProviderSyncConfig> {
    const payload = {
      ...updates,
      id: "default",
      updated_at: new Date().toISOString(),
    };
    const res = await this.request<ExternalProviderSyncConfig[]>("/ext_sync_config?id=eq.default", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const rec = res?.[0];
    if (rec) {
      return {
        ...DEFAULT_SYNC_CONFIG,
        ...rec,
        sync_version: Number(rec.sync_version) || 0,
        watermark_tx_ticks: Number(rec.watermark_tx_ticks) || 0,
        hot_pull_months: Number(rec.hot_pull_months) || 3,
        auto_poll_interval_minutes: Number(rec.auto_poll_interval_minutes) || 0,
      };
    }
    return this.getSyncConfig();
  }

  async getCategories(includeDeleted = false): Promise<ExternalProviderCategory[]> {
    const query = includeDeleted
      ? "/ext_categories?select=raw_json&order=sort_order.asc"
      : "/ext_categories?deleted=eq.false&select=raw_json&order=sort_order.asc";
    const records = await this.request<Array<{ raw_json: ExternalProviderCategory }>>(query);
    return (records || []).map((r) => r.raw_json);
  }

  async upsertCategories(categories: ExternalProviderCategory[]): Promise<void> {
    if (categories.length === 0) return;
    const now = new Date().toISOString();
    const rows = categories.map((cat) => ({
      id: cat.id,
      category_type: Number(cat.categoryType) || 0,
      name: cat.name || "",
      currency_id: cat.currencyId || null,
      amount: Number(cat.amount ?? cat.currentAmount) || 0,
      sort_order: Number(cat.order) || 0,
      deleted: Boolean(cat.deleted),
      raw_json: cat,
      updated_at: now,
    }));

    await this.request("/ext_categories", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }

  async getCurrencies(): Promise<ExternalProviderCurrency[]> {
    const config = await this.getSyncConfig();
    return config.currencies_json;
  }

  async saveCurrencies(currencies: ExternalProviderCurrency[]): Promise<void> {
    await this.updateSyncConfig({ currencies_json: currencies });
  }

  async getSettings(): Promise<ExternalProviderSettings> {
    const config = await this.getSyncConfig();
    return config.settings_json || {};
  }

  async saveSettings(settings: ExternalProviderSettings): Promise<void> {
    await this.updateSyncConfig({ settings_json: settings });
  }

  async getTransactions(query?: TransactionQueryParams): Promise<ExternalProviderTransaction[]> {
    const params = new URLSearchParams();
    params.set("select", "raw_json");
    params.set("order", "date_timestamp.desc,updated_ticks.desc");

    if (query?.sinceTicks !== undefined) {
      params.append("updated_ticks", `gt.${query.sinceTicks}`);
    }
    if (query?.fromDate !== undefined) {
      params.append("date_timestamp", `gte.${query.fromDate}`);
    }
    if (query?.toDate !== undefined) {
      params.append("date_timestamp", `lte.${query.toDate}`);
    }
    if (query?.limit !== undefined) {
      params.set("limit", String(query.limit));
    }
    if (query?.offset !== undefined) {
      params.set("offset", String(query.offset));
    }

    const records = await this.request<Array<{ raw_json: ExternalProviderTransaction }>>(`/ext_transactions?${params}`);
    return (records || []).map((r) => r.raw_json);
  }

  async upsertTransactions(transactions: ExternalProviderTransaction[]): Promise<void> {
    if (transactions.length === 0) return;
    const now = new Date().toISOString();
    const rows = transactions.map((tx) => ({
      id: tx.id,
      date_timestamp: Number(tx.dateTimestamp) || 0,
      date_iso: tx.dateTimestampISO || null,
      updated_ticks: Number(tx.timestamp) || 0,
      source_id: tx.sourceId || null,
      destination_id: tx.destinationId || null,
      deleted: Boolean(tx.deleted),
      raw_json: tx,
      updated_at: now,
    }));

    // Chunk upserts in batches of 200 for safe request size
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.request("/ext_transactions", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(chunk),
      });
    }
  }

  async getStatPoints(monthKeys?: string[]): Promise<StatPoint[]> {
    let path = "/ext_stat_points?select=raw_json&order=month_key.asc";
    if (monthKeys && monthKeys.length > 0) {
      path += `&month_key=in.(${monthKeys.join(",")})`;
    }
    const records = await this.request<Array<{ raw_json: StatPoint }>>(path);
    return (records || []).map((r) => r.raw_json);
  }

  async upsertStatPoints(points: StatPointInput[]): Promise<void> {
    if (points.length === 0) return;
    const now = new Date().toISOString();
    const rows = points.map((p) => ({
      month_key: p.monthKey,
      period_params_json: p.periodParams || null,
      raw_json: p.point,
      updated_at: now,
    }));

    await this.request("/ext_stat_points", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }

  async getFullSnapshot(): Promise<ExternalProviderSnapshot> {
    const config = await this.getSyncConfig();
    const categories = await this.getCategories(true);
    const transactions = await this.getTransactions();
    const statPoints = await this.getStatPoints();
    return {
      syncConfig: config,
      settings: config.settings_json,
      currencies: config.currencies_json,
      categories,
      transactions,
      statPoints,
    };
  }

  async resetStore(): Promise<void> {
    await this.request("/ext_transactions?id=neq.__none__", { method: "DELETE" });
    await this.request("/ext_categories?id=neq.__none__", { method: "DELETE" });
    await this.request("/ext_stat_points?month_key=neq.__none__", { method: "DELETE" });
    await this.updateSyncConfig({
      sync_version: 0,
      sync_status: "idle",
      last_synced_at: null,
      last_warm_reconcile_at: null,
      last_full_reconcile_at: null,
      last_cron_run_at: null,
      last_error: null,
      watermark_tx_ticks: 0,
      settings_json: {},
      currencies_json: [],
    });
  }
}

let activeStore: ExternalProviderStore | null = null;

export function getExternalProviderStore(): ExternalProviderStore {
  if (activeStore) {
    return activeStore;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    activeStore = new SupabaseRestExternalProviderStore(supabaseUrl, serviceRoleKey);
  } else {
    activeStore = new LocalFileExternalProviderStore();
  }

  return activeStore;
}

export function setTestExternalProviderStore(store: ExternalProviderStore | null): void {
  activeStore = store;
}
