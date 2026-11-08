import {
  archiveIncomeCategory,
  ExchangeKey,
  type ExchangePingResponseEnvelope,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  extractExchangeEntities,
  reorderCategoriesSubset,
  type SettingsResponseEnvelope,
  type StatPingData,
  type StatPingResponseEnvelope,
  type TransactionPageResponse,
  unarchiveIncomeCategory,
} from "./external-provider-data";
import {
  type ExternalProviderSnapshot,
  type ExternalProviderSyncConfig,
  loadSnapshotFromIDB,
  saveSnapshotToIDB,
} from "./external-provider-idb";

export const CLIENT_CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

let localSnapshot: ExternalProviderSnapshot | null = null;

export function getClientSnapshot(): ExternalProviderSnapshot | null {
  return localSnapshot;
}

export function setClientSnapshot(snapshot: ExternalProviderSnapshot | null): void {
  localSnapshot = snapshot;
  if (snapshot) {
    void saveSnapshotToIDB(snapshot);
  }
}

export async function hydrateClientFromIDB(): Promise<ExternalProviderSnapshot | null> {
  const snapshot = await loadSnapshotFromIDB();
  if (snapshot) {
    localSnapshot = snapshot;
  }
  return snapshot;
}

export function resetClientState(): void {
  localSnapshot = null;
  invalidateExternalProviderClientCache();
}

type ClientCacheEntry<T = unknown> = {
  data: T;
  expiresAt: number;
};

type ClientCacheState = {
  entries: Map<string, ClientCacheEntry>;
  inflight: Map<string, Promise<unknown>>;
};

const globalClientState = globalThis as unknown as { __externalProviderClientCache?: ClientCacheState };
globalClientState.__externalProviderClientCache ??= {
  entries: new Map(),
  inflight: new Map(),
};
const clientCacheState: ClientCacheState = globalClientState.__externalProviderClientCache;

export function invalidateExternalProviderClientCache(key?: string): void {
  if (key) {
    clientCacheState.entries.delete(key);
  } else {
    clientCacheState.entries.clear();
  }
}

export function getExternalProviderClientCacheEntry<T = unknown>(key: string): T | undefined {
  const entry = clientCacheState.entries.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    clientCacheState.entries.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setExternalProviderClientCacheEntry<T = unknown>(
  key: string,
  data: T,
  ttlMs = CLIENT_CACHE_TTL_MS,
): void {
  clientCacheState.entries.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function attachSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function cachedClientFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<T> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (options?.signal?.aborted) {
    throw options.signal.reason ?? new DOMException("The operation was aborted", "AbortError");
  }

  if (!forceRefresh) {
    const cached = clientCacheState.entries.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
    const pending = clientCacheState.inflight.get(key) as Promise<T> | undefined;
    if (pending !== undefined) {
      return attachSignal(pending, options?.signal);
    }
  } else {
    clientCacheState.entries.delete(key);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      clientCacheState.entries.set(key, {
        data,
        expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
      });
      return data;
    } finally {
      clientCacheState.inflight.delete(key);
    }
  })();

  clientCacheState.inflight.set(key, promise);
  return attachSignal(promise, options?.signal);
}

export class ExternalProviderClientError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ExternalProviderClientError";
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 503) {
      throw new ExternalProviderClientError(
        "ExternalProvider service unavailable or session expired. Please check your credentials.",
        503,
      );
    }
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = (await response.json()) as {
        error?: { message?: string; detail?: string };
        message?: string;
        detail?: string;
      };
      const message = errJson.error?.message ?? errJson.message;
      const detail = errJson.error?.detail ?? errJson.detail;

      if (message && detail) {
        errorDetail = `${message}: ${detail}`;
      } else if (message) {
        errorDetail = message;
      } else if (detail) {
        errorDetail = detail;
      }
    } catch {
      // response body was not JSON
    }
    throw new ExternalProviderClientError(errorDetail, response.status);
  }

  const json = (await response.json()) as T;
  return json;
}

export async function getSettings(options?: {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ExternalProviderSettings> {
  if (localSnapshot?.settings && Object.keys(localSnapshot.settings).length > 0 && !options?.forceRefresh) {
    return localSnapshot.settings;
  }

  return cachedClientFetch(
    "settings",
    async () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (options?.forceRefresh) {
        headers["Cache-Control"] = "no-cache";
      }

      const response = await fetch("/api/external-provider/settings/get", {
        method: "GET",
        headers,
      });

      const body = await handleResponse<SettingsResponseEnvelope>(response);
      const data = body.data ?? {};
      if (localSnapshot) {
        localSnapshot.settings = data;
        void saveSnapshotToIDB(localSnapshot);
      }
      return data;
    },
    options,
  );
}

export async function getCategories(options?: {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ExternalProviderCategory[]> {
  if (localSnapshot?.categories && localSnapshot.categories.length > 0 && !options?.forceRefresh) {
    return localSnapshot.categories;
  }

  return cachedClientFetch(
    "categories",
    async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (options?.forceRefresh) {
        headers["Cache-Control"] = "no-cache";
      }

      const response = await fetch("/api/external-provider/Exchange/Ping", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: [
            {
              key: ExchangeKey.Category,
              entityJson: null,
            },
          ],
        }),
      });

      const body = await handleResponse<ExchangePingResponseEnvelope>(response);
      const items = body.data?.items ?? [];
      const cats = extractExchangeEntities<ExternalProviderCategory>(items, ExchangeKey.Category);
      if (localSnapshot) {
        localSnapshot.categories = cats;
        void saveSnapshotToIDB(localSnapshot);
      }
      return cats;
    },
    options,
  );
}

export async function getCurrencies(options?: {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ExternalProviderCurrency[]> {
  if (localSnapshot?.currencies && localSnapshot.currencies.length > 0 && !options?.forceRefresh) {
    return localSnapshot.currencies;
  }

  return cachedClientFetch(
    "currencies",
    async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (options?.forceRefresh) {
        headers["Cache-Control"] = "no-cache";
      }

      const response = await fetch("/api/external-provider/Exchange/Ping", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: [
            {
              key: ExchangeKey.Currency,
              entityJson: null,
            },
          ],
        }),
      });

      const body = await handleResponse<ExchangePingResponseEnvelope>(response);
      return extractExchangeEntities<ExternalProviderCurrency>(body.data?.items ?? [], ExchangeKey.Currency);
    },
    options,
  );
}

/**
 * Pushes updated categories upstream to ExternalProvider via POST /api/external-provider/Exchange/Ping
 * under ExchangeKey.Category (key: 2), bypassing cache with Cache-Control: no-cache,
 * and updates/invalidates the client categories cache entry.
 */
export async function updateCategoriesOrder(
  modifiedCategories: ExternalProviderCategory[],
  options?: {
    signal?: AbortSignal;
    allUpdatedCategories?: ExternalProviderCategory[];
  },
): Promise<ExchangePingResponseEnvelope> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
  };

  const payload = {
    items: [
      {
        key: ExchangeKey.Category,
        entityJson: JSON.stringify(modifiedCategories),
      },
    ],
  };

  const response = await fetch("/api/external-provider/Exchange/Ping", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  const body = await handleResponse<ExchangePingResponseEnvelope>(response);

  if (localSnapshot) {
    const categoryMap = new Map(localSnapshot.categories.map((c) => [c.id, c]));
    for (const mod of modifiedCategories) {
      const existing = categoryMap.get(mod.id);
      categoryMap.set(mod.id, { ...existing, ...mod });
    }
    localSnapshot.categories = Array.from(categoryMap.values());
    void saveSnapshotToIDB(localSnapshot);
  }

  if (options?.allUpdatedCategories) {
    clientCacheState.entries.set("categories", {
      data: options.allUpdatedCategories,
      expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
    });
  } else {
    invalidateExternalProviderClientCache("categories");
  }

  for (const key of Array.from(clientCacheState.entries.keys())) {
    if (key.startsWith("stat:")) {
      clientCacheState.entries.delete(key);
    }
  }

  return body;
}

/**
 * Reorders income categories and pushes changes upstream via updateCategoriesOrder.
 */
export async function reorderIncomeCategories(
  allCategories: ExternalProviderCategory[],
  reorderedIncomeIds: string[],
  options?: { signal?: AbortSignal },
): Promise<ExchangePingResponseEnvelope> {
  const result = reorderCategoriesSubset(allCategories, reorderedIncomeIds);
  return updateCategoriesOrder(result.modifiedCategories, {
    signal: options?.signal,
    allUpdatedCategories: result.updatedCategories,
  });
}

/**
 * Archives an income category and pushes changes upstream via updateCategoriesOrder.
 */
export async function archiveIncomeSource(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
  options?: { signal?: AbortSignal },
): Promise<ExchangePingResponseEnvelope> {
  const result = archiveIncomeCategory(allCategories, categoryId);
  return updateCategoriesOrder(result.modifiedCategories, {
    signal: options?.signal,
    allUpdatedCategories: result.updatedCategories,
  });
}

/**
 * Unarchives an income category and pushes changes upstream via updateCategoriesOrder.
 */
export async function unarchiveIncomeSource(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
  options?: { signal?: AbortSignal },
): Promise<ExchangePingResponseEnvelope> {
  const result = unarchiveIncomeCategory(allCategories, categoryId);
  return updateCategoriesOrder(result.modifiedCategories, {
    signal: options?.signal,
    allUpdatedCategories: result.updatedCategories,
  });
}

/**
 * Creates a double-entry ExternalProvider transaction via POST /api/external-provider/api/transaction/create
 * bypassing cache with Cache-Control: no-cache, and invalidates client cache entries
 * for categories and transactions.
 */
export async function createTransaction(
  tx: ExternalProviderTransaction,
  options?: {
    signal?: AbortSignal;
  },
): Promise<{ isSuccess?: boolean; data?: unknown; [key: string]: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
  };

  const response = await fetch("/api/external-provider/api/transaction/create", {
    method: "POST",
    headers,
    body: JSON.stringify([tx]),
    signal: options?.signal,
  });

  const body = await handleResponse<{ isSuccess?: boolean; data?: unknown }>(response);

  if (localSnapshot) {
    const existingIndex = localSnapshot.transactions.findIndex((t) => t.id === tx.id);
    if (existingIndex >= 0) {
      localSnapshot.transactions[existingIndex] = { ...tx };
    } else {
      localSnapshot.transactions = [tx, ...localSnapshot.transactions];
    }
    void saveSnapshotToIDB(localSnapshot);
  }

  invalidateExternalProviderClientCache("categories");
  for (const key of Array.from(clientCacheState.entries.keys())) {
    if (key.startsWith("tx:") || key.startsWith("stat:")) {
      clientCacheState.entries.delete(key);
    }
  }

  return body;
}

/**
 * Updates a ExternalProvider transaction via POST /api/external-provider/api/transaction/update
 * bypassing cache with Cache-Control: no-cache, and invalidates client cache entries
 * for categories and transactions.
 */
export async function updateTransaction(
  tx: ExternalProviderTransaction,
  options?: {
    signal?: AbortSignal;
  },
): Promise<{ isSuccess?: boolean; data?: unknown; [key: string]: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
  };

  const response = await fetch("/api/external-provider/api/transaction/update", {
    method: "POST",
    headers,
    body: JSON.stringify(tx),
    signal: options?.signal,
  });

  const body = await handleResponse<{ isSuccess?: boolean; data?: unknown }>(response);

  if (localSnapshot) {
    const existingIndex = localSnapshot.transactions.findIndex((t) => t.id === tx.id);
    if (existingIndex >= 0) {
      localSnapshot.transactions[existingIndex] = {
        ...localSnapshot.transactions[existingIndex],
        ...tx,
      };
    } else {
      localSnapshot.transactions = [tx, ...localSnapshot.transactions];
    }
    void saveSnapshotToIDB(localSnapshot);
  }

  invalidateExternalProviderClientCache("categories");
  for (const key of Array.from(clientCacheState.entries.keys())) {
    if (key.startsWith("tx:") || key.startsWith("stat:")) {
      clientCacheState.entries.delete(key);
    }
  }

  return body;
}

/**
 * Convenience helper to update the tags array on a transaction and persist upstream.
 */
export async function updateTransactionTags(
  tx: ExternalProviderTransaction,
  tags: string[],
  options?: {
    signal?: AbortSignal;
  },
): Promise<{ isSuccess?: boolean; data?: unknown; [key: string]: unknown }> {
  return updateTransaction({ ...tx, tags }, options);
}

export function filterTransactionsLocally(
  transactions: ExternalProviderTransaction[],
  options?: {
    skip?: number;
    take?: number;
    period?: { from?: string | null; to?: string | null };
    categoryIds?: string[];
  },
): TransactionPageResponse {
  const skip = options?.skip ?? 0;
  const take = options?.take ?? 20;
  const fromStr = options?.period?.from;
  const toStr = options?.period?.to;
  const categoryIds = options?.categoryIds?.filter(Boolean) ?? [];
  const categorySet = categoryIds.length > 0 ? new Set(categoryIds) : null;

  let filtered = transactions.filter((tx) => !tx.deleted);

  if (categorySet) {
    filtered = filtered.filter(
      (tx) => (tx.sourceId && categorySet.has(tx.sourceId)) || (tx.destinationId && categorySet.has(tx.destinationId)),
    );
  }

  if (fromStr) {
    const fromTime = new Date(fromStr).getTime();
    if (!Number.isNaN(fromTime)) {
      filtered = filtered.filter((tx) => {
        const txTime = tx.dateTimestamp ?? (tx.dateTimestampISO ? new Date(tx.dateTimestampISO).getTime() : 0);
        return txTime >= fromTime;
      });
    }
  }

  if (toStr) {
    const toTime = new Date(toStr).getTime();
    if (!Number.isNaN(toTime)) {
      const endOfDay = toStr.length === 10 ? toTime + 24 * 60 * 60 * 1000 - 1 : toTime;
      filtered = filtered.filter((tx) => {
        const txTime = tx.dateTimestamp ?? (tx.dateTimestampISO ? new Date(tx.dateTimestampISO).getTime() : 0);
        return txTime <= endOfDay;
      });
    }
  }

  filtered.sort((a, b) => {
    const timeA = a.dateTimestamp ?? (a.dateTimestampISO ? new Date(a.dateTimestampISO).getTime() : 0);
    const timeB = b.dateTimestamp ?? (b.dateTimestampISO ? new Date(b.dateTimestampISO).getTime() : 0);
    if (timeB !== timeA) return timeB - timeA;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  const total = filtered.length;
  const slice = filtered.slice(skip, skip + take);

  return {
    transactions: slice,
    importedTransactions: [],
    hasMoreData: skip + take < total,
  };
}

export async function getTransactionPage(options?: {
  skip?: number;
  take?: number;
  period?: { from?: string | null; to?: string | null };
  categoryIds?: string[];
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<TransactionPageResponse> {
  if (localSnapshot && localSnapshot.transactions.length > 0 && !options?.forceRefresh) {
    return filterTransactionsLocally(localSnapshot.transactions, options);
  }

  const skip = options?.skip ?? 0;
  const take = options?.take ?? 20;
  const from = options?.period?.from ?? "";
  const to = options?.period?.to ?? "";
  const categoryIds = options?.categoryIds?.filter(Boolean) ?? [];
  const categoryIdsKey = [...categoryIds].sort().join(",");
  const cacheKey = `tx:${skip}:${take}:${from}:${to}:${categoryIdsKey}`;

  return cachedClientFetch(
    cacheKey,
    async () => {
      const payload: Record<string, unknown> = {
        skip,
        take,
      };
      if (options?.period) {
        payload.period = options.period;
      }
      if (categoryIds.length > 0) {
        payload.categoryIds = categoryIds;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (options?.forceRefresh) {
        headers["Cache-Control"] = "no-cache";
      }

      const response = await fetch("/api/external-provider/api/transaction/get", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const body = await handleResponse<TransactionPageResponse>(response);
      return {
        transactions: body.transactions ?? [],
        importedTransactions: body.importedTransactions ?? [],
        hasMoreData: Boolean(body.hasMoreData),
      };
    },
    options,
  );
}

export async function getBudgetSelection(options: {
  from: string;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<StatPingData> {
  if (localSnapshot?.statPoints && localSnapshot.statPoints.length > 0 && !options.forceRefresh) {
    return {
      selection: {
        periodType: 0,
        statisticType: 0,
        period: {
          from: options.from,
          to: null,
          before: 40,
          after: null,
        },
        points: localSnapshot.statPoints,
      },
    };
  }

  const cacheKey = `stat:${options.from}`;

  return cachedClientFetch(
    cacheKey,
    async () => {
      const budgetPayload = {
        echo: '{"selfSufficientRequest":true}',
        selection: {
          periodtype: 0,
          statisticType: 0,
          period: {
            from: options.from,
            to: null,
            Before: 40,
            After: null,
          },
          filter: null,
        },
      };

      const params = new URLSearchParams({
        data: JSON.stringify(budgetPayload),
      });

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (options.forceRefresh) {
        headers["Cache-Control"] = "no-cache";
      }

      const response = await fetch(`/api/external-provider/stat/ping?${params.toString()}`, {
        method: "GET",
        headers,
      });

      const body = await handleResponse<StatPingResponseEnvelope>(response);
      return body.data ?? {};
    },
    options,
  );
}

export async function syncClientWithServer(options?: {
  tier?: "hot" | "warm" | "cold";
  force?: boolean;
}): Promise<{ upToDate: boolean; syncVersion: number }> {
  const currentVersion = localSnapshot?.syncConfig.sync_version ?? 0;

  if (!options?.force && currentVersion > 0) {
    const res = await fetch(`/api/external-provider/sync?sinceVersion=${currentVersion}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        upToDate: boolean;
        syncVersion: number;
        syncConfig?: ExternalProviderSyncConfig;
        snapshot?: ExternalProviderSnapshot;
      };
      if (data.upToDate && localSnapshot && data.syncConfig) {
        localSnapshot.syncConfig = data.syncConfig;
        await saveSnapshotToIDB(localSnapshot);
        return { upToDate: true, syncVersion: data.syncVersion };
      }
      if (data.snapshot) {
        setClientSnapshot(data.snapshot);
        await saveSnapshotToIDB(data.snapshot);
        return { upToDate: false, syncVersion: data.syncVersion };
      }
    }
  }

  const res = await fetch("/api/external-provider/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ tier: options?.tier ?? "hot", force: options?.force ?? true }),
  });
  if (!res.ok) {
    throw new ExternalProviderClientError(`Sync failed with status ${res.status}`, res.status);
  }
  const data = (await res.json()) as { snapshot?: ExternalProviderSnapshot; syncVersion: number };
  if (data.snapshot) {
    setClientSnapshot(data.snapshot);
    await saveSnapshotToIDB(data.snapshot);
  }
  return { upToDate: false, syncVersion: data.syncVersion };
}
