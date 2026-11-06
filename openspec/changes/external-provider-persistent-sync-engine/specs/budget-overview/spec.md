# Spec Delta

## MODIFIED Requirements

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget screens and server synchronization layer SHALL deduplicate concurrent requests, persist ExternalProvider responses in a shared server-side PostgreSQL database and client `IndexedDB` mirror, and use non-destructive stale-while-revalidate (SWR) updates across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads. All Family Budget routes SHALL use the unified sync status and refresh control (`ExternalProviderSyncToolbar`) rather than duplicating per-screen `Live External API Data` and `Refresh Data` header bars. Whenever a category write (`entityJson !== null` to `/Exchange/Ping`) or transaction write (`/api/transaction/create` or `/api/transaction/update`) is sent through the proxy, the system SHALL perform a write-through optimistic upsert to the persistent store and reconcile upstream statistics in the background without wiping existing cached data or unmounting the component tree.

#### Scenario: Initial dashboard load deduplicates shared data across sections

- **WHEN** any Family Budget screen mounts
- **THEN** shared resources (settings, categories/accounts, 40-month budget statistics, and transactions) are hydrated immediately from the shared `ExternalProviderSyncProvider` (`IndexedDB` / PostgreSQL snapshot) at most once rather than refetched independently by child cards

#### Scenario: Switching periods reuses cached 40-month budget statistics

- **WHEN** the user switches between Current Month, Previous Month, or a historical month within the loaded statistics window
- **THEN** the dashboard derives the selected period's category budget, spending metrics, and period transactions from the persisted local dataset without issuing new `/stat/ping` or `/api/transaction/get` network requests

#### Scenario: HMR rebuilds and page reloads serve cached responses within TTL

- **WHEN** a client or server HMR rebuild occurs or the page is reloaded
- **THEN** persisted responses are served immediately from `IndexedDB` and validated against the server database `sync_version` without issuing upstream requests to ExternalProvider or spawning keychain lookup processes unless a sync is requested or due

#### Scenario: On-demand force refresh bypasses caches

- **WHEN** the user clicks the "Pull Fresh Data" action in the unified sync control or a section "Retry" action
- **THEN** existing data remains rendered on screen while fresh data is fetched from the ExternalProvider upstream, merged atomically into the server PostgreSQL database and client `IndexedDB` store, and reflected in place without unmounting the component tree or flashing skeleton loaders

#### Scenario: Category reorder write invalidates cached category reads

- **WHEN** the client sends a category write payload (`entityJson` containing updated categories) to `/api/external-provider/Exchange/Ping`
- **THEN** the server forwards the write to ExternalProvider, immediately upserts the modified categories into PostgreSQL and increments `sync_version`, and triggers a non-destructive background refresh of `/stat/ping` while keeping the updated categories visible

#### Scenario: Transaction write invalidates cached transaction, category, and statistics reads

- **WHEN** the client sends a transaction creation or update request to `/api/external-provider/api/transaction/create` or `/api/external-provider/api/transaction/update`
- **THEN** the server forwards the write to ExternalProvider, immediately upserts the created or modified transaction into PostgreSQL and the client store, and reconciles updated account balances and `/stat/ping` in the background without clearing cached transactions
