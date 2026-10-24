# Spec Delta

## ADDED Requirements

### Requirement: Year-over-Year trends chart section

The Family Budget overview dashboard SHALL include an interactive Year-over-Year Trends section displaying multi-year spending and income patterns over the available timeline.

#### Scenario: Visualizing multi-year trends
- **WHEN** the dashboard renders with historical data loaded
- **THEN** an interactive chart renders showing monthly controllable spending or net income across available years with distinct visual series per year

#### Scenario: Switching trend display modes
- **WHEN** the user switches between monthly time-series view and side-by-side Year-over-Year comparison view
- **THEN** the chart transitions smoothly to display the selected aggregation format
