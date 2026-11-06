# Design: ExternalProvider Persistent Sync Engine & SWR State

## Context

See [`proposal.md`](./proposal.md) for the problem statement and motivation.

Currently, [`src/server/external-provider/cache.ts`](../../../src/server/external-provider/cache.ts) and [`src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`](../../../src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts) store upstream responses in process-local `Map` instances (`__externalProviderProxyCache` and `__externalProviderClientCache`). Every screen (`FamilyBudgetDashboard`, `BudgetOverviewDashboard`, `IncomeDashboard`, `RunwayDashboard`, `MortgageDashboard`, `FxInflationDashboard`, `OfferComparatorDashboard`, and `LifestyleDataProvider`) independently fetches slices of transactions (`take: 300`, `take: 500`, `take: 1500`, or 10 sequential pages of `500`) and calls `invalidateProxyCacheByPathPrefix` or `clientCacheState.entries.delete` prior to re-fetching.

## Goals / Non-Goals

**Goals:**
- Provide a shared, durable server-side PostgreSQL store (Supabase) so both household members see identical synchronized data and settings without waiting on ExternalProvider upstream calls.
- Provide an `IndexedDB` mirror in the browser so page reloads and tab switches render in `< 20ms` with zero network wait when `sync_version` is unchanged.
- Partition ExternalProvider synchronization into **Hot Pull** (default 3m, user-configurable), **Warm Reconcile** (12m), and **Cold Archive** (`> 12m`, immutable unless explicitly rebuilt).
- Guarantee **Stale-While-Revalidate (SWR)** and **Write-Through Eventual Consistency** so users never see skeleton loaders, empty tables, or missing just-created transactions during or after updates.
- Run a daily scheduled job at night (`0 3 * * *` via Vercel Cron) that probes ExternalProvider for new transactions, downloads deltas into Supabase, and keeps both the ExternalProvider session and Supabase free-tier database active.
- Replace duplicated per-screen refresh headers with a single `ExternalProviderSyncToolbar` supporting manual pull, tier selection, Hot Pull window configuration, and visibility-aware opt-in auto-pull (`Off`, `5m`, `15m`, `60m`) persisted in the server's `ext_sync_config` table.

**Non-Goals:**
- Multi-tenant ExternalProvider account isolation: this deployment serves a single shared household ExternalProvider account (`household_id = 'default'`).
- Replacing ExternalProvider as the system of record for writes: all mutations still execute against ExternalProvider first and write through to our PostgreSQL + `IndexedDB` store upon upstream success.

## Decisions

### 1. Supabase PostgreSQL over MongoDB Atlas

**Decision**: Use **Supabase PostgreSQL** accessed on the server via a lightweight SQL client (`postgres` / `@supabase/supabase-js` or pooled `DATABASE_URL`) with a clean repository interface (`ExternalProviderStore`) that falls back to a local JSON file (`.cache/external-provider-store.json`) in local dev/test environments when `SUPABASE_URL` / `DATABASE_URL` is not set.

**Rationale**:
- **Hybrid Relational + JSONB**: ExternalProvider's write endpoints (`/api/transaction/update` and `/Exchange/Ping`) require full entity objects with all upstream fields intact (including `.NET` ticks `dateTimestamp`, `createdTimestamp`, `timestamp`, `counter`, etc.). PostgreSQL `JSONB` stores the exact raw entity losslessly while indexed relational columns (`id`, `date_timestamp`, `updated_ticks`, `deleted`) make watermark comparisons, date-range queries, and atomic upserts (`INSERT ... ON CONFLICT (id) DO UPDATE`) trivial and fast.
- **Zero-Pause Synergy with Nightly Cron**: Supabase's free tier provides 500 MB (our entire 5,000+ transaction dataset is `< 5 MB`) and only pauses after 7 days of zero database activity. Because our nightly cron job (`0 3 * * *`) reads and updates `ext_sync_config` every 24 hours, the Supabase project stays permanently awake at zero cost.

**Database Schema (`supabase/migrations/0001_external_provider_sync.sql`)**:

```sql
-- 1. Household Sync Configuration & Watermark State
CREATE TABLE IF NOT EXISTS ext_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sync_version BIGINT NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'syncing' | 'reconciling' | 'error'
  last_synced_at TIMESTAMPTZ,
  last_warm_reconcile_at TIMESTAMPTZ,
  last_full_reconcile_at TIMESTAMPTZ,
  last_cron_run_at TIMESTAMPTZ,
  last_error TEXT,
  watermark_tx_ticks BIGINT NOT NULL DEFAULT 0,
  hot_pull_months INT NOT NULL DEFAULT 3,           -- Configurable: 1, 3, 6, 12
  auto_poll_interval_minutes INT NOT NULL DEFAULT 0, -- Configurable: 0 (Off), 5, 15, 60
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  currencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categories & Accounts (ExchangeKey.Category = 2)
CREATE TABLE IF NOT EXISTS ext_categories (
  id TEXT PRIMARY KEY,
  category_type INT NOT NULL,
  name TEXT NOT NULL,
  currency_id TEXT,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Transactions Ledger
CREATE TABLE IF NOT EXISTS ext_transactions (
  id TEXT PRIMARY KEY,
  date_timestamp BIGINT NOT NULL,
  date_iso TEXT,
  updated_ticks BIGINT NOT NULL DEFAULT 0,
  source_id TEXT,
  destination_id TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ext_transactions_date_ts ON ext_transactions (date_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ext_transactions_updated_ticks ON ext_transactions (updated_ticks DESC);

-- 4. Monthly Budget Statistics Points (/stat/ping)
CREATE TABLE IF NOT EXISTS ext_stat_points (
  month_key TEXT PRIMARY KEY, -- Canonical 'YYYY-MM-01'
  period_params_json JSONB,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Hot / Warm / Cold Partitioned Sync Protocol

```
+-----------------------------------------------------------------------------------+
|                        TIERED SYNC DECISION FLOW                                  |
+-----------------------------------------------------------------------------------+

  Trigger (Manual / Auto-Poll / Nightly Cron)
       |
       v
  [Step 1: Metadata & Watermark Probe] (2 parallel upstream calls)
    - Call A: POST /Exchange/Ping { items: [Category(2), Currency(4)] }
    - Call B: POST /api/transaction/get { skip: 0, take: 50 }
       |
       +---> Compare Call A category `amount` balances & metadata vs `ext_categories`
       +---> Compare Call B top-50 tx `id` + `timestamp` (.NET ticks) vs `ext_transactions`
       |
       +---> IF nothing changed AND `last_synced_at` is recent:
       |       -> Update `last_synced_at = NOW()`, keep `sync_version` (or bump metadata)
       |       -> Done in ~400ms!
       |
       +---> IF top-50 transactions changed (or Hot Pull requested):
       |       -> Page `/api/transaction/get` (take: 200) within `hot_pull_months` window
       |          until reaching transactions already in DB with matching `updated_ticks`
       |       -> Fetch `GET /stat/ping` (anchor = current month) and upsert `ext_stat_points`
       |       -> Increment `sync_version`
       |
       +---> IF an Account balance changed in Call A, BUT no new tx in Hot Window:
               -> Stale account was backfilled! Escalate automatically to Warm Reconcile
                  (fetch transactions with `period.from = NOW - 12 months`).
```

**Why batching `/Exchange/Ping` matters**:
Currently `getCategories()` and `getCurrencies()` make two separate HTTP POST requests to `/Exchange/Ping`. ExternalProvider's `/Exchange/Ping` natively accepts multiple keys in one request (`items: [{ key: 2, entityJson: null }, { key: 4, entityJson: null }]`), cutting round-trips in half.

### 3. Browser `IndexedDB` Mirror + Versioned State Endpoint

**Decision**: Introduce `GET /api/external-provider/sync/state?sinceVersion=<number>` and a client-side `IndexedDB` store (`externalProvider-cache-v1`).

**Data Flow**:
1. On app mount, `ExternalProviderSyncProvider` reads the full snapshot (`settings`, `currencies`, `categories`, `statPoints`, `transactions`, `syncConfig`) from `IndexedDB` in `< 20ms` and populates React context + `external-provider-client.ts` in-memory indexes.
2. In parallel, `ExternalProviderSyncProvider` calls `GET /api/external-provider/sync/state?sinceVersion=<localVersion>`.
   - If the server's `ext_sync_config.sync_version === sinceVersion`, the server returns `{ upToDate: true, syncConfig }` (`< 200 bytes`).
   - If `sync_version > sinceVersion`, the server returns the updated entities (or full snapshot if `sinceVersion === 0`), and the client atomically updates `IndexedDB` and React state in place.
   - If the server database itself is empty (`sync_version === 0`), the server triggers an initial bootstrap sync from ExternalProvider and streams/returns the populated state.
3. All calls to `getTransactionPage({ skip, take, period, categoryIds })` in [`external-provider-client.ts`](../../../src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts) execute against the hydrated local transaction array in memory (filtering by `period.from`/`to`, matching `sourceId`/`destinationId` against `categoryIds`, sorting reverse-chronologically, and slicing `skip`/`take`).
   - This completely eliminates the N+1 chunked requests in `BudgetOverviewDashboard` (`fetchMissingTransactions`) and the 10-page sequential loop in `LifestyleDataProvider`.

### 4. Write-Through Eventual Consistency (Eliminating Data Gaps)

**Problem**: Previously, creating a transaction or reordering categories deleted client and server cache entries and incremented `refreshKey` (which unmounted `RecentTransactionsCard`). If ExternalProvider took 1–2 seconds to index the transaction or update `/stat/ping`, or if a refresh was slow, the UI flashed skeletons or temporarily lost data.

**Solution**:
1. **Write-Through Upsert**: When `/api/external-provider/api/transaction/create`, `/api/transaction/update`, or `/Exchange/Ping` (write) succeeds upstream:
   - The server proxy immediately upserts the written transaction(s) or category array into `ext_transactions` / `ext_categories`, bumps `sync_version`, and marks `sync_status = 'reconciling'`.
   - The client immediately merges the mutated entity into memory and `IndexedDB`.
2. **Non-Destructive Background Reconcile**:
   - Instead of deleting caches or bumping `refreshKey`, the client triggers a background Hot Pull (`mode: "reconcile"`).
   - While reconciling, the header badge shows `Reconciling with ExternalProvider…` with a subtle spinner, while all existing + optimistically written data stays on screen.
   - Once the background pull completes, updated account balances (`category.amount`) and monthly budget points (`ext_stat_points`) merge atomically by ID.

### 5. Unified `ExternalProviderSyncToolbar` & Visibility-Aware Auto-Pull

We will place `ExternalProviderSyncProvider` and `ExternalProviderSyncToolbar` at the shared Family Budget layout level (`src/app/(main)/dashboard/family-budget/layout.tsx`) so it persists seamlessly as the user navigates between `Accounts & Transactions`, `Budget Overview`, `Income & Taxes`, `Offer Comparator`, `Runway Simulator`, `Mortgage & Home Goal`, `FX & Inflation`, and `Lifestyle` sub-routes.

- **Status Badge**:
  - Green dot: `Synced · <relative time>` (e.g. `Synced · 3m ago`)
  - Amber spinning icon: `Syncing with ExternalProvider… (showing cached data)`
  - Red/Amber warning: `Sync error · showing cached data from <time>`
- **Action Button**: `Pull Fresh Data` (triggers Hot Pull).
- **Settings Popover**:
  - **Sync Actions**: `Hot Pull (Recent)`, `Warm Reconcile (Last 12 Months)`, `Rebuild Full History (All-Time)`.
  - **Hot Pull Window** (saved to `ext_sync_config.hot_pull_months`): `1 Month`, `3 Months (Default)`, `6 Months`, `12 Months`.
  - **Auto-Pull While Page Open** (saved to `ext_sync_config.auto_poll_interval_minutes`): `Off`, `Every 5m`, `Every 15m`, `Every 60m`.
- **Visibility-Aware Timer**:
  - Uses `document.addEventListener("visibilitychange", ...)` + `setInterval`.
  - Never fires network polls while `document.visibilityState === "hidden"`.
  - When the user returns to the tab (`visibilityState === "visible"`), if `Date.now() - lastSyncedAt >= autoPollIntervalMs`, triggers a Hot Pull immediately.

## Risks / Trade-offs

- **[Risk] Initial Full History Bootstrap Duration on Cold Database** → **Mitigation**: ExternalProvider's `/api/transaction/get` supports `take: 500`, so 5,000 transactions require ~10 sequential/batched requests (~3–5 seconds total, well within Vercel's 60s function limit). Furthermore, Hot Pull data (categories, currencies, stats, and latest 300 transactions) is committed first so the UI is usable immediately while the remaining Cold Archive pages finish in the background.
- **[Risk] Supabase Credentials Not Yet Configured in Local Dev** → **Mitigation**: `src/server/external-provider/db.ts` implements a clean adapter pattern: when `SUPABASE_URL` / `DATABASE_URL` is configured, it uses PostgreSQL; when absent in local dev or unit tests, it automatically falls back to a local file/memory store (`.cache/externalProvider-local-db.json` gitignored) so `npm run dev` and `npm test` work out of the box without mandatory cloud setup.

## Migration Plan

1. Add SQL migration (`supabase/migrations/0001_external_provider_sync.sql`) and document the environment variables (`DATABASE_URL` / `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`) in `.env.example` and `.agents/rules/secrets.md`.
2. Deploy server-side persistence, sync engine routes, and `vercel.json` cron configuration.
3. Roll out `IndexedDB` client mirror, `ExternalProviderSyncProvider`, and `ExternalProviderSyncToolbar` in the Family Budget layout while removing redundant per-page refresh strips.
