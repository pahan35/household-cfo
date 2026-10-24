# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display, for the selected reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Categories at or above their limit SHALL be visually flagged as overruns. By default, budget categories SHALL be sorted ascending by ExternalProvider's `category.order` (with an option to sort by percentage spent), and users SHALL be able to drag-and-drop reorder categories in custom-order mode, persisting the updated `order` values upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
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

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expense Composition Pie/Donut Chart card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, and showing per-category deltas and variance sorting when a comparison baseline period is active.

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive pie chart renders with slices proportional to each category's spent amount, formatted in the reporting currency

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the pie chart
- **THEN** the tooltip displays the category name, spent amount, percentage of controllable expenses, and budget limit if configured

#### Scenario: Quick exclusion toggle on the chart card
- **WHEN** the user toggles the quick "Exclude Rent" switch on the pie chart card
- **THEN** the pie chart recalculates immediately with the category omitted or restored without navigating away

#### Scenario: Category comparison deltas and variance sorting
- **WHEN** a comparison baseline month is active on the Budget Overview screen
- **THEN** each category row in the Controllable Expenses Breakdown card displays its spending delta (`+PLN` / `-PLN` and `%`) relative to the baseline month, and the user can sort the category list by total spent or by biggest increase/decrease

### Requirement: Net income and controllable expense metrics

The Family Budget overview dashboard SHALL display key summary metrics reflecting the active exclusion preset, including Gross Income, Net Disposable Income (after tax deductions), Controllable Expenses, and Net Cash Margin, along with inline comparison deltas when a comparison baseline month is active.

#### Scenario: Overview metric presentation
- **WHEN** the dashboard renders with the active period data
- **THEN** the metrics display the calculated Gross Income, Net Disposable Income, total Controllable Expenses, and the remaining Net Cash Margin

#### Scenario: Overview metric comparison deltas
- **WHEN** a comparison baseline month is selected in the header (`Previous Month`, `Same Month Last Year`, or a custom historical month)
- **THEN** each metric card in the strip displays the absolute (`+PLN` / `-PLN`) and percentage (`%`) change against the baseline month with directional indicators

## ADDED Requirements

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
