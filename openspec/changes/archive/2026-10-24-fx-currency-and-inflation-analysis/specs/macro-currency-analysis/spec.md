# Spec Delta

## Purpose

Enables macroeconomic normalization of family budget data through a dedicated `/dashboard/family-budget/fx-inflation` screen with historical CPI inflation deflation, dual-currency (USD/PLN) translation, and forward exchange rate scenario simulations.

## ADDED Requirements

### Requirement: Dedicated FX and inflation analysis screen

The system SHALL provide a dedicated FX & Inflation Analysis screen at `/dashboard/family-budget/fx-inflation` accessible from the "Family Budget" sidebar group, displaying macroeconomic summary metrics, the CPI Inflation Erosion analysis card, and the Forward USD/PLN Sensitivity Simulator card side-by-side or in a dedicated multi-card layout.

#### Scenario: Loading the FX and inflation analysis screen
- **WHEN** the user navigates to `/dashboard/family-budget/fx-inflation`
- **THEN** the screen loads historical budget stats and renders both the Inflation Erosion analysis and the Forward USD/PLN Simulation tools without requiring tab-switching inside the main budget overview page

### Requirement: Inflation deflation and real income calculation

The system SHALL calculate Real Purchasing Power Income for any historical monthly point by dividing nominal income by the cumulative Polish CPI price index relative to a base month.

#### Scenario: Visualizing salary purchasing power erosion
- **WHEN** the user views the flat salary period (mid-2024 to 2026) in the inflation analysis view
- **THEN** the chart displays the nominal flat salary line alongside the downward-sloping real purchasing power line, indicating total cumulative purchasing power lost to inflation

### Requirement: Dual-currency normalization (USD/PLN)

The system SHALL support viewing financial metrics and time-series data converted between PLN and USD using historical monthly exchange rates.

#### Scenario: Toggling reporting currency
- **WHEN** the user switches the currency context between PLN and USD
- **THEN** historical income, controllable expenses, and savings margins recompute using corresponding monthly USD/PLN exchange rates

### Requirement: Forward FX sensitivity simulation

The system SHALL provide an interactive rate slider/input allowing users to simulate different USD/PLN conversion rates against their upcoming USD salary, projecting equivalent PLN income and margin against current controllable expenses.

#### Scenario: Adjusting exchange rate slider
- **WHEN** the user adjusts the simulated USD/PLN rate (e.g. from 3.90 to 4.20)
- **THEN** the projected PLN gross and net income, remaining savings margin, and buffer percentage recalculate in real time
