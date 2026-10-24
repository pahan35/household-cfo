import "server-only";

import { createHash } from "node:crypto";

export const PROXY_CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours
export const MAX_CACHE_ENTRIES = 100;

export type CachedProxyResponse = {
  status: number;
  headers: [string, string][];
  body: Uint8Array;
  expiresAt: number;
};

type ProxyCacheState = {
  entries: Map<string, CachedProxyResponse>;
  inflight: Map<string, Promise<CachedProxyResponse>>;
};

const globalState = globalThis as unknown as { __externalProviderProxyCache?: ProxyCacheState };
globalState.__externalProviderProxyCache ??= {
  entries: new Map(),
  inflight: new Map(),
};
const proxyCacheState: ProxyCacheState = globalState.__externalProviderProxyCache;

export function buildProxyCacheKey(
  method: string,
  pathname: string,
  search: string,
  body?: ArrayBuffer | Uint8Array | null,
): string {
  let normalizedSearch = search;
  if (search.length > 0) {
    const rawSearch = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(rawSearch);
    if (pathname === "/stat/ping") {
      params.delete("ts");
    }
    const entries = [...params.entries()].sort(([aKey, aVal], [bKey, bVal]) => {
      const cmp = aKey.localeCompare(bKey);
      return cmp !== 0 ? cmp : aVal.localeCompare(bVal);
    });
    const sorted = new URLSearchParams(entries);
    const sortedStr = sorted.toString();
    normalizedSearch = sortedStr.length > 0 ? `?${sortedStr}` : "";
  }

  let bodyHash = "";
  if (body !== undefined && body !== null && body.byteLength > 0) {
    const view = body instanceof Uint8Array ? body : new Uint8Array(body);
    bodyHash = `:${createHash("sha256").update(view).digest("hex")}`;
  }

  return `${method.toUpperCase()}:${pathname}:${normalizedSearch}${bodyHash}`;
}

export function getProxyCachedResponse(key: string): CachedProxyResponse | undefined {
  const entry = proxyCacheState.entries.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    proxyCacheState.entries.delete(key);
    return undefined;
  }
  return entry;
}

export function setProxyCachedResponse(
  key: string,
  response: Omit<CachedProxyResponse, "expiresAt">,
  ttlMs: number = PROXY_CACHE_TTL_MS,
): CachedProxyResponse {
  const expiresAt = Date.now() + ttlMs;
  const entry: CachedProxyResponse = { ...response, expiresAt };

  if (proxyCacheState.entries.has(key)) {
    proxyCacheState.entries.delete(key);
  } else if (proxyCacheState.entries.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = proxyCacheState.entries.keys().next().value;
    if (oldestKey !== undefined) {
      proxyCacheState.entries.delete(oldestKey);
    }
  }

  proxyCacheState.entries.set(key, entry);
  return entry;
}

export async function fetchWithProxyCache(
  key: string,
  fetcher: () => Promise<CachedProxyResponse>,
  options?: { bypassCache?: boolean; ttlMs?: number },
): Promise<CachedProxyResponse> {
  const bypass = options?.bypassCache ?? false;

  if (!bypass) {
    const cached = getProxyCachedResponse(key);
    if (cached !== undefined) {
      return cached;
    }

    const inflight = proxyCacheState.inflight.get(key);
    if (inflight !== undefined) {
      return inflight;
    }
  }

  const promise = (async () => {
    try {
      const res = await fetcher();
      if (res.status >= 200 && res.status < 300) {
        setProxyCachedResponse(key, res, options?.ttlMs ?? PROXY_CACHE_TTL_MS);
      }
      return res;
    } finally {
      proxyCacheState.inflight.delete(key);
    }
  })();

  proxyCacheState.inflight.set(key, promise);
  return promise;
}

export function clearProxyCache(): void {
  proxyCacheState.entries.clear();
  proxyCacheState.inflight.clear();
}
