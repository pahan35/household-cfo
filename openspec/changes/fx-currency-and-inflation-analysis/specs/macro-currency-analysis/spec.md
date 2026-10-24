# Spec Delta

## Purpose

Enables macroeconomic normalization of family budget data through historical CPI inflation deflation, dual-currency (USD/PLN) translation, and forward exchange rate scenario simulations.

## ADDED Requirements

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
