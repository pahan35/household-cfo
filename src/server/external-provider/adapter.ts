import "server-only";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  ExchangeKey,
  type ExchangePingResponseEnvelope,
  isAccountType,
  type SettingsResponseEnvelope,
  type StatPingResponseEnvelope,
  type StatPoint,
  type TransactionPageResponse,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { UPSTREAM_ORIGIN } from "@/server/external-provider/config";
import {
  type ExternalProviderSnapshot,
  type ExternalProviderSyncConfig,
  getExternalProviderStore,
  type StatPointInput,
} from "@/server/external-provider/db";
import { injectUserId } from "@/server/external-provider/http";
import {
  buildMockSeedSnapshot,
  MOCK_SEED_IDS,
  msToDotNetTicks,
  recomputeMockStatPointsAndBalances,
} from "@/server/external-provider/mock-seed";
import { getUpstreamToken, getWebCredentials } from "@/server/external-provider/token";
import { getExternalProviderAdapterMode, isMockAdapterMode } from "@/server/supabase/config";

export interface TransactionQueryOptions {
  skip?: number;
  take?: number;
  period?: unknown;
  categoryIds?: string[];
}

export type SyncTier = "hot" | "warm" | "cold";

export interface RunSyncOptions {
  tier?: SyncTier;
  force?: boolean;
  hotPullMonths?: number;
  escalateIfBalanceChanged?: boolean;
}

export interface ExternalProviderSyncResult {
  success: boolean;
  tier: SyncTier;
  escalated: boolean;
  changed: boolean;
  syncVersion: number;
  recordsSynced: {
    categories: number;
    transactions: number;
    currencies: number;
    statPoints: number;
  };
  error?: string;
}

export interface ExternalProviderUpstreamAdapter {
  readonly mode: "external-provider" | "mock";

  // Raw proxy operations
  getSettings(): Promise<SettingsResponseEnvelope>;
  exchangePing(payload?: {
    items?: Array<{ key: number; entityJson: string | null }>;
  }): Promise<ExchangePingResponseEnvelope>;
  getTransactions(query?: TransactionQueryOptions): Promise<TransactionPageResponse>;
  createTransactions(transactions: ExternalProviderTransaction[]): Promise<ExternalProviderTransaction[]>;
  updateTransaction(transaction: ExternalProviderTransaction): Promise<ExternalProviderTransaction>;
  statPing(selectionQuery?: string): Promise<StatPingResponseEnvelope>;

  // High-level domain operations
  getSnapshot(sinceVersion?: number): Promise<ExternalProviderSnapshot>;
  upsertCategories(categories: ExternalProviderCategory[]): Promise<ExternalProviderCategory[]>;
  sync(options?: RunSyncOptions): Promise<ExternalProviderSyncResult>;
  resetToSeed(): Promise<ExternalProviderSnapshot>;
}

let liveSyncRunner: ((options?: RunSyncOptions) => Promise<ExternalProviderSyncResult>) | null = null;

export function registerLiveSyncRunner(runner: (options?: RunSyncOptions) => Promise<ExternalProviderSyncResult>): void {
  liveSyncRunner = runner;
}

/**
 * Live External API Upstream Adapter.
 * Makes real HTTP requests to https://api.external-provider.example.com using server-side resolved credentials.
 */
export class LiveExternalProviderAdapter implements ExternalProviderUpstreamAdapter {
  readonly mode = "external-provider" as const;

  private async fetchLive<T>(pathname: string, options?: { method?: string; body?: unknown }): Promise<T> {
    const method = options?.method ?? (options?.body ? "POST" : "GET");
    const headers = new Headers({
      accept: "application/json",
    });

    const webCreds = await getWebCredentials();
    let bodyBuffer: ArrayBuffer | undefined;

    if (options?.body !== undefined) {
      headers.set("content-type", "application/json");
      const raw = new TextEncoder().encode(JSON.stringify(options.body)).buffer;
      if (pathname === "/api/transaction/get" && webCreds?.userId) {
        bodyBuffer = injectUserId(raw, webCreds.userId);
      } else {
        bodyBuffer = raw;
      }
    }

    if (webCreds !== undefined) {
      headers.set("cookie", webCreds.cookie);
    } else {
      const token = await getUpstreamToken();
      headers.set("authorization", `Bearer ${token}`);
    }

    const url = `${UPSTREAM_ORIGIN}${pathname}`;
    const res = await fetch(url, {
      method,
      headers,
      body: bodyBuffer,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Upstream request to ${pathname} failed (${res.status} ${res.statusText}): ${text.slice(0, 200)}`,
      );
    }

    return (await res.json()) as T;
  }

  async getSettings(): Promise<SettingsResponseEnvelope> {
    return this.fetchLive<SettingsResponseEnvelope>("/settings/get");
  }

  async exchangePing(payload?: {
    items?: Array<{ key: number; entityJson: string | null }>;
  }): Promise<ExchangePingResponseEnvelope> {
    return this.fetchLive<ExchangePingResponseEnvelope>("/Exchange/Ping", {
      method: payload ? "POST" : "GET",
      body: payload,
    });
  }

  async getTransactions(query?: TransactionQueryOptions): Promise<TransactionPageResponse> {
    return this.fetchLive<TransactionPageResponse>("/api/transaction/get", {
      method: "POST",
      body: query ?? { skip: 0, take: 50 },
    });
  }

  async createTransactions(transactions: ExternalProviderTransaction[]): Promise<ExternalProviderTransaction[]> {
    const res = await this.fetchLive<ExternalProviderTransaction[] | ExternalProviderTransaction>("/api/transaction/create", {
      method: "POST",
      body: transactions,
    });
    const list = Array.isArray(res) ? res : [res];
    const store = getExternalProviderStore();
    await store.upsertTransactions(list);
    return list;
  }

  async updateTransaction(transaction: ExternalProviderTransaction): Promise<ExternalProviderTransaction> {
    const res = await this.fetchLive<ExternalProviderTransaction>("/api/transaction/update", {
      method: "POST",
      body: transaction,
    });
    const store = getExternalProviderStore();
    await store.upsertTransactions([res]);
    return res;
  }

  async statPing(selectionQuery?: string): Promise<StatPingResponseEnvelope> {
    const query = selectionQuery ? `?data=${encodeURIComponent(selectionQuery)}` : "";
    return this.fetchLive<StatPingResponseEnvelope>(`/stat/ping${query}`);
  }

  async getSnapshot(sinceVersion?: number): Promise<ExternalProviderSnapshot> {
    const store = getExternalProviderStore();
    return store.getFullSnapshot();
  }

  async upsertCategories(categories: ExternalProviderCategory[]): Promise<ExternalProviderCategory[]> {
    await this.exchangePing({
      items: [{ key: ExchangeKey.Category, entityJson: JSON.stringify(categories) }],
    });
    const store = getExternalProviderStore();
    await store.upsertCategories(categories);
    return categories;
  }

  async sync(options?: RunSyncOptions): Promise<ExternalProviderSyncResult> {
    if (liveSyncRunner) {
      return liveSyncRunner(options);
    }
    throw new Error("Live sync runner is not registered");
  }

  async resetToSeed(): Promise<ExternalProviderSnapshot> {
    throw new Error("Resetting External API is forbidden in live external-provider mode");
  }
}

/**
 * Mock External API Upstream Adapter.
 * Emulates upstream ExternalProvider behavior exclusively against server persistence,
 * with deterministic seeding, automatic balance and stat point recalculation, and zero external network calls.
 */
export class MockExternalProviderAdapter implements ExternalProviderUpstreamAdapter {
  readonly mode = "mock" as const;

  /**
   * Automatically populates the deterministic seed snapshot if the store is empty (sync_version === 0).
   */
  async ensureSeeded(): Promise<ExternalProviderSnapshot> {
    const store = getExternalProviderStore();
    const config = await store.getSyncConfig();

    if (config.sync_version === 0) {
      const seed = buildMockSeedSnapshot();
      await store.upsertCategories(seed.categories);
      await store.upsertTransactions(seed.transactions);
      await store.upsertStatPoints(
        seed.statPoints.map((p) => ({
          monthKey: p.id,
          point: p,
        })),
      );
      await store.updateSyncConfig({
        sync_version: 1,
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
        last_warm_reconcile_at: new Date().toISOString(),
        last_full_reconcile_at: new Date().toISOString(),
        watermark_tx_ticks: seed.syncConfig.watermark_tx_ticks,
        settings_json: seed.settings,
        currencies_json: seed.currencies,
      });
      return seed;
    }

    return store.getFullSnapshot();
  }

  /**
   * Recalculates category/account balances and monthly stat points from active transactions,
   * updates the store, and increments sync_version.
   */
  private async reconcileStoreState(): Promise<void> {
    const store = getExternalProviderStore();
    const categories = await store.getCategories(true);
    const transactions = await store.getTransactions();

    const { updatedCategories, statPoints } = recomputeMockStatPointsAndBalances(categories, transactions);

    await store.upsertCategories(updatedCategories);
    await store.upsertStatPoints(
      statPoints.map((p) => ({
        monthKey: p.id,
        point: p,
      })),
    );

    const config = await store.getSyncConfig();
    await store.updateSyncConfig({
      sync_version: config.sync_version + 1,
      sync_status: "idle",
      last_synced_at: new Date().toISOString(),
    });
  }

  async getSettings(): Promise<SettingsResponseEnvelope> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    const config = await store.getSyncConfig();
    return {
      isSuccess: true,
      data: config.settings_json,
    };
  }

  async exchangePing(payload?: {
    items?: Array<{ key: number; entityJson: string | null }>;
  }): Promise<ExchangePingResponseEnvelope> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();

    // Handle category write-through if present in payload
    if (payload?.items && Array.isArray(payload.items)) {
      const catItem = payload.items.find((it) => it.key === ExchangeKey.Category);
      if (catItem?.entityJson) {
        try {
          const categories = JSON.parse(catItem.entityJson) as ExternalProviderCategory[];
          if (Array.isArray(categories)) {
            await store.upsertCategories(categories);
            await this.reconcileStoreState();
          }
        } catch {
          // Ignore JSON parse errors in mock payload
        }
      }
    }

    const categories = await store.getCategories(true);
    const config = await store.getSyncConfig();

    return {
      isSuccess: true,
      data: {
        items: [
          { key: ExchangeKey.User, entityJson: JSON.stringify(config.settings_json) },
          { key: ExchangeKey.Category, entityJson: JSON.stringify(categories) },
          { key: ExchangeKey.Currency, entityJson: JSON.stringify(config.currencies_json) },
        ],
      },
    };
  }

  async getTransactions(query?: TransactionQueryOptions): Promise<TransactionPageResponse> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    const all = await store.getTransactions();

    let filtered = all;
    if (query?.categoryIds && query.categoryIds.length > 0) {
      const catSet = new Set(query.categoryIds);
      filtered = filtered.filter(
        (tx) => (tx.sourceId && catSet.has(tx.sourceId)) || (tx.destinationId && catSet.has(tx.destinationId)),
      );
    }

    const skip = query?.skip ?? 0;
    const take = query?.take ?? 50;
    const page = filtered.slice(skip, skip + take);

    return {
      transactions: page,
      importedTransactions: [],
      hasMoreData: skip + take < filtered.length,
    };
  }

  async createTransactions(transactions: ExternalProviderTransaction[]): Promise<ExternalProviderTransaction[]> {
    await this.ensureSeeded();
    const now = Date.now();
    const prepared = transactions.map((tx, idx) => {
      const ms = tx.dateTimestamp ?? now;
      return {
        ...tx,
        id: tx.id || `tx-mock-${now}-${idx}`,
        dateTimestamp: ms,
        dateTimestampISO: tx.dateTimestampISO || new Date(ms).toISOString(),
        createdTimestamp: tx.createdTimestamp ?? now,
        timestamp: tx.timestamp ?? msToDotNetTicks(ms),
        deleted: Boolean(tx.deleted),
      };
    });

    const store = getExternalProviderStore();
    await store.upsertTransactions(prepared);
    await this.reconcileStoreState();

    return prepared;
  }

  async updateTransaction(transaction: ExternalProviderTransaction): Promise<ExternalProviderTransaction> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    await store.upsertTransactions([transaction]);
    await this.reconcileStoreState();
    return transaction;
  }

  async statPing(selectionQuery?: string): Promise<StatPingResponseEnvelope> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    const points = await store.getStatPoints();

    return {
      isSuccess: true,
      data: {
        selection: {
          periodType: 3,
          points,
        },
      },
    };
  }

  async getSnapshot(sinceVersion?: number): Promise<ExternalProviderSnapshot> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    return store.getFullSnapshot();
  }

  async upsertCategories(categories: ExternalProviderCategory[]): Promise<ExternalProviderCategory[]> {
    await this.ensureSeeded();
    const store = getExternalProviderStore();
    await store.upsertCategories(categories);
    await this.reconcileStoreState();
    return categories;
  }

  async sync(options?: RunSyncOptions): Promise<ExternalProviderSyncResult> {
    await this.ensureSeeded();
    await this.reconcileStoreState();

    const store = getExternalProviderStore();
    const snapshot = await store.getFullSnapshot();

    return {
      success: true,
      tier: options?.tier ?? "hot",
      escalated: false,
      changed: true,
      syncVersion: snapshot.syncConfig.sync_version,
      recordsSynced: {
        categories: snapshot.categories.length,
        transactions: snapshot.transactions.length,
        currencies: snapshot.currencies.length,
        statPoints: snapshot.statPoints.length,
      },
    };
  }

  async resetToSeed(): Promise<ExternalProviderSnapshot> {
    const store = getExternalProviderStore();
    await store.resetStore();

    const seed = buildMockSeedSnapshot();
    await store.upsertCategories(seed.categories);
    await store.upsertTransactions(seed.transactions);
    await store.upsertStatPoints(
      seed.statPoints.map((p) => ({
        monthKey: p.id,
        point: p,
      })),
    );
    await store.updateSyncConfig({
      sync_version: 1,
      sync_status: "idle",
      last_synced_at: new Date().toISOString(),
      last_warm_reconcile_at: new Date().toISOString(),
      last_full_reconcile_at: new Date().toISOString(),
      last_cron_run_at: null,
      last_error: null,
      watermark_tx_ticks: seed.syncConfig.watermark_tx_ticks,
      settings_json: seed.settings,
      currencies_json: seed.currencies,
    });

    return store.getFullSnapshot();
  }
}

let activeAdapter: ExternalProviderUpstreamAdapter | null = null;
let activeAdapterKey: string | null = null;

export function getExternalProviderAdapter(): ExternalProviderUpstreamAdapter {
  const mode = getExternalProviderAdapterMode();
  if (activeAdapter && (activeAdapterKey === mode || activeAdapterKey === "test")) {
    return activeAdapter;
  }

  if (mode === "mock") {
    activeAdapter = new MockExternalProviderAdapter();
  } else {
    activeAdapter = new LiveExternalProviderAdapter();
  }

  activeAdapterKey = mode;
  return activeAdapter;
}

export function setTestExternalProviderAdapter(adapter: ExternalProviderUpstreamAdapter | null): void {
  activeAdapter = adapter;
  activeAdapterKey = adapter ? "test" : null;
}
