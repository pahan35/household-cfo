# Spec Delta

## MODIFIED Requirements

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expenses Breakdown (pie/donut chart) card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, surfacing available cash capacity, supporting an interactive Preset Configuration Dialog trigger to configure excluded categories, supporting smart category grouping for Transport and Taxi, showing per-category deltas and variance sorting when a comparison baseline period is active, and allowing users to click any category row to trace its underlying transactions across all accounts and comparison periods in a dedicated slide-over sheet.

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

#### Scenario: Launching category expense trace sheet
- **WHEN** the user clicks any category row or child item in the Expenses Breakdown list
- **THEN** a Category Expense Trace slide-over sheet opens, presenting the category name, total spent in the active month, and a reverse-chronological list of all transactions belonging to that category across all accounts

#### Scenario: Dual-period comparison in trace sheet
- **WHEN** a comparison baseline period is active on the Budget Overview screen and the user opens the Category Expense Trace sheet
- **THEN** the sheet displays period view controls enabling the user to view transactions for the Active Month, the Comparison Baseline Month, or a Side-by-Side/Combined view, highlighting the spending variance between both periods

#### Scenario: Non-intrusive account filtering within category trace
- **WHEN** the Category Expense Trace sheet opens with transactions from multiple paying accounts
- **THEN** the sheet defaults to showing all transactions across all accounts with paying accounts badged on each item, and displays account filter chips with subtotal spending per account, allowing the user to isolate transactions from a specific account on demand

#### Scenario: Trace sheet URL state synchronization
- **WHEN** a category trace sheet is opened or closed on the Budget Overview screen
- **THEN** the query parameters in the URL update to reflect the inspected category ID and active month without causing a full page reload or unmounting the dashboard component tree
