# budget-overview Specification

## Purpose

Provides a family budget overview screen that turns the verified ExternalProvider upstream data (accounts, transactions, budgets, settings) into a single live dashboard, replacing template-only finance screens as the first real-data screen in the app.

## Requirements

### Requirement: Family Budget screen navigation

The dashboard sidebar SHALL include a top-level "Family Budget" group positioned above the template "Dashboards" group. The "Family Budget" group SHALL include an "Overview" entry that navigates to `/dashboard/family-budget` and an "FX & Inflation" entry that navigates to `/dashboard/family-budget/fx-inflation`, and both routes SHALL render screens following the dashboard shell and visual conventions of nearby screens (finance reference).

#### Scenario: Navigating to the screen

- **WHEN** the user clicks "Overview" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget` loads and displays the overview sections

#### Scenario: Navigating to the FX & Inflation Analysis screen

- **WHEN** the user clicks "FX & Inflation" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/fx-inflation` loads and displays the macroeconomic inflation and USD/PLN sensitivity analysis sections

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable. Money SHALL be presented in the default currency from settings.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances
- **THEN** each account is shown by name with its balance rendered in the reporting currency

#### Scenario: No accounts defined

- **WHEN** the upstream returns no account-type categories
- **THEN** the accounts section shows an empty state with guidance to add accounts in ExternalProvider

### Requirement: Recent transactions list

The screen SHALL display the most recent transactions in reverse-chronological order, each showing its date, direction-aware amount (income vs expense visually distinguishable), and the counterpart category or comment. Additional older transactions SHALL be retrievable via paging.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData`
- **THEN** a first page of transactions is listed newest-first with date, amount (signed, currency-formatted), and counterpart or comment

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page is fetched with the continuation and appended without duplicating already-shown items

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions
- **THEN** the transactions section shows an empty state

### Requirement: Budget spent-versus-limit summary

The screen SHALL display, for the current reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Spent amounts SHALL be resolved from the upstream category's `amount` field, with fallback to `currentAmount` and `value`. Category names SHALL resolve from `title` with fallback to category directory metadata. The statistics query SHALL anchor to the current day (`yyyy-MM-dd`) such that the active calendar month is included in the upstream `Before: 40` window, and point resolution SHALL fallback to the most recent period point when an exact date match is not found. Categories at or above their limit SHALL be visually flagged as overruns.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains category spending points for the selected period
- **THEN** the screen extracts the spent amount from `amount` (or `currentAmount`/`value`) and compares it against `limitAmount`, displaying the category title and amounts in the reporting currency and marking overruns

#### Scenario: Period selection

- **WHEN** the user changes the displayed period (e.g. current month vs previous)
- **THEN** the budget summary and recent-transactions pages refresh for that period using the statistics points anchored to the current day, falling back to the most recent period point if no exact date match exists

### Requirement: Money and date presentation

Amounts SHALL be formatted in the screen's reporting currency (from settings, falling back to the stats response currency), and transaction timestamps SHALL be shown using the ISO variant provided by the upstream, displayed with existing project date formatting.

#### Scenario: Currency from settings

- **WHEN** settings report a default currency and a transaction excludes no explicit currency
- **THEN** amounts render with that currency's symbol/format

### Requirement: Loading, empty, and error states

The screen SHALL show loading placeholders while data is being fetched, SHALL render self-explanatory empty states when a section has no data, and SHALL on fetch or upstream failure render an error message identifying the failing section with a retry action, without exposing any credential values in the UI.

#### Scenario: Upstream failure on one section

- **WHEN** one data source returns an error (e.g. HTTP 500/502 from the proxy) while others succeed
- **THEN** the affected section shows an error state with a retry action while unaffected sections render their data

#### Scenario: Retry after failure

- **WHEN** the user triggers retry on a failed section
- **THEN** that section refetches and re-renders without reloading the whole screen

### Requirement: Credential-safe data access

All upstream access from this screen SHALL go through the local proxy path `/api/external-provider/...`; the client SHALL NOT send any credential, and error output rendered in the UI MUST remain scrubbed of credentials as established by the proxy.

#### Scenario: No credentials in client traffic

- **WHEN** any request from the screen is inspected
- **THEN** it targets `/api/external-provider/...` and contains no token, cookie, or user-id credential material

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expense Composition Pie/Donut Chart card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset.

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive pie chart renders with slices proportional to each category's spent amount, formatted in the reporting currency

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the pie chart
- **THEN** the tooltip displays the category name, spent amount, percentage of controllable expenses, and budget limit if configured

#### Scenario: Quick exclusion toggle on the chart card
- **WHEN** the user toggles the quick "Exclude Rent" switch on the pie chart card
- **THEN** the pie chart recalculates immediately with the category omitted or restored without navigating away

### Requirement: Net income and controllable expense metrics

The Family Budget overview dashboard SHALL display key summary metrics reflecting the active exclusion preset, including Gross Income, Net Disposable Income (after tax deductions), and Controllable Expenses.

#### Scenario: Overview metric presentation
- **WHEN** the dashboard renders with the active period data
- **THEN** the metrics display the calculated Net Disposable Income, total Controllable Expenses, and the remaining net cash flow margin

### Requirement: Year-over-Year trends chart section

The Family Budget overview dashboard SHALL include an interactive Year-over-Year Trends section displaying multi-year spending and income patterns over the available timeline.

#### Scenario: Visualizing multi-year trends
- **WHEN** the dashboard renders with historical data loaded
- **THEN** an interactive chart renders showing monthly controllable spending or net income across available years with distinct visual series per year

#### Scenario: Switching trend display modes
- **WHEN** the user switches between monthly time-series view and side-by-side Year-over-Year comparison view
- **THEN** the chart transitions smoothly to display the selected aggregation format

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

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, and year-over-year trends. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks

- **WHEN** `transformExpenses` receives statistics categories with `amount`, `currentAmount`, or `value`, or missing metadata names
- **THEN** the transformed expenses accurately extract the non-zero spent amounts and category names without defaulting to zero

#### Scenario: Unit tests validate date parsing across historical points

- **WHEN** `parsePointDate` and YoY transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`)
- **THEN** valid Date objects are returned and historical spending is aggregated without dropping points or producing `Invalid Date`



