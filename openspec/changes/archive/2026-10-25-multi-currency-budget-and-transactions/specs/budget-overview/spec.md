# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display a comprehensive Expense Categories & Budget card supporting two primary view modes: an **Active in Month** mode (showing expense categories with a non-zero spent amount or budget limit in the selected reporting period) and an **All Categories (Order & Lifecycle)** mode (showing non-deleted expense categories in ascending ExternalProvider `category.order`, including zero-spend categories such as rarely-used foreign-currency categories like `Hotels CHF`). The summary SHALL strictly include only expense categories (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories. Categories at or above their limit SHALL be visually flagged as overruns. Users SHALL be able to click any category row in either mode to open the Category Expense Trace sheet for that category. In custom-order mode, users SHALL be able to drag-and-drop reorder expense categories, soft-archive an active expense category (prefixing its name with `_` and moving it to the end of the active section), unarchive an archived expense category (stripping the leading `_` and placing it immediately before the first archived expense category), move active expense categories positioned below archived categories above the first archived category or move archived categories positioned above active categories to the bottom (adapting the banner and action to whichever direction mutates fewer entities), and position foreign/legacy currency expense categories (`UAH`, `CHF`, `EUR`, etc.) immediately above the archived section—persisting all `name` and `order` updates upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand via a "Show archived" toggle without leaking zero-spend unarchived or soft-deleted categories into the view. Soft-deleted categories (`category.deleted === true`) SHALL be hidden by default in both view modes, toggleable via a dedicated "Show removed" toggle, rendered with distinct removed badging and styling, editable via row actions, and ordered below archived categories. Each category row SHALL display its ExternalProvider `#order` index and the timestamp of its most recent transaction (resolving targeted transactions when outside the initial 300-transaction window) with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period. When a category's budget limit is defined exclusively in a foreign currency (e.g. UAH), the row SHALL display that native foreign currency for limit and spend, with converted reporting currency amounts available on hover. When smart category groups are displayed, the parent group SHALL display spending and limits normalized in the primary reporting currency (defaulting to PLN), while individual child categories SHALL display their original native currencies with reporting currency conversions.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each active expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts, marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

#### Scenario: Standalone foreign-currency budget limit presentation

- **WHEN** an individual expense category has a budget limit defined exclusively in a foreign currency (such as `Sport UAH` with currencyId `UAH`)
- **THEN** the row displays the limit and spend in that native foreign currency (e.g. `4 500,00 ₴ / 5 000,00 ₴`), and hovering over the amount reveals a tooltip with the converted reporting currency equivalent (e.g. `~439,02 zł / ~487,80 zł`)

#### Scenario: Smart category group multi-currency display

- **WHEN** a smart category group unites child categories across different currencies (such as `Sport PLN` and `Sport UAH`)
- **THEN** the parent group row displays total spending and limits normalized in the dashboard's primary reporting currency (PLN), and the category breakdown reveals each child category rendered in its respective native currency with converted equivalents

#### Scenario: Viewing all expense categories regardless of monthly activity

- **WHEN** the user switches the Budget Spent vs Limit card to the "All Categories" view mode
- **THEN** all non-deleted expense categories (including categories with zero spend and zero limit in the selected month, such as `Hotels CHF`) are listed in ascending ExternalProvider `order` with their `#order` badge, currency/tier badge, and last transaction summary, and clicking any row opens the Category Expense Trace sheet

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags an expense category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archiving and unarchiving an expense category

- **WHEN** the user archives an active expense category or unarchives a `_`-prefixed expense category from its row action menu
- **THEN** archiving prefixes the category name with `_` and moves it to the end of the active expense category order list, unarchiving strips the `_` prefix and moves it immediately before the first archived expense category, and the modified entities are persisted upstream via `/Exchange/Ping`

#### Scenario: Moving active expense categories above archived categories and organizing foreign-currency tier

- **WHEN** active categories are positioned below archived categories and the count of active categories below archived is less than or equal to the count of archived categories above active (or the user triggers the action to group foreign/legacy currency categories right above archived)
- **THEN** the card surfaces a warning banner with action "Move above archived" that repositions misplaced active categories immediately above the first archived category (with foreign-currency categories placed immediately above archived when requested) and persists updated `order` values via `/Exchange/Ping`

#### Scenario: Adaptive banner and action when archived categories are positioned above active categories

- **WHEN** archived categories are positioned above active categories and the count of archived categories above active is strictly less than the count of active categories positioned below them (such as 4 archived categories sitting above 91 active categories)
- **THEN** the card surfaces a warning banner stating that archived categories are positioned above active categories with an action "Move archived to bottom" (and a row action "Move to bottom" on individual archived categories), which moves the archived categories to after the last active category, assigns sequential orders starting after the maximum active category order, and mutates only the archived categories without renumbering or mutating the active categories

#### Scenario: Isolated archived toggle without leaking inactive or removed categories

- **WHEN** the user toggles "Show archived" on
- **THEN** only inactive categories whose names begin with `_` are revealed, and unarchived zero-spend categories and soft-deleted categories are strictly excluded from the active list

#### Scenario: Dedicated removed categories toggle and bottom ordering

- **WHEN** the user toggles "Show removed" on
- **THEN** soft-deleted categories (`category.deleted === true`) are revealed with a distinct "Removed" badge and muted styling, positioned at the very bottom of the directory (below archived categories), and offer row actions to inspect transactions, rename, or adjust order

#### Scenario: Targeted resolution of last transaction timestamp outside initial window

- **WHEN** a visible category has historical transactions in ExternalProvider but has no transaction in the initial 300-transaction window
- **THEN** the dashboard performs a targeted query to `/api/transaction/get` filtered by category ID to resolve and display its most recent transaction timestamp and counterpart details

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), amount normalized to reporting currency with original native currency amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expenses Breakdown (pie/donut chart) card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, surfacing available cash capacity, supporting an interactive Preset Configuration Dialog trigger to configure excluded categories, supporting smart category grouping for Transport and Taxi, showing per-category deltas and variance sorting when a comparison baseline period is active, and allowing users to click any category row to trace its underlying transactions across all accounts, comparison periods, or all-time history in a wide slide-over sheet (`data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`). All transaction amounts within the slide-over sheet SHALL be converted to the dashboard reporting currency (defaulting to PLN) for total spending metrics, tab badges, and account filter chips, while each transaction row SHALL present the converted reporting amount as primary and the original native amount and currency as secondary with exchange rate tooltips.

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
- **THEN** a wide Category Expense Trace slide-over sheet (`data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`) opens without clipping account filter chips, presenting the category name, total spent in the active month converted to reporting currency, and a reverse-chronological list of all transactions belonging to that category across all accounts

#### Scenario: Trace sheet transaction row multi-currency display
- **WHEN** a transaction was incurred in a foreign currency (such as 500 UAH from a Ukrainian bank account)
- **THEN** the transaction row in the Category Expense Trace sheet displays the converted reporting amount (e.g. `-48,78 zł`) as primary in the right column, and displays the native original amount (e.g. `500,00 ₴`) as secondary text or in a hover tooltip with conversion rate details

#### Scenario: Account breakdown chips normalized with native subtotals
- **WHEN** the Category Expense Trace sheet displays account filter chips for paying accounts with mixed currencies (e.g. a PLN card and a UAH account)
- **THEN** each account chip displays its total spend converted into the primary reporting currency for valid summing, while hovering over an account chip reveals the native currency subtotal

#### Scenario: Dual-period comparison in trace sheet
- **WHEN** a comparison baseline period is active on the Budget Overview screen and the user opens the Category Expense Trace sheet
- **THEN** the sheet displays period view controls enabling the user to view transactions for the Active Month, the Comparison Baseline Month, a Side-by-Side/Combined view, or an All-Time History view, with all period totals and variances converted to reporting currency

#### Scenario: All-time history in trace sheet without month bounds
- **WHEN** the user selects the `All-Time` tab in the Category Expense Trace sheet for any category (including a category with zero transactions in the active month, such as `Hotels CHF`)
- **THEN** the sheet fetches and displays all historical transactions for that category across all months and years without a date range restriction, with amounts converted to reporting currency

#### Scenario: Non-intrusive account filtering within category trace
- **WHEN** the Category Expense Trace sheet opens with transactions from multiple paying accounts
- **THEN** the sheet defaults to showing all transactions across all accounts with paying accounts badged on each item, and displays account filter chips with subtotal spending per account converted to reporting currency, allowing the user to isolate transactions from a specific account on demand

#### Scenario: Trace sheet URL state synchronization
- **WHEN** a category trace sheet is opened or closed on the Budget Overview screen, or the user clicks "Open in Ledger"
- **THEN** opening or closing updates the query parameters in the URL to reflect the inspected category ID and active month without causing a full page reload, and clicking "Open in Ledger" navigates to `/dashboard/family-budget?categoryId=<ids>` (including all child IDs for a smart group and `&accountId=<id>` if an account chip is active) to filter the main ledger

### Requirement: Money and date presentation

Amounts SHALL be formatted in the screen's reporting currency (from settings, falling back to the stats response currency) by default. When transactions or category limits originate in a foreign currency (e.g. UAH, EUR, USD), the system SHALL resolve the native currency and amount from category metadata, convert the amount into the reporting currency using upstream exchange rates (`ExchangeKey.Currency`), display the normalized reporting currency as primary, and provide the native amount and currency breakdown in secondary text or hover tooltips. Transaction timestamps SHALL be shown using the ISO variant provided by the upstream, displayed with existing project date formatting.

#### Scenario: Currency from settings
- **WHEN** settings report a default currency and a transaction excludes no explicit currency
- **THEN** amounts render with that currency's symbol/format

#### Scenario: Foreign currency transaction normalization
- **WHEN** a transaction is paid from a foreign-currency account (e.g. `currencyId: "UAH"`) or recorded in a foreign currency
- **THEN** the system resolves the original currency and amount, converts it to reporting currency using current exchange rates, and renders the normalized reporting value alongside the original native value on hover
