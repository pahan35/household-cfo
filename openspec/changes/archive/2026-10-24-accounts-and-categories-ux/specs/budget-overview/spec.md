# Spec Delta

## MODIFIED Requirements

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards, debt accounts) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable, and sorted ascending by ExternalProvider's `order` property (`category.order`). Money SHALL be presented in the category's currency or the default currency from settings. Users SHALL be able to drag-and-drop reorder accounts, which SHALL persist the updated `order` values upstream via `/Exchange/Ping` so that the order is updated across ExternalProvider mobile and web apps. Accounts whose name starts with `_` and whose balance is `0` SHALL be hidden by default and viewable on demand via a toggle; accounts whose name starts with `_` and whose balance is non-zero SHALL always remain visible with a warning indicator and reconciliation guidance. Each account row SHALL also display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's counterpart (source or target), amount, comment, and tags.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances and `order` values
- **THEN** each active account is shown in ascending `category.order` sequence with its balance rendered in the appropriate currency

#### Scenario: Reordering accounts persists upstream to ExternalProvider

- **WHEN** the user drags an account row to a new position in the accounts list
- **THEN** the UI immediately reflects the new order and sends the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`, updating the canonical category state

#### Scenario: Zero-balance `_` prefixed accounts hidden by default and shown on demand

- **WHEN** the upstream returns an account whose name starts with `_` and whose balance is `0`
- **THEN** the account is omitted from the default view and becomes visible when the user activates the "Show archived" toggle

#### Scenario: Non-zero-balance `_` prefixed accounts remain visible with reconciliation warning

- **WHEN** the upstream returns an account whose name starts with `_` and whose balance is not `0`
- **THEN** the account remains visible even when archived accounts are hidden, displays a warning icon, and on hover/focus explains how to reconcile the balance to `0` in the ExternalProvider app

#### Scenario: Viewing last transaction details on an account

- **WHEN** an account has at least one recorded transaction and the user views the account row or hovers/focuses the last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart category (source or destination), formatted amount, comment (if any), and tags (if any)

#### Scenario: No accounts defined

- **WHEN** the upstream returns no account-type categories
- **THEN** the accounts section shows an empty state with guidance to add accounts in ExternalProvider

### Requirement: Budget spent-versus-limit summary

The screen SHALL display, for the current reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Categories at or above their limit SHALL be visually flagged as overruns. By default, budget categories SHALL be sorted ascending by ExternalProvider's `category.order` (with an option to sort by percentage spent), and users SHALL be able to drag-and-drop reorder categories in custom-order mode, persisting the updated `order` values upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category `currentAmount` and `limitAmount` values for the selected period
- **THEN** the screen shows each category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency and marks categories exceeding their limit

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags a budget category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), formatted amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user changes the displayed period (e.g. current month vs previous)
- **THEN** the budget summary and recent-transactions pages refresh for that period

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget overview screen and its server proxy SHALL deduplicate concurrent requests and cache upstream ExternalProvider responses with a 5-hour time-to-live (TTL) across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads, while allowing explicit on-demand cache invalidation from the UI and automatically invalidating cached category reads whenever a category write (`entityJson !== null`) is sent to `/Exchange/Ping`.

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
- **THEN** the server proxy bypasses caching for the write request, invalidates cached `/Exchange/Ping` entries in the proxy cache, and the client updates its cached `categories` entry with the latest category state
