# Tasks

## 1. Supabase PostgreSQL Schema & Server Persistence Adapter

- [x] 1.1 Create `supabase/migrations/0001_external_provider_sync.sql` defining `ext_sync_config`, `ext_categories`, `ext_transactions`, and `ext_stat_points` tables with indexes on `date_timestamp` and `updated_ticks`, and document `DATABASE_URL` / `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` placeholders in `.env.example` and `.agents/rules/secrets.md` (verify migration SQL syntax and secret rule parity).
- [x] 1.2 Implement `src/server/external-provider/db.ts` providing the `ExternalProviderStore` repository (PostgreSQL driver with automatic local file/in-memory fallback when database env vars are absent) supporting atomic upserts for categories, transactions, stat points, and `ext_sync_config` settings, and verify with unit tests in `src/server/external-provider/__tests__/db.test.ts`.

## 2. Hot / Warm / Cold Sync Engine & Server Endpoints

- [x] 2.1 Implement `src/server/external-provider/sync.ts` with single-flight deduplication and tiered synchronization (`hot` using configurable `hot_pull_months`, `warm` 12-month reconciliation, and `cold` full-history bootstrap/rebuild), batched `ExchangeKey.Category` + `ExchangeKey.Currency` `/Exchange/Ping` requests, and automatic escalation to Warm Reconcile when account balances change without recent hot-window transactions; verify with unit tests in `src/server/external-provider/__tests__/sync.test.ts`.
- [x] 2.2 Create `src/app/api/external-provider/sync/route.ts` (`GET` versioned state/delta endpoint supporting `?sinceVersion=<n>` and `POST` manual/auto sync trigger) and `src/app/api/external-provider/sync/config/route.ts` (`PATCH` to update `hot_pull_months` and `auto_poll_interval_minutes` in `ext_sync_config`), and verify route behavior with unit tests.
- [x] 2.3 Update `src/app/api/external-provider/[...path]/route.ts` and `src/server/external-provider/cache.ts` to perform write-through upserts into `ExternalProviderStore` on `/api/transaction/create`, `/api/transaction/update`, and `/Exchange/Ping` writes, and serve stale-while-revalidate responses instead of destructively deleting cached data prior to re-fetch; verify with updated proxy route tests.

## 3. Nightly Scheduled Cron Job

- [x] 3.1 Create `src/app/api/external-provider/cron/daily-sync/route.ts` secured by `Authorization: Bearer <CRON_SECRET>` (or authenticated family session) that runs the daily delta sync against ExternalProvider, updates `last_cron_run_at` in `ext_sync_config`, and configure `vercel.json` with the `0 3 * * *` cron schedule; verify with unit tests covering unauthorized rejection, no-op watermark match, and delta download.

## 4. Browser IndexedDB Mirror & Unified Client Ledger

- [x] 4.1 Implement `src/app/(main)/dashboard/family-budget/_components/external-provider-idb.ts` and update `external-provider-client.ts` so `getSettings`, `getCategories`, `getCurrencies`, `getBudgetSelection`, and `getTransactionPage` hydrate immediately from `IndexedDB` / memory, resolve period/category/account transaction filters locally from the unified ledger, and perform non-destructive SWR updates and optimistic write-through mutations; verify with unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-client.test.ts`.

## 5. Unified UI Sync Control & Dashboard Integration

- [x] 5.1 Create `ExternalProviderSyncProvider` and `ExternalProviderSyncToolbar` in `src/app/(main)/dashboard/family-budget/_components/external-provider-sync-toolbar.tsx` featuring live sync status badge (`Synced`, `Syncing with ExternalProvider…`, `Stale`), `Pull Fresh Data` button, tier actions (`Hot Pull`, `Warm Reconcile 12m`, `Rebuild Full History`), `Hot Pull` window selector (`1m`, `3m`, `6m`, `12m`), and visibility-aware auto-pull timer (`Off`, `5m`, `15m`, `60m`), and mount it in `src/app/(main)/dashboard/family-budget/layout.tsx`; verify with component/hook tests.
- [x] 5.2 Remove duplicated per-screen `Live External API Data` / `Refresh Data` header bars, `key={refreshKey}` remounts, and N+1 missing-category transaction chunk loops across `FamilyBudgetDashboard`, `BudgetOverviewDashboard`, `IncomeDashboard`, `RunwayDashboard`, `MortgageDashboard`, `FxInflationDashboard`, `OfferComparatorDashboard`, and `LifestyleDataProvider`, wiring them to `ExternalProviderSyncProvider`; run `npm run verify` and `npm test` to confirm all checks and tests pass.
