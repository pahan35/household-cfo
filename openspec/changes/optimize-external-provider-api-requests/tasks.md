# Tasks

## 1. Server Proxy & Keychain Singleflight Caching

- [ ] 1.1 Update `src/server/external-provider/token.ts` to store `webCredsCache`, `cached`, and in-flight resolution promises on `globalThis.__externalProviderTokenState`; verify `tsc --noEmit` passes and concurrent credential lookups share a single keychain read.
- [ ] 1.2 Create `src/server/external-provider/cache.ts` with a `globalThis`-backed 5-hour TTL response cache, bounded entry eviction, and in-flight singleflight coalescing; verify module compiles cleanly with `server-only` guard.
- [ ] 1.3 Update `src/server/external-provider/config.ts` and `src/app/api/external-provider/[...path]/route.ts` to integrate the 5-hour server cache, strip cache-busting `ts` params on `/stat/ping`, and bypass/refresh cache when `Cache-Control: no-cache` is sent; verify `npm run verify` passes.

## 2. Client-Side 5-Hour Cache & Force-Refresh Controls

- [ ] 2.1 Refactor `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` to remove `ts: Date.now()`, add `globalThis.__externalProviderClientCache` with a 5-hour TTL and singleflight promise coalescing, and support `{ forceRefresh?: boolean }` / `invalidateExternalProviderClientCache()`; verify deterministic cache keys and `Cache-Control: no-cache` propagation on force refresh.

## 3. Single-Coordinator Dashboard & Child Component Deduplication

- [ ] 3.1 Update `AccountsCard`, `BudgetSummaryCard`, and `RecentTransactionsCard` to accept shared data, loading/error states, and retry callbacks via props instead of firing duplicate mount `useEffect` requests; verify each component renders from props and still supports section-level retry and transaction pagination.
- [ ] 3.2 Update `FamilyBudgetDashboard` to coordinate data fetching, anchor `getBudgetSelection` once at the current month (reusing the 40-month `statData` points across Current, Previous, and historical YoY month selections), pass shared data to child cards, wire `forceRefresh: true` to "Refresh Data", and remove `key={...-refreshKey}` subtree remounting; verify switching periods and refreshing updates state in place without duplicate requests.
- [ ] 3.3 Run `npm run verify` (`biome check && tsc --noEmit`) to confirm formatting, lint rules, and strict TypeScript types pass across the workspace.
