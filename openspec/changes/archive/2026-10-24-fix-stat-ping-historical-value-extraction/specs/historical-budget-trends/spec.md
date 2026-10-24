# Spec Delta

## MODIFIED Requirements

### Requirement: Historical time-series extraction

The system SHALL extract and chronologically sort all available points returned by the `/stat/ping` query, validating point identifiers and timestamps across up to 40 historical periods, and SHALL derive each historical period's category spending and income from the period-specific `value` field on each category entry (falling back to `amount` or `currentAmount` only when `value` is undefined) rather than the static current-period `amount` snapshot.

#### Scenario: Processing multi-period response
- **WHEN** `/stat/ping` returns points spanning multiple years where each category entry includes both a period-specific `value` and a static current-month `amount`
- **THEN** all points are parsed, ordered from oldest to newest by normalized month-start date, and aggregated using each point's `value` so historical months display distinct monthly totals and accurate Year-over-Year deltas
