# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The screen SHALL display, for the current reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Spent amounts SHALL be resolved from the upstream category's `amount` field, with fallback to `currentAmount` and `value`. Category names SHALL resolve from `title` with fallback to category directory metadata. The statistics query SHALL anchor to the current day (`yyyy-MM-dd`) such that the active calendar month is included in the upstream `Before: 40` window, and point resolution SHALL fallback to the most recent period point when an exact date match is not found. Categories at or above their limit SHALL be visually flagged as overruns.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains category spending points for the selected period
- **THEN** the screen extracts the spent amount from `amount` (or `currentAmount`/`value`) and compares it against `limitAmount`, displaying the category title and amounts in the reporting currency and marking overruns

#### Scenario: Period selection

- **WHEN** the user changes the displayed period (e.g. current month vs previous)
- **THEN** the budget summary and recent-transactions pages refresh for that period using the statistics points anchored to the current day, falling back to the most recent period point if no exact date match exists

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget overview screen and its server proxy SHALL deduplicate concurrent requests and cache upstream ExternalProvider responses with a 5-hour time-to-live (TTL) across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads, while allowing explicit on-demand cache invalidation from the UI. When switching between periods, points SHALL be resolved by ISO date (`id`), falling back to the latest point (`points[0]`) rather than the oldest point.

#### Scenario: Initial dashboard load deduplicates shared data across sections

- **WHEN** the Family Budget screen mounts
- **THEN** shared upstream resources (settings, categories/accounts, 40-month budget statistics, and active-period transactions) are requested at most once per unique resource rather than refetched independently by child cards

#### Scenario: Switching periods reuses cached 40-month budget statistics

- **WHEN** the user switches between Current Month, Previous Month, or a historical month within the already-loaded 40-month statistics window
- **THEN** the dashboard derives the selected period's category budget and spending metrics from the cached statistics payload without issuing a new `/stat/ping` request, and only requests transactions for the selected period if not already cached

#### Scenario: HMR rebuilds and page reloads serve cached responses within TTL

- **WHEN** a client or server HMR rebuild occurs or the page is reloaded within the 5-hour cache TTL
- **THEN** cached responses are served without issuing duplicate upstream requests to ExternalProvider or spawning duplicate keychain lookup processes

#### Scenario: On-demand force refresh bypasses caches

- **WHEN** the user clicks the "Refresh Data" action in the dashboard header or a section "Retry" action
- **THEN** both client and server proxy caches are bypassed for the refreshed resources, fresh data is fetched from the ExternalProvider upstream, the cache entries are updated, and the dashboard updates in place without unmounting the component tree

## ADDED Requirements

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, and year-over-year trends. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks

- **WHEN** `transformExpenses` receives statistics categories with `amount`, `currentAmount`, or `value`, or missing metadata names
- **THEN** the transformed expenses accurately extract the non-zero spent amounts and category names without defaulting to zero

#### Scenario: Unit tests validate date parsing across historical points

- **WHEN** `parsePointDate` and YoY transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`)
- **THEN** valid Date objects are returned and historical spending is aggregated without dropping points or producing `Invalid Date`
