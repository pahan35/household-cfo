# Spec Delta

## ADDED Requirements

### Requirement: Dual Expenses and Income chronological series
The system SHALL compute a chronological monthly series pairing Net Disposable Income and Controllable Expenses (under the active exclusion preset) for each historical period so that both curves and their net surplus/deficit delta can be plotted simultaneously over a selectable `[from, to]` date window.

#### Scenario: Computing dual series across a zoomed date window
- **WHEN** the user selects a 6-month, 12-month, 24-month, or custom `[from, to]` window in `Expenses & Income` mode
- **THEN** the system returns chronologically ordered monthly points within that window containing `netIncome`, `controllableExpense`, and `netMargin` in the default currency

### Requirement: Historical Balance and Net Worth trajectory reconstruction
The system SHALL compute historical monthly `Balance` (liquid accounts where `exceptFromBalance` is false) and `Net Worth` (all non-deleted accounts, bank accounts, goal/savings accounts, and debt accounts) trajectories converted into the user's default currency using current account balances, exchange rates, and historical monthly net cash flows or `/stat/ping` selection data.

#### Scenario: Reconstructing monthly liquid Balance vs Net Worth
- **WHEN** historical trend data is requested for `Balance` or `Net Worth`
- **THEN** the system calculates end-of-month values in the default currency, excluding `exceptFromBalance` accounts from `Balance` while including them (and debt accounts) in `Net Worth`
