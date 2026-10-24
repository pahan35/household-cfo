# budget-overview Specification

## Purpose

Provides a family budget overview screen that turns the verified ExternalProvider upstream data (accounts, transactions, budgets, settings) into a single live dashboard, replacing template-only finance screens as the first real-data screen in the app.

## Requirements

### Requirement: Family Budget screen navigation

The dashboard sidebar SHALL include a top-level "Family Budget" group positioned above the template "Dashboards" group. The "Family Budget" group SHALL include an "Accounts & Transactions" entry that navigates to `/dashboard/family-budget`, a "Budget Overview" entry that navigates to `/dashboard/family-budget/budget-overview`, an "Income & Taxes" entry that navigates to `/dashboard/family-budget/income`, and an "FX & Inflation" entry that navigates to `/dashboard/family-budget/fx-inflation`, and all routes SHALL render screens following the dashboard shell and visual conventions of nearby screens (finance reference). The `/dashboard/family-budget` screen SHALL focus on account liquidity, accounts management, and all-time transaction review without a header month selector, while `/dashboard/family-budget/budget-overview` SHALL house the period selector, net income and controllable expense metrics, expense composition pie chart, year-over-year trends chart, and budget spent-versus-limit summary.

#### Scenario: Navigating to the screen

- **WHEN** the user clicks "Accounts & Transactions" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget` loads and displays the account liquidity metrics, accounts and cards section, and all-time transactions feed without a header month selector

#### Scenario: Navigating to the Budget Overview screen

- **WHEN** the user clicks "Budget Overview" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/budget-overview` loads and displays the period selector, net income and controllable expense metrics strip, expense composition pie chart, year-over-year trends chart, and budget spent-versus-limit summary

#### Scenario: Navigating to the Income & Taxes screen

- **WHEN** the user clicks "Income & Taxes" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/income` loads and displays the income and tax metrics strip, income sources management card, tax breakdown and audit card, and filtered transaction ledger

#### Scenario: Navigating to the FX & Inflation Analysis screen

- **WHEN** the user clicks "FX & Inflation" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/fx-inflation` loads and displays the macroeconomic inflation and USD/PLN sensitivity analysis sections

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards, debt accounts) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable (including badging `Debt:` / `_Debt:` standard accounts as Throwaway Clearing Accounts), and sorted ascending by ExternalProvider's `order` property (`category.order`). Money SHALL be presented in the category's currency or the default currency from settings. Users SHALL be able to click an account row to filter the transactions list to that account (and click again or clear the filter to restore the all-accounts view), and when a Throwaway Clearing Account (`Debt:` or `_Debt:`) is selected, the screen SHALL surface the Clearing Ledger Workbench for that account. Users SHALL also be able to initialize a new Throwaway Clearing Account (`Debt: <Person/Deal>`) directly from the Accounts & Cards header action. Users SHALL be able to drag-and-drop reorder accounts, which SHALL persist the updated `order` values upstream via `/Exchange/Ping` so that the order is updated across ExternalProvider mobile and web apps. Accounts whose name starts with `_` and whose balance is `0` SHALL be hidden by default and viewable on demand via a toggle; accounts whose name starts with `_` and whose balance is non-zero SHALL always remain visible with a warning indicator and reconciliation guidance. Each account row SHALL also display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's counterpart (source or target), amount, comment, and tags. Users SHALL be able to archive an active account via a row action, which SHALL prompt for confirmation, prefix the account name with `_`, move it to the very end of the account order list, and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to unarchive an archived account, which SHALL strip the leading `_` prefix, move it to become the last non-archived account (immediately preceding the first archived account), and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to reposition active accounts located below archived accounts to immediately above the first archived account individually via a row action or collectively via a batch action banner, preserving relative order and persisting updated orders to `/Exchange/Ping`.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances and `order` values
- **THEN** each active account is shown in ascending `category.order` sequence with its balance rendered in the appropriate currency

#### Scenario: Clicking an account filters transactions by that account

- **WHEN** the user clicks an account row in the accounts list
- **THEN** the account row is visually marked as selected and the transactions section filters to show all-time transactions involving that account

#### Scenario: Selecting a throwaway debt account opens the clearing ledger workbench

- **WHEN** the user selects a Throwaway Clearing Account (`Debt: <Name>`) in the accounts list or triggers "Open Clearing Ledger" from its row action menu
- **THEN** the Clearing Ledger Workbench opens for that account alongside its filtered transactions feed

#### Scenario: Clearing the selected account filter

- **WHEN** an account is currently selected and the user clicks the selected account row again or activates the "Clear filter" control in the transactions section
- **THEN** the account selection is cleared and the transactions section returns to showing transactions across all accounts

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

#### Scenario: Archiving an active account

- **WHEN** the user selects "Archive account" from an active account's row action menu and confirms the action in the confirmation dialog
- **THEN** the account name is prefixed with `_`, the account is moved to the end of the accounts group, subsequent accounts shift up, updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Cancelling account archiving

- **WHEN** the user opens the archive confirmation dialog for an account and clicks Cancel
- **THEN** the dialog closes, no changes are made to the account name or order, and no upstream requests are sent

#### Scenario: Unarchiving an archived account

- **WHEN** the user selects "Unarchive account" from an archived account's row action menu
- **THEN** the leading `_` is removed from the account name, the account is moved to become the last non-archived account (immediately preceding the first archived account), updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Moving an active account above archived accounts via row action

- **WHEN** an active account is positioned after one or more archived accounts and the user selects "Move above archived" from its row action menu
- **THEN** that account is moved immediately preceding the first archived account, intermediate accounts shift accordingly, updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Batch moving active accounts above archived accounts

- **WHEN** one or more active accounts are positioned below archived accounts and the user activates the batch "Move above archived" action in the card banner
- **THEN** all active accounts below archived accounts are moved as a block immediately preceding the first archived account preserving their relative order, updated entities are sent upstream via `/Exchange/Ping`, and the banner is dismissed

### Requirement: Recent transactions list

The screen SHALL display all-time transactions in reverse-chronological order (either across all accounts or filtered by a selected account via `categoryIds`), each showing its date, explicit source and target names (`Source -> Target`) resolved from the categories lookup when omitted from the raw transaction payload, direction-aware amount in the account's native currency, any comment or tags, and the running balance of the involved account after that transaction in the account's currency. Running balances SHALL be anchored on the account's live balance (`category.amount`), correctly resolving against upstream payloads that include `currentAmount: 0.0`. Additional older transactions SHALL be retrievable via incremental "Load more" paging whenever `hasMoreData` is true.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData` and account categories with `amount` and `currentAmount: 0.0`
- **THEN** a first page of transactions is listed newest-first with date, resolved source and target category names (`Source -> Target`), direction-aware amount in the account's native currency, comment/tags (if any), and the calculated running balance of the account immediately after that transaction anchored on the account's live balance (`amount`)

#### Scenario: Filtering transactions by selected account

- **WHEN** an account is selected in the accounts list
- **THEN** the transactions list fetches and displays transactions for that `accountId`, shows an active filter indicator with the account's name and current balance in its native currency (extracted from `amount`), and displays the account's running balance after each transaction

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page of older transactions (globally or for the selected account) is fetched with the continuation (`skip`), appended without duplicating already-shown items, and running account balances are continuously calculated across the appended rows

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions for the current view or selected account
- **THEN** the transactions section shows an empty state (with an option to clear the account filter if one is active)

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display, for the selected reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. The summary SHALL strictly include only expense categories (`CategoryType.Expense`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories. Categories at or above their limit SHALL be visually flagged as overruns. By default, budget categories SHALL be sorted ascending by ExternalProvider's `category.order` (with an option to sort by percentage spent), and users SHALL be able to drag-and-drop reorder categories in custom-order mode, persisting the updated `order` values upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency, marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

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

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card

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

The Family Budget overview dashboard SHALL include an interactive Expenses Breakdown (pie/donut chart) card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, surfacing available cash capacity, supporting smart category grouping for Transport and Taxi, and showing per-category deltas and variance sorting when a comparison baseline period is active.

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive card titled "Expenses Breakdown" renders with slices proportional to each included category's spent amount, formatted in the reporting currency, and an inner donut label displaying total included expenses

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the Expenses Breakdown chart
- **THEN** the tooltip displays the category or group name, spent amount, percentage of included expenses, and budget limit if configured

#### Scenario: Quick exclusion toggle on the chart card
- **WHEN** the user toggles the quick "Exclude Rent" switch on the Expenses Breakdown card
- **THEN** the pie chart recalculates immediately with the category omitted or restored without navigating away, and Net Cash Margin remains invariant

#### Scenario: Category comparison deltas and variance sorting
- **WHEN** a comparison baseline month is active on the Budget Overview screen
- **THEN** each category row in the Expenses Breakdown card displays its spending delta (`+PLN` / `-PLN` and `%`) relative to the baseline month, and the user can sort the category list by total spent or by biggest increase/decrease

#### Scenario: Header badge summary displays cash left
- **WHEN** the Expenses Breakdown card renders with active data and exclusion presets
- **THEN** the card summary strip displays badges for Controllable/Included spending, Excluded fixed spending (if any), and Cash Left (`Net Disposable Income - Total Living Expenses`)

#### Scenario: Smart grouping for Transport and Taxi
- **WHEN** the household has both regular transit (e.g. `Transport PLN`) and ride-hailing (e.g. `Taxi PLN`) categories
- **THEN** the system links both categories into a smart "Transport" group, aggregating them into a unified "Transport (incl. Taxi)" slice on the donut chart when either falls below the minor-slice threshold (< 3%), and displaying distinct child line items under the Transport group header in the breakdown legend

### Requirement: Net income and controllable expense metrics

The Family Budget overview dashboard SHALL display key summary metrics reflecting the active exclusion preset, including Gross Income, Net Disposable Income (after tax deductions), Controllable Expenses (with available pool and cash left), and invariant Net Cash Margin, along with inline comparison deltas when a comparison baseline month is active.

#### Scenario: Overview metric presentation
- **WHEN** the dashboard renders with the active period data
- **THEN** the metrics display the calculated Gross Income, Net Disposable Income, total Controllable Expenses, and the remaining Net Cash Margin

#### Scenario: Invariant Net Cash Margin regardless of category exclusions
- **WHEN** the user toggles category exclusions (e.g., toggles "Exclude Rent" or changes exclusion preset)
- **THEN** the calculated Net Cash Margin remains unchanged at `Net Disposable Income - Total Living Expenses` (`grossIncome - totalGrossExpense`), because excluding an item from the breakdown diagram does not eliminate the incurred expense

#### Scenario: Controllable Expenses card surfaces pool and cash left
- **WHEN** the Controllable Expenses metric card renders
- **THEN** it displays the total spent on included controllable expenses, with supporting subtext showing the available controllable budget pool (`Net Disposable Income - Excluded Non-Controllable Expenses`) and remaining cash left (`Available Pool - Controllable Expenses`)

#### Scenario: Overview metric comparison deltas
- **WHEN** a comparison baseline month is selected in the header (`Previous Month`, `Same Month Last Year`, or a custom historical month)
- **THEN** each metric card in the strip displays the absolute (`+PLN` / `-PLN`) and percentage (`%`) change against the baseline month with directional indicators

### Requirement: Unified Month & Year Picker and in-place period comparison

The Budget Overview screen header SHALL provide a unified Month & Year Picker that allows selecting any month available in the loaded `/stat/ping` series (via previous/next month steppers, a year-and-month popover grid, or quick `Current Month` / `Previous Month` actions) and an in-place `Compare vs` baseline selector (`Off`, `Previous Month`, `Same Month Last Year`, or `Custom Month`).

#### Scenario: Selecting a specific month from the Month & Year Picker popover
- **WHEN** the user opens the Month & Year Picker popover in the header and selects a specific year and month (e.g. `May 2025`)
- **THEN** the active period updates to `May 2025` across all Budget Overview cards and the previous/next steppers step relative to `May 2025`

#### Scenario: Stepping between months with previous and next buttons
- **WHEN** the user clicks the previous (`<`) or next (`>`) month button on the header picker
- **THEN** the active reporting period moves to the immediately preceding or following available month in the `/stat/ping` series (and disables stepping past the earliest or latest available month)

#### Scenario: Comparing active month against Previous Month, Same Month Last Year, or Custom Month
- **WHEN** the user selects a comparison mode (`Previous Month`, `Same Month Last Year`, or a specific custom month) in the header `Compare vs` control
- **THEN** the dashboard computes baseline metrics under the same active exclusion preset from the cached `/stat/ping` series without extra `/stat/ping` network requests and renders inline deltas across the KPI metrics strip, Controllable Expenses Breakdown card, and Budget Spent vs Limit card

### Requirement: Year-over-Year trends chart section

The Family Budget overview dashboard SHALL include an interactive Historical & Year-over-Year Trends section displaying multi-year spending, income, liquid balance, and net worth patterns over the available timeline. The chart SHALL support five macro metric modes inspired by ExternalProvider Web (`Expenses & Income` dual-curve overlay, `Expenses`, `Income`, `Balance`, and `Net Worth`), switching between continuous chronological timeline (`APR'26 -> OCT'26`) and Year-over-Year calendar month alignment (`Jan -> Dec`), and range zoom controls (`6M`, `12M`, `24M`, `All` / custom period).

#### Scenario: Visualizing multi-year trends
- **WHEN** the dashboard renders with historical data loaded
- **THEN** an interactive chart renders showing monthly controllable spending, net income, dual-series expenses vs. income, liquid balance, or net worth across the selected timeline or Year-over-Year series

#### Scenario: Viewing dual Expenses and Income overlay
- **WHEN** the user selects the `Expenses & Income` chart mode
- **THEN** the chart renders both monthly controllable expenses and net disposable income on the same chronological axis, highlighting the monthly net surplus or deficit in the tooltip

#### Scenario: Viewing Balance or Net Worth historical trajectory
- **WHEN** the user selects `Balance` or `Net Worth` chart mode
- **THEN** the chart renders the historical end-of-month liquid balance (excluding `exceptFromBalance` accounts) or total net worth (including savings/goals and debt accounts) converted to the default currency

#### Scenario: Switching trend display modes
- **WHEN** the user switches between continuous monthly time-series view and side-by-side Year-over-Year comparison view, or adjusts the timeline zoom (`+` / `-` or period range selector)
- **THEN** the chart transitions smoothly to display the selected aggregation format and date window

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
- **THEN** the server proxy bypasses caching for the write request, invalidates cached `/Exchange/Ping` entries in the proxy cache, and the client updates its cached `categories` entry with the latest category state

#### Scenario: Transaction write invalidates cached transaction, category, and statistics reads

- **WHEN** the client sends a transaction creation or update request to `/api/external-provider/api/transaction/create` or `/api/external-provider/api/transaction/update`
- **THEN** the server proxy bypasses caching for the write request and invalidates cached `/api/transaction/get`, `/Exchange/Ping`, and `/stat/ping` entries so subsequent reads reflect updated account balances and transaction history

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, year-over-year trends, and transaction running balance calculation. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks

- **WHEN** `transformExpenses` and `computeBudgetSummaryItems` receive statistics categories with `value`, `amount`, or `currentAmount`, or missing metadata names
- **THEN** the transforms prioritize period-specific `value` over static category `amount` snapshots (falling back to `amount` and `currentAmount` only when `value` is absent) and accurately extract non-zero spent amounts and category names without defaulting to zero or repeating current-month snapshots across historical periods

#### Scenario: Unit tests validate date parsing across historical points

- **WHEN** `parsePointDate` and YoY/chronological transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`) where `amount` holds a constant current-month snapshot while `value` varies per period
- **THEN** valid Date objects are returned, historical spending is aggregated from `value` without dropping points or producing `Invalid Date`, and YoY deltas reflect true period-over-period variance

#### Scenario: Unit tests validate transaction running balance calculation with upstream payloads

- **WHEN** `computeTransactionsWithRunningBalance` and `getAccountBalance` process accounts containing non-zero `amount` alongside upstream `currentAmount: 0.0`
- **THEN** initial balances anchor to `amount` rather than `0.0`, and running balances calculate backwards from the live account balance

### Requirement: Account liquidity and currency breakdown metrics

The Accounts & Transactions screen (`/dashboard/family-budget`) SHALL display an account liquidity summary strip showing Total Net Liquid Balance converted into the user's default currency (using ExternalProvider's `ExchangeKey.Currency` exchange rates and excluding accounts marked `exceptFromBalance`), a breakdown of native balances grouped by account currency, and active filter/reconciliation status (highlighting either the currently selected account's balance and loaded flow or any debt/unreconciled archived accounts).

#### Scenario: Multi-currency liquidity metrics rendered

- **WHEN** the Accounts & Transactions screen loads with accounts in one or more currencies and currency exchange rates from `/Exchange/Ping`
- **THEN** the top metrics strip displays the converted total balance in the default currency, native currency subtotals (e.g. PLN, USD, EUR), and debt/reconciliation or selected-account status
