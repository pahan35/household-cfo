# Spec Delta

## ADDED Requirements

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
