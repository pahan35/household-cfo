# historical-budget-trends Specification

## Purpose

Aggregates multi-period time-series data from ExternalProvider stats, aligns calendar months across consecutive years, and calculates historical cash flow trends and savings rates under active exclusion presets.

## Requirements

### Requirement: Historical time-series extraction

The system SHALL extract and chronologically sort all available points returned by the `/stat/ping` query, validating point identifiers and timestamps across up to 40 historical periods.

#### Scenario: Processing multi-period response
- **WHEN** `/stat/ping` returns points spanning multiple years
- **THEN** all points are parsed, ordered from oldest to newest by date ID, and prepared for time-series aggregation without discarding historical months

### Requirement: Year-over-Year month alignment

The system SHALL group historical monthly points by their calendar month index (January through December) across calendar years to enable direct Year-over-Year comparison.

#### Scenario: Comparing equivalent calendar months
- **WHEN** the user selects a target calendar month (e.g. October)
- **THEN** the system aligns data for October across all available years (e.g. 2024, 2025, 2026) and calculates the percentage and absolute delta in controllable spending

#### Scenario: Missing historical month
- **WHEN** data for a specific calendar month in a prior year does not exist in the points series
- **THEN** the system handles the gap gracefully, displaying available years without breaking the comparison view

### Requirement: Preset-aware historical trend metrics

The system SHALL apply active exclusion preset rules across all historical points to compute Net Disposable Income, Controllable Expenses, and Net Savings Margin for each historical period.

#### Scenario: Applying exclusions to multi-year history
- **WHEN** an exclusion preset is active with Rent excluded and Taxes deducted
- **THEN** all historical points reflect these exclusions uniformly, providing an accurate comparison of lifestyle spending over time
