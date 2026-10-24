# Spec Delta

## ADDED Requirements

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget overview screen and its server proxy SHALL deduplicate concurrent requests and cache upstream ExternalProvider responses with a 5-hour time-to-live (TTL) across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads, while allowing explicit on-demand cache invalidation from the UI.

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
