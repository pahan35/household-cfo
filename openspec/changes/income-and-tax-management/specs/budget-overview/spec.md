# Spec Delta: Budget Overview

## MODIFIED Requirements

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
