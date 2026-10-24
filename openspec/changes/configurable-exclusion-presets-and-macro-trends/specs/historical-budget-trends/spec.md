# Spec Delta

## MODIFIED Requirements

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
