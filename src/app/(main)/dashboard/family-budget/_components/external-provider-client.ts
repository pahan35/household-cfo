import {
  archiveIncomeCategory,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  ExchangeKey,
  type ExchangePingResponseEnvelope,
  extractExchangeEntities,
  reorderCategoriesSubset,
  type SettingsResponseEnvelope,
  type StatPingData,
  type StatPingResponseEnvelope,
  type TransactionPageResponse,
  unarchiveIncomeCategory,
} from "./external-provider-data";

export const CLIENT_CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

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

export function setExternalProviderClientCacheEntry<T = unknown>(key: string, data: T, ttlMs = CLIENT_CACHE_TTL_MS): void {
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
      return body.data ?? {};
    },
    options,
  );
}

export async function getCategories(options?: {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ExternalProviderCategory[]> {
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
      return extractExchangeEntities<ExternalProviderCategory>(items, ExchangeKey.Category);
    },
    options,
  );
}

export async function getCurrencies(options?: {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<ExternalProviderCurrency[]> {
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

export async function getTransactionPage(options?: {
  skip?: number;
  take?: number;
  period?: { from?: string | null; to?: string | null };
  categoryIds?: string[];
  signal?: AbortSignal;
  forceRefresh?: boolean;
}): Promise<TransactionPageResponse> {
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
