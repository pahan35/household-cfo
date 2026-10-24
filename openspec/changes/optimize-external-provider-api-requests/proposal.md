# Proposal

## Why

Visiting `/dashboard/family-budget` or triggering Next.js Hot Module Replacement (HMR) rebuilds causes a storm of redundant upstream requests to ExternalProvider (up to 14+ upstream hits per dev mount and 14 concurrent macOS keychain subprocesses). Because ExternalProvider is currently consumed in a read-only manner, firing duplicate uncached requests across parent and child components on every mount, period switch, or HMR cycle degrades performance and risks upstream rate limiting or session invalidation.

## What Changes

- Consolidate dashboard data fetching into `FamilyBudgetDashboard` as a single coordinator that shares `categories`, the 40-month `statData` series, and initial `periodTransactions` with child cards (`AccountsCard`, `BudgetSummaryCard`, `RecentTransactionsCard`) instead of each child card firing duplicate mount requests.
- Reuse the already-fetched 40-month `/stat/ping` series in memory when switching between Current Month, Previous Month, or historical YoY months so only period-specific transactions are requested when needed.
- Remove cache-busting timestamps (`ts: Date.now()`) from `/stat/ping` requests and remove destructive `key={...-refreshKey}` subtree remounting on refresh.
- Introduce a 5-hour (`5 * 60 * 60 * 1000` ms) `globalThis`-backed cache and in-flight singleflight request deduplication in both `external-provider-client.ts` (surviving client Fast Refresh and React Strict Mode) and the server proxy `/api/external-provider/[...path]/route.ts` (surviving server HMR and full page reloads).
- Persist keychain credential cache and singleflight resolution on `globalThis` in `src/server/external-provider/token.ts` to eliminate parallel `security find-generic-password` subprocess stampedes.
- Wire explicit on-demand cache bypass (`forceRefresh: true` / `Cache-Control: no-cache`) to the dashboard's "Refresh Data" button and section "Retry" actions so users can force-refetch live upstream data at any time.

## Capabilities

### New Capabilities

### Modified Capabilities
- `budget-overview`: Add requirements for single-coordinator data sharing, 5-hour client and server proxy caching with in-flight deduplication across HMR/reloads, in-memory reuse of the 40-month budget statistics series on period selection, and explicit on-demand force-refetch via UI refresh controls.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`
- `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`
- `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
- `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx`
- `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`
- `src/app/api/external-provider/[...path]/route.ts`
- `src/server/external-provider/config.ts`
- `src/server/external-provider/token.ts`
- `src/server/external-provider/cache.ts` (new server-only response cache & singleflight helper)
