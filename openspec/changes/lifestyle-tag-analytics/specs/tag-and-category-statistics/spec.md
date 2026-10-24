# Spec Delta

## Purpose

Provides an interactive Tag & Category Statistics Explorer modeled on ExternalProvider Mobile's Statistics screen and Web Chart Window, allowing users to analyze `Expenses` and `Income` via a proportional Donut Chart and ranked breakdown list with `Category -> Tag` chevron drill-down, global `By Tag` aggregation, currency-unified category grouping, and filtered historical trend curves.

## ADDED Requirements

### Requirement: Lifestyle & Tags navigation and hub switcher
The dashboard sidebar SHALL include an expandable "Lifestyle & Tags" item under the "Family Budget" group with sub-items for "Tag & Category Explorer" (`/dashboard/family-budget/lifestyle`), "Trips & Concerts" (`/dashboard/family-budget/lifestyle/trips-concerts`), "Health & Sport" (`/dashboard/family-budget/lifestyle/health-sport`), and "Learning" (`/dashboard/family-budget/lifestyle/learning`), and all lifestyle routes SHALL share a header tab/pill switcher to navigate seamlessly across the views.

#### Scenario: Navigating to the Tag & Category Explorer and sub-routes
- **WHEN** the user expands "Lifestyle & Tags" in the sidebar or clicks a tab in the Lifestyle route header
- **THEN** the corresponding route (`/dashboard/family-budget/lifestyle`, `/trips-concerts`, `/health-sport`, or `/learning`) renders within the shared Lifestyle layout

### Requirement: Expenses and Income donut breakdown with Category-to-Tag drill-down
The Tag & Category Explorer (`/dashboard/family-budget/lifestyle`) SHALL display an interactive Donut Chart (showing the selected period label and total amount in the center) paired with a ranked percentage and amount list. Users SHALL be able to switch between `Expenses` and `Income` tabs, toggle between `By Category` (raw ExternalProvider categories), `Unified Category` (grouping currency-suffixed categories like `Sport PLN` and `Sport UAH`), and `By Tag` (aggregating across all `#tags`), and click any category row that contains tagged transactions (`>` chevron indicator) to drill down into the tag breakdown inside that category (including an `Untagged` slice for transactions in that category without tags).

#### Scenario: Drilling down from a category into its internal tags
- **WHEN** the user views the `Expenses` or `Income` breakdown in `By Category` or `Unified Category` mode and clicks a category row displaying a `>` drill-down chevron
- **THEN** the donut chart and ranked list update to show the proportional distribution of `#tags` (and any `Untagged` remainder) within that selected category, with a breadcrumb/back control to return to all categories

#### Scenario: Switching to global By Tag mode
- **WHEN** the user toggles the view mode to `By Tag` (tag icon control)
- **THEN** the donut chart and ranked list aggregate all transactions in the selected period by `#tag` across all categories, displaying each tag's total amount, share percentage, and transaction count

### Requirement: Filtered historical trend chart for selected category or tag
The Tag & Category Explorer SHALL include a historical trend chart that plots monthly `Expenses`, `Income`, or `Expenses & Income` curves over time filtered to the currently selected category, unified category group, or `#tag`, with period range / zoom controls.

#### Scenario: Filtering trend line by a selected category or tag
- **WHEN** the user selects a specific category or `#tag` from the donut breakdown or filter bar
- **THEN** the historical trend chart plots the monthly trajectory for that selection in the default currency alongside a filtered transactions table below
