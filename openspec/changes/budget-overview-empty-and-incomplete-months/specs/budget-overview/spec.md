# Spec Delta

## MODIFIED Requirements

### Requirement: Loading, empty, and error states

The screen SHALL show loading placeholders while data is being fetched, SHALL render self-explanatory empty states when a section has no data, SHALL render a unified empty state card across the overview metrics, expense breakdown, and budget summary cards when the active month contains zero recorded transactions and no matching budget statistics point, and SHALL on fetch or upstream failure render an error message identifying the failing section with a retry action, without exposing any credential values in the UI.

#### Scenario: Upstream failure on one section

- **WHEN** one data source returns an error (e.g. HTTP 500/502 from the proxy) while others succeed
- **THEN** the affected section shows an error state with a retry action while unaffected sections render their data

#### Scenario: Retry after failure

- **WHEN** the user triggers retry on a failed section
- **THEN** that section refetches and re-renders without reloading the whole screen

#### Scenario: Unified empty state for zero-data month

- **WHEN** the user navigates to an active month that has no recorded transactions and no matching budget statistics point (e.g. `month=2026-11-01`)
- **THEN** the dashboard renders a unified empty state card informing the user that no transactions or budget data exist for this month, with a quick action to switch back to the latest month with recorded activity, without rendering stale categories or spending numbers from prior months

## ADDED Requirements

### Requirement: Strict month statistics point resolution

The system SHALL resolve budget statistics points strictly against the selected calendar month start, SHALL NOT fall back to the most recent period (`points[0]`) when a requested month has no point data, and SHALL return empty category lists (`[]`) for unrecorded months across all overview calculation engines.

#### Scenario: Requesting month absent from statistics series

- **WHEN** the user selects a month that does not exist in the statistics points collection
- **THEN** the system resolves the active point to `undefined`, sets category spend to empty (`[]`), computes gross income and controllable expense as zero, and avoids falling back to the latest available historical point

### Requirement: Incomplete month evaluation and badging

The screen SHALL determine whether an active month with recorded activity is incomplete, and when incomplete, SHALL display a visual "Incomplete month" indicator badge with an explanatory tooltip either inside the Expenses Breakdown card header or directly adjacent to the Controllable Expenses metric. An active month SHALL be evaluated as incomplete if:
1. It is the current calendar month in progress (`activeMonth == currentMonth`), or
2. There are no recorded transactions in any subsequent calendar month (`hasTransactionsInFollowingMonth == false`).

#### Scenario: Incomplete status for current month in progress

- **WHEN** the user selects the current calendar month and transactions exist for this month
- **THEN** the screen displays the "Incomplete month" badge indicating that the calendar period is still in progress

#### Scenario: Incomplete status for historical cutoff month

- **WHEN** the user selects a historical month where activity ceased mid-month and no transactions exist in the following calendar month
- **THEN** the screen displays the "Incomplete month" badge with a tooltip clarifying that data collection ended before the following month
