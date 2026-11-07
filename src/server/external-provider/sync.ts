import "server-only";

import {
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  ExchangeKey,
  type ExchangePingResponseEnvelope,
  parseExchangeEntities,
  type SettingsResponseEnvelope,
  type StatPingData,
  type StatPingResponseEnvelope,
  type StatPoint,
  type TransactionPageResponse,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import { serverLogger } from "../logger";
import { UPSTREAM_ORIGIN } from "./config";
import { getExternalProviderStore, type StatPointInput } from "./db";
import { injectUserId } from "./http";
import { getUpstreamToken, getWebCredentials } from "./token";

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

let activeSyncPromise: Promise<ExternalProviderSyncResult> | null = null;

export async function fetchFromExternalProvider<T>(
  pathname: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
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
    throw new Error(`Upstream request to ${pathname} failed (${res.status} ${res.statusText}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export async function runExternalProviderSync(options?: RunSyncOptions): Promise<ExternalProviderSyncResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  const syncOperation = executeSync(options);
  activeSyncPromise = syncOperation;

  try {
    return await syncOperation;
  } finally {
    activeSyncPromise = null;
  }
}

async function executeSync(options?: RunSyncOptions): Promise<ExternalProviderSyncResult> {
  const store = getExternalProviderStore();
  const config = await store.getSyncConfig();

  let targetTier: SyncTier = options?.tier ?? "hot";
  const force = options?.force ?? false;
  const hotPullMonths = options?.hotPullMonths ?? config.hot_pull_months;
  const escalateIfBalanceChanged = options?.escalateIfBalanceChanged ?? true;

  // Cold bootstrap escalation if database has never had a full sync
  if (!config.last_full_reconcile_at && targetTier === "hot") {
    targetTier = "cold";
  }

  await store.updateSyncConfig({ sync_status: "syncing" });

  try {
    // 1. Metadata probe: Category & Currency in a single batched Exchange/Ping call
    const pingResponse = await fetchFromExternalProvider<ExchangePingResponseEnvelope>("/Exchange/Ping", {
      body: {
        items: [
          { key: ExchangeKey.Category, entityJson: null },
          { key: ExchangeKey.Currency, entityJson: null },
        ],
      },
    });

    const items = pingResponse.data?.items ?? [];
    const catItem = items.find((it) => it.key === ExchangeKey.Category);
    const curItem = items.find((it) => it.key === ExchangeKey.Currency);

    const categories: ExternalProviderCategory[] = parseExchangeEntities<ExternalProviderCategory>(catItem?.entityJson);
    const currencies: ExternalProviderCurrency[] = parseExchangeEntities<ExternalProviderCurrency>(curItem?.entityJson);

    // 2. Settings & Stats in parallel (ExternalProvider /stat/ping requires selection payload in `data` query param)
    const statAnchor = new Date().toISOString().slice(0, 10);
    const statPayload = {
      echo: '{"selfSufficientRequest":true}',
      selection: {
        periodtype: 0,
        statisticType: 0,
        period: {
          from: statAnchor,
          to: null,
          Before: 40,
          After: null,
        },
        filter: null,
      },
    };
    const statUrl = `/stat/ping?${new URLSearchParams({ data: JSON.stringify(statPayload) }).toString()}`;

    const [settingsResponse, statResponse] = await Promise.all([
      fetchFromExternalProvider<SettingsResponseEnvelope>("/settings/get"),
      fetchFromExternalProvider<StatPingResponseEnvelope>(statUrl),
    ]);

    const settings: ExternalProviderSettings = settingsResponse.data ?? {};
    const statData: StatPingData = statResponse.data ?? {};

    // 3. Probe top 50 transactions to check watermarks
    const top50Response = await fetchFromExternalProvider<TransactionPageResponse>("/api/transaction/get", {
      body: { skip: 0, take: 50 },
    });
    const top50 = top50Response.transactions ?? [];

    // Compare with existing DB records
    const existingCategories = await store.getCategories(true);
    const existingCategoryMap = new Map(existingCategories.map((c) => [c.id, c]));

    let balanceChanged = false;
    for (const cat of categories) {
      const existing = existingCategoryMap.get(cat.id);
      const newAmount = Number(cat.amount ?? cat.currentAmount) || 0;
      const oldAmount = existing ? Number(existing.amount ?? existing.currentAmount) || 0 : 0;
      if (!existing || newAmount !== oldAmount) {
        balanceChanged = true;
        break;
      }
    }

    const maxTopTick = top50.reduce((max, tx) => Math.max(max, tx.timestamp ?? 0), 0);
    const top50TxIds = new Set(top50.map((t) => t.id));
    const existingTop50 = await store.getTransactions({ limit: 50 });
    const existingTop50Map = new Map(existingTop50.map((t) => [t.id, t]));

    let transactionsChanged = false;
    if (top50.length !== existingTop50.length) {
      transactionsChanged = true;
    } else {
      for (const tx of top50) {
        const existingTx = existingTop50Map.get(tx.id);
        if (!existingTx || (existingTx.timestamp ?? 0) !== (tx.timestamp ?? 0)) {
          transactionsChanged = true;
          break;
        }
      }
    }

    // Fast no-op hot pull check
    if (
      !force &&
      targetTier === "hot" &&
      !balanceChanged &&
      !transactionsChanged &&
      maxTopTick <= config.watermark_tx_ticks &&
      config.last_synced_at !== null
    ) {
      const now = new Date().toISOString();
      await store.updateSyncConfig({
        sync_status: "idle",
        last_synced_at: now,
        last_error: null,
      });

      return {
        success: true,
        tier: "hot",
        escalated: false,
        changed: false,
        syncVersion: config.sync_version,
        recordsSynced: { categories: 0, transactions: 0, currencies: 0, statPoints: 0 },
      };
    }

    // Auto-escalation: Account balance changed, but top-50 has no new transactions
    let escalated = false;
    if (targetTier === "hot" && balanceChanged && !transactionsChanged && escalateIfBalanceChanged) {
      targetTier = "warm";
      escalated = true;
    }

    // 4. Fetch transactions according to tier cutoff
    const nowMs = Date.now();
    let cutoffMs = 0;
    if (targetTier === "hot") {
      cutoffMs = nowMs - hotPullMonths * 31 * 24 * 60 * 60 * 1000;
    } else if (targetTier === "warm") {
      cutoffMs = nowMs - 365 * 24 * 60 * 60 * 1000; // 12 months
    } else {
      cutoffMs = 0; // Cold bootstrap: full ledger
    }

    const fetchedTransactions: ExternalProviderTransaction[] = [];
    const pageSize = targetTier === "cold" ? 500 : 200;
    let skip = 0;
    let hasMorePages = true;

    // Seed with top50 if within range
    for (const tx of top50) {
      if ((tx.dateTimestamp ?? 0) >= cutoffMs) {
        fetchedTransactions.push(tx);
      }
    }
    skip = 50;

    while (hasMorePages) {
      const page = await fetchFromExternalProvider<TransactionPageResponse>("/api/transaction/get", {
        body: { skip, take: pageSize },
      });
      const txs = page.transactions ?? [];
      if (txs.length === 0) {
        hasMorePages = false;
        break;
      }

      let reachedCutoff = false;
      for (const tx of txs) {
        const txDate = tx.dateTimestamp ?? 0;
        if (cutoffMs > 0 && txDate < cutoffMs) {
          reachedCutoff = true;
          break;
        }
        if (!top50TxIds.has(tx.id)) {
          fetchedTransactions.push(tx);
        }
      }

      if (reachedCutoff || page.hasMoreData === false || txs.length < pageSize) {
        hasMorePages = false;
        break;
      }

      skip += pageSize;
    }

    // 5. Parse Stat Points
    const statPointInputs: StatPointInput[] = [];
    const points: StatPoint[] = statData.selection?.points ?? [];
    for (const p of points) {
      if (p.date) {
        statPointInputs.push({
          monthKey: p.date.slice(0, 10),
          periodParams: statData.selection?.period,
          point: p,
        });
      }
    }

    // 6. Atomic Upsert into Store
    await Promise.all([
      store.upsertCategories(categories),
      store.saveCurrencies(currencies),
      store.saveSettings(settings),
      store.upsertTransactions(fetchedTransactions),
      store.upsertStatPoints(statPointInputs),
    ]);

    const newWatermarkTicks = Math.max(
      config.watermark_tx_ticks,
      ...fetchedTransactions.map((tx) => tx.timestamp ?? 0),
    );

    const nowIso = new Date().toISOString();
    const newVersion = config.sync_version + 1;

    await store.updateSyncConfig({
      sync_version: newVersion,
      sync_status: "idle",
      last_synced_at: nowIso,
      last_warm_reconcile_at: targetTier === "warm" || targetTier === "cold" ? nowIso : config.last_warm_reconcile_at,
      last_full_reconcile_at: targetTier === "cold" ? nowIso : config.last_full_reconcile_at,
      watermark_tx_ticks: newWatermarkTicks,
      last_error: null,
    });

    return {
      success: true,
      tier: targetTier,
      escalated,
      changed: true,
      syncVersion: newVersion,
      recordsSynced: {
        categories: categories.length,
        transactions: fetchedTransactions.length,
        currencies: currencies.length,
        statPoints: statPointInputs.length,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    serverLogger.error("ExternalProvider sync execution failed", {
      tier: targetTier,
      syncVersion: config.sync_version,
      error: err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : errorMsg,
    });
    await store.updateSyncConfig({
      sync_status: "error",
      last_error: errorMsg,
    });
    return {
      success: false,
      tier: targetTier,
      escalated: false,
      changed: false,
      syncVersion: config.sync_version,
      recordsSynced: { categories: 0, transactions: 0, currencies: 0, statPoints: 0 },
      error: errorMsg,
    };
  }
}
