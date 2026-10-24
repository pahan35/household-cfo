# Spec Delta

## MODIFIED Requirements

### Requirement: Year-over-Year trends chart section

The Family Budget overview dashboard SHALL include an interactive Historical & Year-over-Year Trends section displaying multi-year spending, income, liquid balance, and net worth patterns over the available timeline. The chart SHALL support five macro metric modes inspired by ExternalProvider Web (`Expenses & Income` dual-curve overlay, `Expenses`, `Income`, `Balance`, and `Net Worth`), switching between continuous chronological timeline (`APR'26 -> OCT'26`) and Year-over-Year calendar month alignment (`Jan -> Dec`), and range zoom controls (`6M`, `12M`, `24M`, `All` / custom period).

#### Scenario: Visualizing multi-year trends
- **WHEN** the dashboard renders with historical data loaded
- **THEN** an interactive chart renders showing monthly controllable spending, net income, dual-series expenses vs. income, liquid balance, or net worth across the selected timeline or Year-over-Year series

#### Scenario: Viewing dual Expenses and Income overlay
- **WHEN** the user selects the `Expenses & Income` chart mode
- **THEN** the chart renders both monthly controllable expenses and net disposable income on the same chronological axis, highlighting the monthly net surplus or deficit in the tooltip

#### Scenario: Viewing Balance or Net Worth historical trajectory
- **WHEN** the user selects `Balance` or `Net Worth` chart mode
- **THEN** the chart renders the historical end-of-month liquid balance (excluding `exceptFromBalance` accounts) or total net worth (including savings/goals and debt accounts) converted to the default currency

#### Scenario: Switching trend display modes
- **WHEN** the user switches between continuous monthly time-series view and side-by-side Year-over-Year comparison view, or adjusts the timeline zoom (`+` / `-` or period range selector)
- **THEN** the chart transitions smoothly to display the selected aggregation format and date window
