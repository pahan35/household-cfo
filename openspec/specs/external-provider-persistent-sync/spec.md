# external-provider-persistent-sync Specification

## Purpose
Provides shared server-side PostgreSQL persistence (Supabase) and browser `IndexedDB` caching for ExternalProvider financial data, implementing hot/warm/cold partitioned delta synchronization, stale-while-revalidate eventual consistency without empty states, a nightly scheduled sync job, and a unified UI sync control with server-persisted configuration.

## Requirements

### Requirement: Shared server-side PostgreSQL persistence for ExternalProvider entities and sync configuration

The system SHALL persist ExternalProvider financial entities (`settings`, `currencies`, `categories`, `transactions`, and monthly `stat_points`) and household synchronization configuration in a shared server-side PostgreSQL database (Supabase). Each persisted entity record MUST preserve its full upstream ExternalProvider JSON payload (`raw_json`) alongside indexed relational columns (`id`, timestamps, category/account identifiers, `deleted` flag) so that any upstream write operation (`updateTransaction`, `updateCategoriesOrder`) retains all required ExternalProvider properties without data loss. When database credentials are not configured in local development, the server SHALL fall back transparently to a local disk/in-memory store without failing requests.

#### Scenario: Serving household members from shared server persistence on cold browser load

- **WHEN** a household member opens any Family Budget screen in a fresh browser session and the server database already holds synchronized ExternalProvider data
- **THEN** the server returns the persisted settings, categories, currencies, statistics points, and transactions directly from PostgreSQL without blocking on upstream ExternalProvider HTTP requests

#### Scenario: Lossless round-trip of ExternalProvider entity payloads

- **WHEN** a category or transaction is stored in PostgreSQL and later retrieved to perform an upstream mutation (such as updating tags via `/api/transaction/update` or reordering categories via `/Exchange/Ping`)
- **THEN** all original upstream ExternalProvider fields on the entity (including `.NET` ticks timestamps, flags, and metadata) are preserved intact from `raw_json`

#### Scenario: Server-persisted sync configuration shared across household devices

- **WHEN** a user updates the Hot Pull window (e.g. `1m`, `3m`, `6m`, `12m`) or the auto-pull interval (`Off`, `5m`, `15m`, `60m`) in the UI sync settings
- **THEN** the system persists the updated configuration in a dedicated server database table (`ext_sync_config`), increments the configuration state, and applies those settings across sessions for all authorized household users

### Requirement: Hot, Warm, and Cold partitioned synchronization engine

The server synchronization engine SHALL execute through the configured `ExternalProviderUpstreamAdapter`:
- When `EXTERNAL_API_ADAPTER` is `"external-provider"`, the engine SHALL partition ExternalProvider data fetching into three tiers based on data age and mutation frequency:
  1. **Hot Pull (default: `3` months, user-configurable to `1`, `3`, `6`, or `12` months)**: Batches `ExchangeKey.Category` (2) and `ExchangeKey.Currency` (4) into a single `/Exchange/Ping` request, fetches `/settings/get` and the active `/stat/ping` series, and fetches transactions within the configured Hot Pull window (using a lightweight top-page watermark probe first and paging only through new or updated transactions).
  2. **Warm Reconcile (trailing `12` months)**: Reconciles all transactions and monthly statistics points across the trailing 12 months to capture backfilled transactions entered on stale accounts, purging or marking `deleted: true` any transaction removed upstream within that window.
  3. **Cold Archive (older than `12` months)**: Treats transactions and monthly statistics points older than 12 months as immutable historical archive records that are never re-fetched during Hot Pulls or Warm Reconciles, and are only downloaded during initial database bootstrap (when the database is empty) or when the user explicitly triggers a "Rebuild Full History" sync.
- When `EXTERNAL_API_ADAPTER` is `"mock"`, the synchronization engine SHALL operate directly against the mock persistence store (seeding initial data if `sync_version === 0`, recomputing monthly `stat_points`, and updating sync metadata) without issuing external network requests to `api.external-provider.example.com`.

#### Scenario: Fast no-op Hot Pull when no upstream changes occurred

- **WHEN** a Hot Pull is triggered and the top page of upstream transactions (`/api/transaction/get` with `skip: 0, take: 50`) has identical IDs and modification `.NET` ticks (`timestamp`) to the server database watermark, and category balances in `/Exchange/Ping` are unchanged
- **THEN** the sync engine completes without paging older transactions, updates `last_synced_at`, and reports zero changed records

#### Scenario: Hot Pull downloads newly added or edited recent transactions

- **WHEN** a Hot Pull is triggered and new or modified transactions exist within the configured Hot Pull window (default 3 months)
- **THEN** the sync engine fetches pages up to the Hot Pull cutoff (or until reaching known unmodified watermarked transactions), upserts the new and modified records into PostgreSQL, updates `sync_version` and `last_synced_at`, and leaves Cold Archive records (`> 12` months) untouched

#### Scenario: Warm Reconcile captures backfilled transactions on stale accounts up to 1 year old

- **WHEN** a user enters historical transactions for a stale account dated up to 12 months ago in ExternalProvider and triggers a "Warm Reconcile (12m)" (or the nightly job detects a balance discrepancy)
- **THEN** the sync engine pages through the trailing 12-month transaction window (`period.from = NOW - 12 months`), upserts all newly discovered or edited transactions into PostgreSQL, and refreshes the corresponding monthly `/stat/ping` points

#### Scenario: Initial bootstrap or explicit Full History Rebuild populates Cold Archive

- **WHEN** the server database has never completed an initial full seed (`last_full_reconcile_at` is null) or the user triggers "Rebuild Full History"
- **THEN** the sync engine pages through all historical transactions from ExternalProvider (`batches of 500`) and stores the complete multi-year ledger in PostgreSQL

#### Scenario: Sync execution in mock adapter mode

- **WHEN** `runExternalProviderSync` is invoked while `EXTERNAL_API_ADAPTER` is `"mock"`
- **THEN** the adapter seeds the mock database if empty, reconciles category balances and monthly `stat_points` locally in the mock store, updates `last_synced_at`, and returns a successful `ExternalProviderSyncResult` without calling `api.external-provider.example.com`

### Requirement: Browser IndexedDB mirror and versioned delta bootstrap

The client data layer SHALL maintain a local `IndexedDB` mirror of the normalized ExternalProvider dataset (`settings`, `currencies`, `categories`, `statPoints`, `transactions`, and `syncVersion`) and serve all dashboard screens and transaction queries (`getTransactionPage` filtering by period, category IDs, account IDs, and pagination) from the unified local dataset once hydrated.

#### Scenario: Instantaneous startup from IndexedDB with versioned server revalidation

- **WHEN** a user loads or reloads any Family Budget screen in a browser that has a populated `IndexedDB` cache
- **THEN** the UI renders immediately from the `IndexedDB` snapshot without displaying loading skeletons, and concurrently requests `/api/external-provider/sync/state?sinceVersion=<localSyncVersion>` from the server

#### Scenario: Lightweight check when browser IndexedDB matches server syncVersion

- **WHEN** the browser requests `/api/external-provider/sync/state?sinceVersion=<localSyncVersion>` and the server's `sync_version` equals `<localSyncVersion>`
- **THEN** the server responds with an lightweight up-to-date confirmation (`upToDate: true` / `304`), transferring no entity arrays over the network

#### Scenario: Client transaction queries execute locally without extra network round-trips

- **WHEN** any dashboard screen or component (such as `BudgetOverviewDashboard`, `IncomeDashboard`, `LifestyleDataProvider`, `CategoryExpenseTraceSheet`, or `RecentTransactionsCard`) queries transactions by date period, category IDs, account ID, or page size
- **THEN** the client resolves the query from the hydrated local transaction ledger in memory/`IndexedDB` without issuing fragmented `POST /api/transaction/get` requests to ExternalProvider

### Requirement: Stale-while-revalidate eventual consistency and write-through mutations

The system MUST preserve existing data on screen at all times during background refreshes, manual pulls, and post-mutation reconciliations. Neither the client nor the server SHALL delete cached records prior to receiving replacement data. When a user performs a mutation (`createTransaction`, `updateTransaction`, `updateCategoriesOrder`), the system SHALL immediately persist the optimistic/updated entity to both the client state/`IndexedDB` and the server PostgreSQL database (`write-through`), surface a non-blocking `Syncing / Reconciling` status indicator, and reconcile upstream statistics and balances in the background without unmounting components or causing temporary gaps in displayed data.

#### Scenario: Background or manual refresh keeps existing dashboard data visible

- **WHEN** a manual "Pull Fresh Data", scheduled auto-pull, or background revalidation is in progress
- **THEN** all dashboard cards, charts, and transaction lists remain visible and interactive with the current cached data while the unified sync indicator displays that an update is in progress

#### Scenario: Write-through consistency immediately after creating or updating a transaction or category

- **WHEN** a user creates a transaction, updates transaction tags, or reorders/renames/archives categories
- **THEN** the mutated transaction or category is immediately upserted into the server database and local store before background reconciliation completes, ensuring that subsequent reads or page reloads never experience a gap where the newly written change disappears while ExternalProvider recalculates upstream state

#### Scenario: Upstream failure during refresh preserves cached state

- **WHEN** an upstream ExternalProvider request fails (e.g. `502`, network timeout, or `401` stale credentials) during a refresh
- **THEN** the system retains and continues displaying the last known good dataset from PostgreSQL/`IndexedDB` and surfaces a non-destructive sync warning badge/toast rather than replacing the dashboard with an error screen

### Requirement: Nightly scheduled ExternalProvider delta sync job

The application SHALL expose a scheduled cron endpoint (`/api/external-provider/cron/daily-sync`) configured in `vercel.json` to execute once daily at night (`0 3 * * *` UTC) and secured via `CRON_SECRET` bearer authentication. The job SHALL check ExternalProvider for new or modified transactions and category balance changes, download and upsert any changes into the server PostgreSQL database, and record the execution timestamp and result in `ext_sync_config`.

#### Scenario: Unauthorized request to cron endpoint is rejected

- **WHEN** a caller invokes `/api/external-provider/cron/daily-sync` without a valid `Authorization: Bearer <CRON_SECRET>` header (and without an authenticated family session)
- **THEN** the endpoint returns `401 Unauthorized` without contacting ExternalProvider or the database

#### Scenario: Nightly cron detects and downloads new transactions

- **WHEN** the nightly cron job executes and ExternalProvider has new transactions or modified category balances since the last `sync_version`
- **THEN** the job downloads the new/updated transactions, categories, currencies, and current `/stat/ping` series, upserts them into PostgreSQL, increments `sync_version`, and logs the summary of synced items

#### Scenario: Nightly cron detects account balance change without recent hot-window transactions

- **WHEN** the nightly cron job detects that an account's `amount` balance in `/Exchange/Ping` changed compared to the persisted database record, but no new transactions appeared in the hot window probe
- **THEN** the nightly job automatically escalates to a 12-month Warm Reconcile to download any backfilled transactions entered on stale accounts

### Requirement: Unified UI sync control and configurable visibility-aware auto-pull

All Family Budget dashboard routes SHALL share a single unified sync status and control toolbar (`ExternalProviderSyncToolbar`) in place of per-screen `Live External API Data` badges and `Refresh Data` buttons. The control SHALL display the current freshness state (`Synced <relative time>`, `Syncing with ExternalProvider…`, or `Stale / Offline (showing cached data)`), provide a one-click `Pull Fresh Data` button, and offer a configuration popover where the user can trigger `Hot Pull`, `Warm Reconcile (12m)`, or `Rebuild Full History`, configure the Hot Pull window (`1m`, `3m`, `6m`, `12m`), and opt in to automatic background pulling every `5`, `15`, or `60` minutes (`Off` by default).

#### Scenario: Visibility-aware auto-pull while user actively uses the web page

- **WHEN** the user enables auto-pull (e.g. every `15` minutes) in the sync control
- **THEN** the browser triggers a background Hot Pull every 15 minutes while `document.visibilityState === "visible"`, pauses timer execution when the tab is hidden or minimized to conserve Vercel and ExternalProvider quota, and triggers an immediate pull upon the tab becoming visible again if the configured interval has elapsed since `last_synced_at`

#### Scenario: Single-flight deduplication across concurrent triggers

- **WHEN** a user clicks `Pull Fresh Data` while a background auto-pull or another household member's sync is already in flight on the server
- **THEN** the server coalesces the concurrent sync requests into the single in-flight upstream operation and returns the resulting state to all callers
