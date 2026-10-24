# Spec Delta

## MODIFIED Requirements

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, year-over-year trends, and transaction running balance calculation. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks

- **WHEN** `transformExpenses` and `computeBudgetSummaryItems` receive statistics categories with `value`, `amount`, or `currentAmount`, or missing metadata names
- **THEN** the transforms prioritize period-specific `value` over static category `amount` snapshots (falling back to `amount` and `currentAmount` only when `value` is absent) and accurately extract non-zero spent amounts and category names without defaulting to zero or repeating current-month snapshots across historical periods

#### Scenario: Unit tests validate date parsing across historical points

- **WHEN** `parsePointDate` and YoY/chronological transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`) where `amount` holds a constant current-month snapshot while `value` varies per period
- **THEN** valid Date objects are returned, historical spending is aggregated from `value` without dropping points or producing `Invalid Date`, and YoY deltas reflect true period-over-period variance

#### Scenario: Unit tests validate transaction running balance calculation with upstream payloads

- **WHEN** `computeTransactionsWithRunningBalance` and `getAccountBalance` process accounts containing non-zero `amount` alongside upstream `currentAmount: 0.0`
- **THEN** initial balances anchor to `amount` rather than `0.0`, and running balances calculate backwards from the live account balance
