# Spec Delta

## MODIFIED Requirements

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
