# Design

## Context

See `proposal.md` for motivation. Currently, `/dashboard/family-budget` suffers from five compounding request multipliers:
1. `FamilyBudgetDashboard` and its child components (`AccountsCard`, `BudgetSummaryCard`, `RecentTransactionsCard`) independently fetch overlapping endpoints (`POST /Exchange/Ping`, `GET /stat/ping`, `POST /api/transaction/get`) on mount.
2. React Strict Mode in development double-mounts components while `/api/external-provider/[...path]/route.ts` neither coalesces in-flight requests nor forwards `request.signal` to upstream `fetch`.
3. `getBudgetSelection` appends `ts: Date.now().toString()` to `/stat/ping` URLs, defeating caching, and `handleRefreshAll` increments `refreshKey` on wrapper `key` props, unmounting and remounting DOM subtrees.
4. `getBudgetSelection` requests `Before: 40` (40 monthly points), yet changing `fromDate` (Current Month, Previous Month, or historical YoY month) triggers new `/stat/ping` requests even though the point already exists in `statData.selection.points`.
5. `src/server/external-provider/token.ts` stores `webCredsCache` in a module-scoped variable without singleflight deduplication, causing server HMR reloads and concurrent cold requests to spawn up to 14 parallel `security find-generic-password` processes.

## Goals / Non-Goals

**Goals:**
- Reduce upstream ExternalProvider requests on `/dashboard/family-budget` to at most 4 unique requests per 5-hour TTL window (`settings/get`, `Exchange/Ping`, `stat/ping`, `api/transaction/get`).
- Ensure client HMR Fast Refresh, React Strict Mode double-mounts, and server HMR rebuilds produce zero additional upstream requests once cached.
- Reuse the 40-month `/stat/ping` payload in memory when switching between Current Month, Previous Month, and YoY historical months.
- Provide instant, clean on-demand cache bypass via the "Refresh Data" button and section "Retry" actions without unmounting component subtrees.
- Eliminate concurrent macOS keychain subprocess stampedes in `token.ts`.

**Non-Goals:**
- Introducing external data-fetching dependencies (e.g., TanStack Query, SWR, Redis).
- Supporting write-through cache invalidation for ExternalProvider mutations (ExternalProvider usage is currently strictly read-only; TTL will be revisited when write operations are introduced).

## Decisions

### 1. Single-Coordinator Data Flow in `FamilyBudgetDashboard`

`FamilyBudgetDashboard` will own the fetching lifecycle for shared dashboard data and pass data + status props down to child cards:
- **`AccountsCard`**: Accepts `categories`, `isLoading`, `error`, and `onRetry` from `FamilyBudgetDashboard` (keeping optional internal fetch fallback only if `categories` prop is omitted).
- **`BudgetSummaryCard`**: Accepts `statData`, `categories`, `isLoading`, `error`, and `onRetry` from `FamilyBudgetDashboard` instead of calling `getBudgetSelection` in its own `useEffect`.
- **`RecentTransactionsCard`**: Accepts `initialTransactions`, `initialHasMoreData`, `isLoading`, `error`, and `onRetry` from `FamilyBudgetDashboard` (or shares the deduplicated `getTransactionPage` cache) so the initial period load does not fire a second `/api/transaction/get` call, while preserving pagination ("Load older transactions") inside the card.
- **40-Month Anchor for `getBudgetSelection`**: `FamilyBudgetDashboard` anchors `getBudgetSelection` at the current month (`format(startOfMonth(new Date()), "yyyy-MM-dd")`). Because `/stat/ping` returns `Before: 40` monthly points, switching between Current Month, Previous Month, or any YoY historical month within those 40 months slices `statData.selection.points` in memory without refetching `/stat/ping`.
- **In-Place Refresh**: Remove `key={`...-grid-${refreshKey}`}` from the layout grids so clicking "Refresh Data" revalidates data in place without destroying component state or chart animations.

### 2. Client-Side 5-Hour Cache & Singleflight Coalescing (`external-provider-client.ts`)

Store a typed cache and in-flight promise map on `globalThis.__externalProviderClientCache`:
- **TTL**: `5 * 60 * 60 * 1000` ms (5 hours).
- **Deterministic Keys**: Remove `ts: Date.now().toString()` from `getBudgetSelection`. Key client cache entries by logical request signature (e.g., `settings`, `categories`, `stat:${from}`, `tx:${skip}:${take}:${period?.from ?? ""}:${period?.to ?? ""}`).
- **In-Flight Coalescing**: If an identical request is already in flight (and not aborted), callers share the pending promise.To prevent React Strict Mode's first-mount cleanup `AbortController` from cancelling a shared in-flight request needed by the immediate remount, the underlying shared fetch executes without individual caller abort cancellation while individual callers can still ignore results if their signal aborts.
- **Force Refresh**: Add `forceRefresh?: boolean` to client fetch options and export `invalidateExternalProviderClientCache()`. When `forceRefresh: true` is passed, delete matching cache entries and send `"Cache-Control": "no-cache"` to `/api/external-provider/...`.

### 3. Server Proxy 5-Hour Response Cache & Singleflight (`src/server/external-provider/cache.ts` & `route.ts`)

Create `src/server/external-provider/cache.ts` backed by `globalThis.__externalProviderProxyCache`:
- **TTL**: `5 * 60 * 60 * 1000` ms (5 hours) for successful (`2xx`) upstream responses.
- **Cache Key**: `${method}:${upstreamPath}:${searchParams}:${normalizedBodyHashOrString}`. Note that for `/stat/ping`, any `ts` query parameter is stripped before key generation and upstream forwarding.
- **Singleflight Coalescing**: Concurrent requests with the same cache key share a single upstream `fetch` promise, preventing React Strict Mode or parallel browser tabs from hitting ExternalProvider twice.
- **Force Refresh Bypass**: Add `"cache-control"` to `REQUEST_HEADER_ALLOWLIST` in `src/server/external-provider/config.ts`. When the incoming request includes `Cache-Control: no-cache` (or `max-age=0`), `route.ts` bypasses the cached entry, fetches fresh data from ExternalProvider, and updates the cache.
- **Security**: Only cache scrubbed response payloads/headers after authentication succeeds; never include credentials in cache keys or response headers.

### 4. Global Keychain Credential Cache & Singleflight (`src/server/external-provider/token.ts`)

Move `webCredsCache` and `cached` (token cache) onto `globalThis.__externalProviderTokenState` alongside in-flight promises (`inflightWebCreds`, `inflightToken`):
- Preserves cached credentials across Next.js server HMR module reloads.
- Coalesces concurrent `getWebCredentials()` / `getUpstreamToken()` calls so at most one keychain lookup runs at a time.

## Risks / Trade-offs

- **[Stale data for up to 5 hours if user adds transactions in ExternalProvider mobile/web app]** → Mitigation: The "Refresh Data" button in the top control bar is always visible and forces both client and server proxy caches to revalidate immediately.
- **[Memory growth in long-running dev server]** → Mitigation: Cap `globalThis.__externalProviderProxyCache` at a bounded number of entries (e.g., 100 entries with FIFO/LRU eviction) since there are only ~4 distinct endpoints and a handful of period pages.
