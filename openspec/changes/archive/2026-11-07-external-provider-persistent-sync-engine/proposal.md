# Proposal

## Why

Currently, ExternalProvider data (settings, categories, currencies, 40-month statistics, and transactions) is cached only in volatile in-memory `Map` structures in the browser and Next.js server process. Because there is no shared persistent storage, initial loads and serverless cold starts on Vercel require slow multi-request round-trips to ExternalProvider (`GET /settings/get`, separate `POST /Exchange/Ping` calls, `GET /stat/ping`, and multiple uncoordinated `POST /api/transaction/get` calls across screens), and cache invalidations on refresh or write wipe existing state before new data arrives—causing empty/skeleton states and redundant upstream load. Persisting our single-user, slowly changing financial dataset in a shared server-side PostgreSQL database (Supabase) paired with a browser `IndexedDB` cache, hot/warm/cold delta synchronization, stale-while-revalidate eventual consistency, a nightly scheduled sync job, and a unified UI sync control will make initial page loads near-instantaneous for both household members while protecting ExternalProvider and Vercel quotas.

## What Changes

- **Shared Server-Side PostgreSQL Persistence (Supabase)**:
  - Introduce a server-side persistence layer backed by Supabase PostgreSQL (with local fallback when unconfigured) storing normalized ExternalProvider entities alongside their lossless `raw_json` payloads: `ext_settings`, `ext_currencies`, `ext_categories`, `ext_transactions`, `ext_stat_points`, and a dedicated `ext_sync_config` table for household-wide sync configuration and state watermarks (`sync_version`, `last_synced_at`, `hot_pull_months`, `auto_poll_interval_minutes`, `sync_status`).
- **Hot / Warm / Cold Partitioned Delta Sync Engine**:
  - Partition ExternalProvider synchronization into three tiers matching household usage:
    - **Hot Pull (default: 3 months, user-configurable to 1m / 3m / 6m / 12m)**: Batches `ExchangeKey.Category` and `ExchangeKey.Currency` into a single `/Exchange/Ping` call, fetches current `/stat/ping` points, and pulls/upserts transactions within the configured hot window (plus a lightweight latest-transaction watermark check).
    - **Warm Reconcile (last 12 months)**: Reconciles transactions and monthly stat points over the trailing 12-month window to catch backfilled entries on stale accounts.
    - **Cold Archive (> 12 months)**: Treated as immutable historical data persisted in PostgreSQL and `IndexedDB`, only re-fetched on initial database bootstrap or explicit "Rebuild Full History" action.
- **Stale-While-Revalidate (SWR) & Eventual Consistency (Zero Data Gaps)**:
  - Eliminate destructive pre-fetch cache deletions (`entries.delete` before fetch) and component tree remounts (`key={refreshKey}`) across all Family Budget dashboards.
  - On category/account/transaction mutations (`createTransaction`, `updateTransaction`, `updateCategoriesOrder`), perform write-through optimistic upserts into the server database and client store immediately upon upstream acceptance, marking the sync state as reconciling and merging background upstream updates in place without ever flashing empty or skeleton states.
- **Browser `IndexedDB` Mirror & Versioned Snapshot/Delta Bootstrap**:
  - Add a client-side `IndexedDB` persistence layer (`externalProvider-local-cache`) that hydrates all Family Budget screens in `< 20ms` on page load before network requests complete, and queries the server with its known `syncVersion` (`GET /api/external-provider/sync/state?sinceVersion=...`) to transfer only changed records (`304` / delta payload) and serve all local transaction filtering (`getTransactionPage` by period/category/account) from the unified local ledger.
- **Nightly Scheduled Sync Job (Vercel Cron)**:
  - Add a scheduled endpoint (`/api/external-provider/cron/daily-sync`) and `vercel.json` cron configuration (`0 3 * * *`) authenticated via `CRON_SECRET` that probes ExternalProvider once a night for new or modified transactions/balances, downloads any delta into Supabase PostgreSQL, and keeps both the ExternalProvider session and Supabase free-tier instance active.
- **Unified Dashboard Sync Control & Configurable Auto-Pull**:
  - Replace the duplicated per-screen `Live External API Data` badge and `Refresh Data` buttons across Family Budget screens (`Accounts & Transactions`, `Budget Overview`, `Income & Taxes`, `Runway Simulator`, `Mortgage & Home Goal`, `FX & Inflation`, `Lifestyle`) with a unified shared sync status bar and popover control allowing manual Hot Pull, Warm 12m Reconcile, Full Rebuild, configurable Hot Pull window (`1m`, `3m`, `6m`, `12m`), and visibility-aware opt-in auto-pull (`Off`, `5m`, `15m`, `60m`) persisted in the server's `ext_sync_config` table.

## Capabilities

### New Capabilities
- `external-provider-persistent-sync`: Server-side Supabase PostgreSQL persistence, browser `IndexedDB` mirror, hot/warm/cold delta sync engine, write-through eventual consistency, nightly cron job, and server-persisted sync configuration (`hot_pull_months`, `auto_poll_interval_minutes`).

### Modified Capabilities
- `budget-overview`: Update caching, request deduplication, and on-demand refresh requirements to use non-destructive stale-while-revalidate updates (never clearing displayed data during refresh or post-write reconciliation) and replace per-screen refresh buttons with the unified Family Budget sync control.

## Impact

- **Database / Infrastructure**: Adds Supabase PostgreSQL schema/migrations (`ext_sync_config`, `ext_categories`, `ext_currencies`, `ext_transactions`, `ext_stat_points`) and `vercel.json` cron schedule (`/api/external-provider/cron/daily-sync`).
- **Server Routes & Sync Engine**: Adds `src/server/external-provider/db.ts`, `src/server/external-provider/sync.ts`, `/api/external-provider/sync/route.ts`, `/api/external-provider/sync/config/route.ts`, and `/api/external-provider/cron/daily-sync/route.ts`; updates `/api/external-provider/[...path]/route.ts` and `src/server/external-provider/cache.ts` for write-through persistence and non-destructive SWR.
- **Client Data Layer & UI**: Updates `external-provider-client.ts` with `IndexedDB` backing and unified local ledger querying; introduces `ExternalProviderSyncProvider` and `ExternalProviderSyncToolbar` in `src/app/(main)/dashboard/family-budget/_components/`; removes redundant refresh headers and `refreshKey` remounts across all Family Budget screens.
