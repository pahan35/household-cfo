# Spec Delta: budget-overview

## MODIFIED Requirements

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
