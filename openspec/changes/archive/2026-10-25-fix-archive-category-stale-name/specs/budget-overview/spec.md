# Spec Delta: Budget Overview

## MODIFIED Requirements

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget overview screen and its server proxy SHALL deduplicate concurrent requests and cache upstream ExternalProvider responses with a 5-hour time-to-live (TTL) across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads, while allowing explicit on-demand cache invalidation from the UI and automatically invalidating cached category, transaction, and statistics reads whenever a category write (`entityJson !== null` to `/Exchange/Ping`) or transaction write (`/api/transaction/create` or `/api/transaction/update`) is sent through the proxy.

#### Scenario: Initial dashboard load deduplicates shared data across sections
- **WHEN** the Family Budget screen mounts
- **THEN** shared upstream resources (settings, categories/accounts, 40-month budget statistics, and active-period/recent transactions) are requested at most once per unique resource rather than refetched independently by child cards

#### Scenario: Switching periods reuses cached 40-month budget statistics
- **WHEN** the user switches between Current Month, Previous Month, or a historical month within the already-loaded 40-month statistics window
- **THEN** the dashboard derives the selected period's category budget and spending metrics from the cached statistics payload without issuing a new `/stat/ping` request, and only requests transactions for the selected period if not already cached

#### Scenario: HMR rebuilds and page reloads serve cached responses within TTL
- **WHEN** a client or server HMR rebuild occurs or the page is reloaded within the 5-hour cache TTL
- **THEN** cached responses are served without issuing duplicate upstream requests to ExternalProvider or spawning duplicate keychain lookup processes

#### Scenario: On-demand force refresh bypasses caches
- **WHEN** the user clicks the "Refresh Data" action in the dashboard header or a section "Retry" action
- **THEN** both client and server proxy caches are bypassed for the refreshed resources, fresh data is fetched from the ExternalProvider upstream, the cache entries are updated, and the dashboard updates in place without unmounting the component tree

#### Scenario: Category reorder write invalidates cached category reads
- **WHEN** the client sends a category write payload (`entityJson` containing updated categories) to `/api/external-provider/Exchange/Ping`
- **THEN** the server proxy bypasses caching for the write request, invalidates cached `/Exchange/Ping` and `/stat/ping` entries in the proxy cache, and the client updates its cached `categories` entry while purging client-side `stat:*` cache entries so subsequent reads reflect updated category ordering and names

#### Scenario: Transaction write invalidates cached transaction, category, and statistics reads
- **WHEN** the client sends a transaction creation or update request to `/api/external-provider/api/transaction/create` or `/api/external-provider/api/transaction/update`
- **THEN** the server proxy bypasses caching for the write request and invalidates cached `/api/transaction/get`, `/Exchange/Ping`, and `/stat/ping` entries so subsequent reads reflect updated account balances and transaction history

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, year-over-year trends, and transaction running balance calculation. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks
- **WHEN** `transformExpenses` and `computeBudgetSummaryItems` receive statistics categories with `value`, `amount`, or `currentAmount`, alongside a `categoryNameMap`
- **THEN** the transforms prioritize period-specific `value` over static category `amount` snapshots (falling back to `amount` and `currentAmount` only when `value` is absent) and prioritize canonical names from `categoryNameMap` over snapshot `cat.title` and `cat.name` fields, accurately extracting non-zero spent amounts and category names without defaulting to zero or retaining stale category names

#### Scenario: Unit tests validate date parsing across historical points
- **WHEN** `parsePointDate` and YoY/chronological transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`) where `amount` holds a constant current-month snapshot while `value` varies per period
- **THEN** valid Date objects are returned, historical spending is aggregated from `value` without dropping points or producing `Invalid Date`, and YoY deltas reflect true period-over-period variance

#### Scenario: Unit tests validate transaction running balance calculation with upstream payloads
- **WHEN** `computeTransactionsWithRunningBalance` and `getAccountBalance` process accounts containing non-zero `amount` alongside upstream `currentAmount: 0.0`
- **THEN** initial balances anchor to `amount` rather than `0.0`, and running balances calculate backwards from the live account balance
