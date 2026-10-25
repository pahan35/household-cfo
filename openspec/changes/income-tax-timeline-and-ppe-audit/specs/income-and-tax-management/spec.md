# Spec Delta

## MODIFIED Requirements

### Requirement: Multi-currency tax categorization by transaction tags

The system SHALL identify dedicated tax expense categories for each active currency using word-boundary matching on tax terminology (ensuring transport categories such as `Taxi PLN` or `Taxi / Delivery` are not classified as taxes) and categorize outgoing tax transactions by their `tags` array. The system SHALL attribute flat-rate personal income tax payments to the primary canonical tag `#PPE` (while recognizing `#pit` and related terms as aliases), attribute social security contributions to `#zus`, healthcare contributions to `#health`, and capital gains to `#belka`. The system SHALL treat VAT-7 (`#VAT-7`) transactions as neutral business pass-through payments (while recognizing `#vat` as an alias) and exclude them from personal tax calculations. The system SHALL compute total personal taxes paid, tag-based percentage distribution, and effective personal tax rate against gross client revenue.

#### Scenario: Dedicated tax categories identified with word boundaries
- **WHEN** categories are evaluated for tax classification
- **THEN** categories matching tax patterns with word boundaries (e.g. `Tax PLN`, `Taxes & ZUS`, `Podatki`) are identified as dedicated tax categories, while ride-hailing and transit categories containing `"taxi"` (e.g. `Taxi PLN`) are excluded from tax identification and preserved as living expenses

#### Scenario: Tax transactions broken down by tag
- **WHEN** tax transactions in the tax expense category contain tags such as `#PPE` (or `#pit`), `#zus`, and `#VAT-7` (or `#vat`)
- **THEN** the system aggregates PPE/PIT and ZUS into personal tax buckets under primary `#PPE` designation, displays VAT-7 separately as neutral pass-through remittances under primary `#VAT-7` designation, and excludes VAT-7 from the total personal taxes sum and effective personal tax rate

#### Scenario: Multiple currencies handled independently
- **WHEN** tax payments occur in multiple currencies (e.g., PLN and USD)
- **THEN** the tax breakdown presents subtotals in their native currency as well as converted totals in the user's default currency

### Requirement: Missing tax tag audit and quick-fix remediation

The system SHALL audit all transactions sent to dedicated tax categories and flag any transaction that lacks a recognized tax tag (`#PPE`, `#zus`, `#health`, `#VAT-7`, `#belka`, or their recognized aliases). The system SHALL present an audit alert listing untagged transactions and provide an inline tag selector presenting primary canonical tags (`#PPE`, `#VAT-7`, `#zus`, `#health`, `#belka`) allowing the user to choose a tag and save it. Saving SHALL invoke `/api/transaction/update` to persist the updated tags array and immediately clear the audit flag.

#### Scenario: Detecting untagged tax transactions
- **WHEN** one or more transactions in a tax category have an empty tags array or lack recognized tax tags (`#PPE`, `#zus`, `#health`, `#VAT-7`, `#belka`)
- **THEN** the system renders a warning badge indicating the number of untagged tax transactions and displays them in the audit list with the updated `#PPE` / `#VAT-7` guidance

#### Scenario: Recognizing transactions tagged with PPE and VAT-7
- **WHEN** a tax transaction is tagged with `#PPE` or `#VAT-7` (or lowercase variants)
- **THEN** the system recognizes the transaction as properly tagged and does not flag it as an untagged audit violation

#### Scenario: Applying a quick-fix tag to an untagged transaction
- **WHEN** the user selects `#PPE` or `#VAT-7` from the inline selector on an untagged transaction and clicks save
- **THEN** the system sends the updated transaction with the chosen tag to `/api/external-provider/api/transaction/update`, removes the transaction from the untagged audit list, and updates the tag breakdown

## ADDED Requirements

### Requirement: Historical income and tax timeline analytics

The system SHALL render an interactive chronological timeline chart on `/dashboard/family-budget/income` displaying historical monthly gross income alongside the corresponding tax deductions broken down by tax component (`#PPE`, `#health`, and net `#zus` after PFRON contra-rebates). The chart SHALL display an Effective Tax Rate trendline calculated as net personal taxes divided by selected taxable gross income across available months. The timeline SHALL support a timing alignment toggle between **Cash Basis** (taxes displayed in the month they were paid) and **Accrual Basis** (tax payments shifted back by one month $M-1$ to align with the invoice earnings that generated the tax liability).

#### Scenario: Rendering chronological income and tax flow
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** the system displays the Income & Taxation Timeline chart showing monthly stacked bars for taxes paid overlaid on or paired with gross income, alongside the monthly effective tax rate curve

#### Scenario: Netting PFRON contra-rebate within the historical timeline
- **WHEN** a month contains both ZUS social security payments (e.g. 1,600 PLN) and PFRON cashback receipts (e.g. 1,200 PLN)
- **THEN** the timeline displays the net ZUS contribution (400 PLN) in the tax stack and reflects the reduced net tax burden in the effective tax rate calculation for that month

#### Scenario: Switching between cash basis and accrual basis
- **WHEN** the user switches the timeline view mode to Accrual Basis
- **THEN** tax payments paid in month $M$ (such as February PPE and ZUS) are shifted to month $M-1$ (January) to align directly against January invoice revenue

### Requirement: Multi-select income source filtering and taxation inspection

The system SHALL provide interactive source selection controls within the timeline chart enabling users to toggle individual income sources on or off. When specific income sources are selected, the chart SHALL dynamically recalculate the gross income total and display the effective taxation and net yield corresponding to the selected revenue stream.

#### Scenario: Isolating a specific B2B income source
- **WHEN** the user selects a specific B2B client income source and deselects others
- **THEN** the timeline chart updates its gross bars to represent only that income source's monthly revenue and shows how that income was taxed over time

#### Scenario: Excluding non-taxable or rebate sources from gross client revenue
- **WHEN** the timeline aggregates gross client revenue
- **THEN** PFRON "Cashback taxes" is excluded from the gross earnings stack and preserved strictly as a contra-tax credit
