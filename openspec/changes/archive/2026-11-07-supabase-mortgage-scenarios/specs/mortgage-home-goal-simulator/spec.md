# Spec Delta: mortgage-home-goal-simulator

## MODIFIED Requirements

### Requirement: Local persistence of mortgage scenarios
The system SHALL persist all simulator inputs, property assumptions, financing options, linked Goal IDs, and milestone dates in a dedicated Supabase PostgreSQL relational table (`mortgage_scenarios`) for authenticated family users, with graceful client-side fallback/caching in browser `localStorage`. The system SHALL support creating, renaming, duplicating, and deleting multiple named scenarios, with one designated as the primary household scenario.

#### Scenario: Restoring saved mortgage scenario on page reload
- **WHEN** the user modifies mortgage parameters and refreshes `/dashboard/family-budget/mortgage`
- **THEN** the simulator restores all property parameters, selected financing structure, and linked ExternalProvider Goal configuration from Supabase (or local cache when offline)

#### Scenario: Restoring saved mortgage scenario from Supabase
- **WHEN** the user opens or refreshes `/dashboard/family-budget/mortgage` while connected
- **THEN** the simulator loads the household's saved mortgage scenarios from Supabase and activates the designated primary scenario

#### Scenario: Offline or disconnected fallback
- **WHEN** the user opens `/dashboard/family-budget/mortgage` while disconnected or without Supabase access
- **THEN** the simulator falls back to the locally cached scenario in browser `localStorage` and alerts the user that changes are saved locally

#### Scenario: Creating and switching between multiple scenarios
- **WHEN** the user creates a new scenario named "Wola 68m²" and modifies its property parameters
- **THEN** the system persists "Wola 68m²" independently in Supabase without overwriting the previous scenario, and allows instantaneous switching between scenarios via a scenario selector toolbar

## ADDED Requirements

### Requirement: Multi-scenario comparison matrix
The system SHALL provide an interactive scenario comparison tool allowing users to select two or more saved mortgage scenarios and view a side-by-side delta matrix highlighting total acquisition costs, upfront cash required, monthly mortgage payments under current and stressed interest rates, overlap carrying costs, and time to down payment completion.

#### Scenario: Comparing two property purchase scenarios
- **WHEN** the user opens the scenario comparison matrix with "Mokotów 75m²" and "Wola 68m²" selected
- **THEN** the system displays side-by-side columns with exact values and visual deltas for total cost, upfront cash needed, monthly installment difference, and timeline to Milestone 1
