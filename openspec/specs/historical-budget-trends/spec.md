# historical-budget-trends Specification

## Purpose

Aggregates multi-period time-series data from ExternalProvider stats, aligns calendar months across consecutive years, and calculates historical cash flow trends and savings rates under active exclusion presets.

## Requirements

### Requirement: Historical time-series extraction

The system SHALL extract and chronologically sort all available points returned by the `/stat/ping` query, validating point identifiers and timestamps across up to 40 historical periods, and SHALL derive each historical period's category spending and income from the period-specific `value` field on each category entry (falling back to `amount` or `currentAmount` only when `value` is undefined) rather than the static current-period `amount` snapshot.

#### Scenario: Processing multi-period response
- **WHEN** `/stat/ping` returns points spanning multiple years where each category entry includes both a period-specific `value` and a static current-month `amount`
- **THEN** all points are parsed, ordered from oldest to newest by normalized month-start date, and aggregated using each point's `value` so historical months display distinct monthly totals and accurate Year-over-Year deltas

### Requirement: Year-over-Year month alignment

The system SHALL group historical monthly points by their calendar month index (January through December) across calendar years to enable direct Year-over-Year comparison.

#### Scenario: Comparing equivalent calendar months
- **WHEN** the user selects a target calendar month (e.g. October)
- **THEN** the system aligns data for October across all available years (e.g. 2024, 2025, 2026) and calculates the percentage and absolute delta in controllable spending

#### Scenario: Missing historical month
- **WHEN** data for a specific calendar month in a prior year does not exist in the points series
- **THEN** the system handles the gap gracefully, displaying available years without breaking the comparison view

### Requirement: Preset-aware historical trend metrics

The system SHALL apply active exclusion preset rules across all historical points to compute Net Disposable Income, Controllable Expenses, and Net Savings Margin for each historical period, and SHALL compute the historical savings rate as `(netCashFlowMargin / netDisposableIncome) * 100` so that savings rates reflect bottom-line margin after all living expenses and fixed obligations.

#### Scenario: Applying exclusions to multi-year history
- **WHEN** an exclusion preset is active with multiple categories excluded (e.g. Rent, Insurance) and Taxes deducted
- **THEN** all historical points reflect these exclusions uniformly, providing an accurate comparison of lifestyle spending over time

#### Scenario: Savings rate calculation consistency
- **WHEN** historical metrics are computed for a period with excluded fixed obligations
- **THEN** the period savings rate equals `(netCashFlowMargin / netDisposableIncome) * 100` rather than inflating savings by subtracting controllable expenses from unadjusted income

### Requirement: Dual Expenses and Income chronological series

The system SHALL compute a chronological monthly series pairing the Controllable Income Pool (Net Disposable Income minus active expense exclusions such as Rent and Insurance) and Controllable Expenses (under the active exclusion preset) for each historical period so that both curves and their net cash margin delta can be plotted simultaneously over a selectable `[from, to]` date window.

#### Scenario: Computing dual series across a zoomed date window
- **WHEN** the user selects a 6-month, 12-month, 24-month, or custom `[from, to]` window in `Expenses & Income` mode
- **THEN** the system returns chronologically ordered monthly points within that window where the Income line reflects the Controllable Income Pool net of active exclusions (`netIncome - excludedExpenseSum`), the Expenses line reflects Controllable Expenses, and their visual curve delta exactly matches the invariant net cash flow margin

#### Scenario: Single-metric Income view reflects active exclusions
- **WHEN** the user selects the "Income" metric in Macro Financial Trends with exclusions active
- **THEN** the chart and tooltip display the Controllable Income Pool alongside itemized gross income, tax deductions, and excluded fixed obligations

### Requirement: Historical Balance and Net Worth trajectory reconstruction
The system SHALL compute historical monthly `Balance` (liquid accounts where `exceptFromBalance` is false) and `Net Worth` (all non-deleted accounts, bank accounts, goal/savings accounts, and debt accounts) trajectories converted into the user's default currency using current account balances, exchange rates, and historical monthly net cash flows or `/stat/ping` selection data.

#### Scenario: Reconstructing monthly liquid Balance vs Net Worth
- **WHEN** historical trend data is requested for `Balance` or `Net Worth`
- **THEN** the system calculates end-of-month values in the default currency, excluding `exceptFromBalance` accounts from `Balance` while including them (and debt accounts) in `Net Worth`
