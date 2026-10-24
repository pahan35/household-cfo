# Spec Delta

## MODIFIED Requirements

### Requirement: Family Budget screen navigation

The dashboard sidebar SHALL include a top-level "Family Budget" group positioned above the template "Dashboards" group. The "Family Budget" group SHALL include an "Overview" entry that navigates to `/dashboard/family-budget` and an "FX & Inflation" entry that navigates to `/dashboard/family-budget/fx-inflation`, and both routes SHALL render screens following the dashboard shell and visual conventions of nearby screens (finance reference).

#### Scenario: Navigating to the screen

- **WHEN** the user clicks "Overview" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget` loads and displays the overview sections

#### Scenario: Navigating to the FX & Inflation Analysis screen

- **WHEN** the user clicks "FX & Inflation" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/fx-inflation` loads and displays the macroeconomic inflation and USD/PLN sensitivity analysis sections
