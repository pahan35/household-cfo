# Spec Delta

## MODIFIED Requirements

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expenses Breakdown (pie/donut chart) card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset, surfacing available cash capacity, supporting generalized smart category grouping for multi-currency categories sharing a canonical base name and Transport/Taxi, rendering canonical base names (omitting default currency suffixes), displaying foreign currency indicator icons/badges when non-default currency expenses occur, and showing per-category deltas and variance sorting when a comparison baseline period is active.

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive card titled "Expenses Breakdown" renders with slices proportional to each included category's spent amount, formatted in the reporting currency, and an inner donut label displaying total included expenses

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the Expenses Breakdown chart
- **THEN** the tooltip displays the category or group name, spent amount, percentage of included expenses, budget limit if configured, and a breakdown by constituent currency if non-default currencies are present

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
- **WHEN** the household has both regular transit (e.g. `Transport`) and ride-hailing (e.g. `Taxi`) categories
- **THEN** the system links both categories into a smart "Transport" group, aggregating them into a unified "Transport (incl. Taxi)" slice on the donut chart when either falls below the minor-slice threshold (< 3%), and displaying distinct child line items under the Transport group header in the breakdown legend

#### Scenario: Generalized smart grouping for multi-currency categories
- **WHEN** the active period contains spending across multiple categories that share the same canonical base name across different currencies (such as `Medicine` and `Medicine UAH`, or `Hotels` and `Hotels UAH`)
- **THEN** the system merges their spending amounts into a single unified smart group slice titled with the canonical base name (e.g. `Medicine`) on the donut chart, and displays the unified group row in the breakdown list

#### Scenario: Foreign currency indicator icon and child currency breakdown
- **WHEN** a category or smart group includes expenses incurred in a currency different from the dashboard's default currency (PLN)
- **THEN** the category row in the breakdown list displays an extra foreign-currency indicator icon/badge, and expanding or inspecting the row displays the itemized breakdown showing spending in the default currency and spending in the foreign currency
