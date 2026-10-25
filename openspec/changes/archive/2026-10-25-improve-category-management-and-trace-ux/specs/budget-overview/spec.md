# Spec Delta

## MODIFIED Requirements

### Requirement: Recent transactions list

The screen SHALL display all-time transactions in reverse-chronological order (across all accounts, filtered by a selected account, or filtered by one or more category IDs via URL search parameters `?categoryId=...` and optional `?accountId=...`), each showing its date, explicit source and target names (`Source -> Target`) resolved from the categories lookup when omitted from the raw transaction payload, direction-aware amount in the account's native currency, any comment or tags, and the running balance of the involved account after that transaction in the account's currency. Running balances SHALL be anchored on the account's live balance (`category.amount`), correctly resolving against upstream payloads that include `currentAmount: 0.0`. Additional older transactions SHALL be retrievable via incremental "Load more" paging whenever `hasMoreData` is true.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData` and account categories with `amount` and `currentAmount: 0.0`
- **THEN** a first page of transactions is listed newest-first with date, resolved source and target category names (`Source -> Target`), direction-aware amount in the account's native currency, comment/tags (if any), and the calculated running balance of the account immediately after that transaction anchored on the account's live balance (`amount`)

#### Scenario: Filtering transactions by selected account

- **WHEN** an account is selected in the accounts list
- **THEN** the transactions list fetches and displays transactions for that `accountId`, shows an active filter indicator with the account's name and current balance in its native currency (extracted from `amount`), and displays the account's running balance after each transaction

#### Scenario: Filtering transactions by categoryId URL parameter from Open in Ledger

- **WHEN** the user navigates to `/dashboard/family-budget?categoryId=<id>` (or comma-separated IDs for a smart group, optionally with `&accountId=<accId>`)
- **THEN** the screen reads the URL query parameters, fetches and filters the transactions feed to those category IDs (and optional paying account), displays an active removable category filter badge in the Transactions card header, and updates the URL when the user clears the filter

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page of older transactions (globally or for the selected account/category filter) is fetched with the continuation (`skip`), appended without duplicating already-shown items, and running account balances are continuously calculated across the appended rows

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions for the current view or selected account/category filter
- **THEN** the transactions section shows an empty state (with an option to clear the active filter if one is applied)

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display a comprehensive Expense Categories & Budget card supporting two view modes: an **Active in Month** mode (showing expense categories with a non-zero spent amount or budget limit in the selected reporting period) and an **All Categories (Order & Lifecycle)** mode (showing every non-deleted expense category in ascending ExternalProvider `category.order`, including zero-spend categories such as rarely-used foreign-currency categories like `Hotels CHF`). The summary SHALL strictly include only expense categories (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories. Categories at or above their limit SHALL be visually flagged as overruns. Users SHALL be able to click any category row in either mode to open the Category Expense Trace sheet for that category. In custom-order mode, users SHALL be able to drag-and-drop reorder expense categories, soft-archive an active expense category (prefixing its name with `_` and moving it to the end of the expense categories order list), unarchive an archived expense category (stripping the leading `_` and placing it immediately before the first archived expense category), move active expense categories positioned below archived expense categories to immediately above the first archived category, and position foreign/legacy currency expense categories (`UAH`, `CHF`, `EUR`, etc.) immediately above the archived section—persisting all `name` and sequential `order` updates upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display its ExternalProvider `#order` index and the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each active expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency, marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

#### Scenario: Viewing all expense categories regardless of monthly activity

- **WHEN** the user switches the Budget Spent vs Limit card to the "All Categories" view mode
- **THEN** all non-deleted expense categories (including categories with zero spend and zero limit in the selected month, such as `Hotels CHF`) are listed in ascending ExternalProvider `order` with their `#order` badge, currency/tier badge, and last transaction summary, and clicking any row opens the Category Expense Trace sheet

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags an expense category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archiving and unarchiving an expense category

- **WHEN** the user archives an active expense category or unarchives a `_`-prefixed expense category from its row action menu
- **THEN** archiving prefixes the category name with `_` and moves it to the end of the expense category order list, unarchiving strips the `_` prefix and moves it immediately before the first archived expense category, and the modified entities are persisted upstream via `/Exchange/Ping`

#### Scenario: Moving active expense categories above archived categories and organizing foreign-currency tier

- **WHEN** one or more active expense categories are positioned below `_`-archived expense categories (or the user triggers the action to group foreign/legacy currency categories right above archived)
- **THEN** the card surfaces a warning banner / action that repositions active categories above the first `_`-archived category (with foreign-currency categories placed immediately above archived when requested) and persists sequential `order` values via `/Exchange/Ping`

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), formatted amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expenses Breakdown (pie/donut chart) card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, surfacing available cash capacity, supporting an interactive Preset Configuration Dialog trigger to configure excluded categories, supporting smart category grouping for Transport and Taxi, showing per-category deltas and variance sorting when a comparison baseline period is active, and allowing users to click any category row to trace its underlying transactions across all accounts, comparison periods, or all-time history in a wide slide-over sheet (`data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`).

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive card titled "Expenses Breakdown" renders with slices proportional to each included category's spent amount, formatted in the reporting currency, and an inner donut label displaying total included expenses

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the Expenses Breakdown chart
- **THEN** the tooltip displays the category or group name, spent amount, percentage of included expenses, and budget limit if configured

#### Scenario: Managing presets via configuration dialog
- **WHEN** the user clicks the manage presets button next to the preset selector on the Expenses Breakdown card
- **THEN** an interactive Preset Configuration Dialog opens, displaying all expense categories with checkboxes to customize which categories (such as Rent, Insurance PLN, etc.) are excluded from controllable spending and deducted from the income pool

#### Scenario: Quick exclusion toggle on the chart card
- **WHEN** the user toggles category exclusions via the preset selector or configuration dialog
- **THEN** the pie chart recalculates immediately with the selected categories omitted or restored without navigating away, and Net Cash Margin remains invariant

#### Scenario: Category comparison deltas and variance sorting
- **WHEN** a comparison baseline month is active on the Budget Overview screen
- **THEN** each category row in the Expenses Breakdown card displays its spending delta (`+PLN` / `-PLN` and `%`) relative to the baseline month, and the user can sort the category list by total spent or by biggest increase/decrease

#### Scenario: Header badge summary displays cash left
- **WHEN** the Expenses Breakdown card renders with active data and exclusion presets
- **THEN** the card summary strip displays badges for Controllable/Included spending, Excluded fixed spending (if any), and Cash Left (`Net Disposable Income - Total Living Expenses`)

#### Scenario: Smart grouping for Transport and Taxi
- **WHEN** the household has both regular transit (e.g. `Transport PLN`) and ride-hailing (e.g. `Taxi PLN`) categories
- **THEN** the system links both categories into a smart "Transport" group, aggregating them into a unified "Transport (incl. Taxi)" slice on the donut chart when either falls below the minor-slice threshold (< 3%), and displaying distinct child line items under the Transport group header in the breakdown legend

#### Scenario: Generalized smart grouping for multi-currency categories
- **WHEN** the active period contains spending across multiple categories that share the same canonical base name across different currencies (such as `Medicine` and `Medicine UAH`, or `Hotels` and `Hotels UAH`)
- **THEN** the system merges their spending amounts into a single unified smart group slice titled with the canonical base name (e.g. `Medicine`) on the donut chart, and displays the unified group row in the breakdown list

#### Scenario: Foreign currency indicator icon and child currency breakdown
- **WHEN** a category or smart group includes expenses incurred in a currency different from the dashboard's default currency (PLN)
- **THEN** the category row in the breakdown list displays an extra foreign-currency indicator icon/badge, and expanding or inspecting the row displays the itemized breakdown showing spending in the default currency and spending in the foreign currency

#### Scenario: Launching category expense trace sheet
- **WHEN** the user clicks any category row or child item in the Expenses Breakdown list or the Budget Spent vs Limit / All Categories list
- **THEN** a wide Category Expense Trace slide-over sheet (`data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`) opens without clipping account filter chips, presenting the category name, total spent in the active month, and a reverse-chronological list of all transactions belonging to that category across all accounts

#### Scenario: Dual-period comparison in trace sheet
- **WHEN** a comparison baseline period is active on the Budget Overview screen and the user opens the Category Expense Trace sheet
- **THEN** the sheet displays period view controls enabling the user to view transactions for the Active Month, the Comparison Baseline Month, a Side-by-Side/Combined view, or an All-Time History view, highlighting the spending variance between periods

#### Scenario: All-time history in trace sheet without month bounds
- **WHEN** the user selects the `All-Time` tab in the Category Expense Trace sheet for any category (including a category with zero transactions in the active month, such as `Hotels CHF`)
- **THEN** the sheet fetches and displays all historical transactions for that category across all months and years without a date range restriction

#### Scenario: Non-intrusive account filtering within category trace
- **WHEN** the Category Expense Trace sheet opens with transactions from multiple paying accounts
- **THEN** the sheet defaults to showing all transactions across all accounts with paying accounts badged on each item, and displays account filter chips with subtotal spending per account, allowing the user to isolate transactions from a specific account on demand

#### Scenario: Trace sheet URL state synchronization
- **WHEN** a category trace sheet is opened or closed on the Budget Overview screen, or the user clicks "Open in Ledger"
- **THEN** opening or closing updates the query parameters in the URL to reflect the inspected category ID and active month without causing a full page reload, and clicking "Open in Ledger" navigates to `/dashboard/family-budget?categoryId=<ids>` (including all child IDs for a smart group and `&accountId=<id>` if an account chip is active) to filter the main ledger

### Requirement: Unified Month & Year Picker and in-place period comparison

The Budget Overview screen header SHALL provide a unified Month & Year Picker that allows selecting any month available in the loaded `/stat/ping` series (via previous/next month steppers, a year-and-month popover grid, or quick `Current Month` / `Previous Month` actions) and an in-place `Compare vs` baseline selector (`Off`, `Previous Month`, `Same Month Last Year`, or `Custom Month`). The selected active month (`month`), comparison mode (`compare`), and custom comparison month (`compareDate`) SHALL be persisted in both the URL search parameters and `localStorage` so that browser Back/Forward navigation, deep links, and page reloads preserve the user's reporting period context.

#### Scenario: Selecting a specific month from the Month & Year Picker popover
- **WHEN** the user opens the Month & Year Picker popover in the header and selects a specific year and month (e.g. `May 2025`)
- **THEN** the active period updates to `May 2025` across all Budget Overview cards, updates the URL `?month=2025-05-01` parameter and `localStorage`, and the previous/next steppers step relative to `May 2025`

#### Scenario: Stepping between months with previous and next buttons
- **WHEN** the user clicks the previous (`<`) or next (`>`) month button on the header picker
- **THEN** the active reporting period moves to the immediately preceding or following available month in the `/stat/ping` series (and disables stepping past the earliest or latest available month) and persists the updated month in the URL and `localStorage`

#### Scenario: Restoring selected month when navigating back from another route
- **WHEN** the user selects a historical month on `/dashboard/family-budget/budget-overview`, navigates to `/dashboard/family-budget?categoryId=...` via "Open in Ledger", and then navigates back to `/dashboard/family-budget/budget-overview`
- **THEN** the Budget Overview screen restores the previously selected month and comparison state from the URL query parameters or `localStorage` rather than resetting to the current calendar month

#### Scenario: Comparing active month against Previous Month, Same Month Last Year, or Custom Month
- **WHEN** the user selects a comparison mode (`Previous Month`, `Same Month Last Year`, or a specific custom month) in the header `Compare vs` control
- **THEN** the dashboard computes baseline metrics under the same active exclusion preset from the cached `/stat/ping` series without extra `/stat/ping` network requests and renders inline deltas across the KPI metrics strip, Controllable Expenses Breakdown card, and Budget Spent vs Limit card
