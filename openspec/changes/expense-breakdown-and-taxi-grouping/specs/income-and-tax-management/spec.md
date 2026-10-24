# Spec Delta: income-and-tax-management

## MODIFIED Requirements

### Requirement: Multi-currency tax categorization by transaction tags

The system SHALL identify dedicated tax expense categories for each active currency using word-boundary matching on tax terminology (ensuring transport categories such as `Taxi PLN` or `Taxi / Delivery` are not classified as taxes) and categorize outgoing tax transactions by their `tags` array (attributing tags such as `#pit`, `#zus`, `#vat`, `#health` to their respective tax buckets). The system SHALL compute total taxes paid, tag-based percentage distribution, and effective tax rate against gross income.

#### Scenario: Dedicated tax categories identified with word boundaries
- **WHEN** categories are evaluated for tax classification
- **THEN** categories matching tax patterns with word boundaries (e.g. `Tax PLN`, `Taxes & ZUS`, `Podatki`) are identified as dedicated tax categories, while ride-hailing and transit categories containing `"taxi"` (e.g. `Taxi PLN`) are excluded from tax identification and preserved as living expenses

#### Scenario: Tax transactions broken down by tag
- **WHEN** tax transactions in the tax expense category contain tags such as `#pit` and `#zus`
- **THEN** the system aggregates tax sums by tag, displaying distinct subtotals and percentages for PIT, ZUS, and other tagged tax types

#### Scenario: Multiple currencies handled independently
- **WHEN** tax payments occur in multiple currencies (e.g., PLN and USD)
- **THEN** the tax breakdown presents subtotals in their native currency as well as converted totals in the user's default currency
