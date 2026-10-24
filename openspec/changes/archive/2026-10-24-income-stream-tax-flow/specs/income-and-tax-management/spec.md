# Spec Delta

## MODIFIED Requirements

### Requirement: Multi-currency tax categorization by transaction tags

The system SHALL identify dedicated tax expense categories for each active currency and categorize outgoing tax transactions by their `tags` array (attributing tags such as `#pit`, `#zus`, `#health` to their respective personal tax buckets). The system SHALL treat VAT-7 (`#vat`) transactions as neutral business pass-through payments and exclude them from personal tax calculations. The system SHALL compute total personal taxes paid, tag-based percentage distribution, and effective personal tax rate against gross client revenue.

#### Scenario: Tax transactions broken down by tag
- **WHEN** tax transactions in the tax expense category contain tags such as `#pit`, `#zus`, and `#vat`
- **THEN** the system aggregates PIT and ZUS into personal tax buckets, displays VAT-7 separately as neutral pass-through remittances, and excludes VAT-7 from the total personal taxes sum and effective personal tax rate

#### Scenario: Multiple currencies handled independently
- **WHEN** tax payments occur in multiple currencies (e.g., PLN and USD)
- **THEN** the tax breakdown presents subtotals in their native currency as well as converted totals in the user's default currency

### Requirement: Net disposable income and expense coverage analytics

The system SHALL calculate Total Gross Income, Total Tax Deductions, Effective Tax Rate (Total Taxes / Total Gross), and Net Disposable Income (Gross Income - Tax Deductions). Total Gross Income SHALL exclude tax rebates such as PFRON ("Cashback taxes") and pass-through VAT receipts. Total Tax Deductions SHALL reflect net personal taxes (PIT + Net ZUS) plus realized USD FX friction. The screen SHALL display an expense coverage indicator comparing Net Disposable Income against total controllable living expenses for the period.

#### Scenario: Calculating net disposable income and effective rate
- **WHEN** gross client revenue is 30,000 PLN, ZUS paid is 2,000 PLN, PFRON cashback is 1,200 PLN, and PIT is 3,000 PLN
- **THEN** Total Gross Income is 30,000 PLN, Net ZUS is 800 PLN, Total Personal Taxes are 3,800 PLN, Net Disposable Income is 26,200 PLN, and Effective Tax Rate is 12.7%

#### Scenario: Expense coverage comparison
- **WHEN** Net Disposable Income is 25,000 PLN and total monthly controllable expenses are 15,000 PLN
- **THEN** the system indicates an expense coverage ratio of 167% and displays the net surplus margin

### Requirement: Filtered transaction ledger for income and tax

The Income & Taxes screen SHALL include an embedded transaction ledger. Clicking an income source SHALL filter the ledger to transactions originating from that income source (`tx.sourceId === selectedSourceId`). Clicking a tax tag, audit filter, or FX friction indicator SHALL filter the ledger to transactions destined for the tax category or FX transfer matching the selected filter. When no filter is active, the ledger SHALL display exclusively transactions involving income sources, tax categories, or currency exchange transfers, and SHALL NOT fall back to arbitrary non-tax living expense transactions.

#### Scenario: Filtering transactions by income source
- **WHEN** the user selects a specific income source
- **THEN** the transaction ledger displays only transactions where that income source is the source counterpart

#### Scenario: Filtering transactions by tax tag
- **WHEN** the user clicks a specific tax tag in the tax breakdown card
- **THEN** the transaction ledger displays only tax transactions carrying that tag

#### Scenario: Default ledger state without matching tax transactions
- **WHEN** no filter is selected and the period contains zero income or tax transactions
- **THEN** the transaction ledger renders an empty state explaining that no income or tax transactions exist for the period, rather than listing arbitrary living expense transactions

## ADDED Requirements

### Requirement: PFRON ZUS contra-rebate netting

The system SHALL detect PFRON subsidy inflows from the `"Cashback taxes"` income source and apply them as a direct contra-rebate against ZUS social security expenses (`Net ZUS = Gross ZUS Outflow - Cashback Taxes Inflow`). The system SHALL NOT count `"Cashback taxes"` toward Gross Client Income, and SHALL badge the source as a tax rebate in the income sources listing.

#### Scenario: Netting PFRON cashback against ZUS
- **WHEN** a 600 PLN inflow arrives from `"Cashback taxes"` and 1,000 PLN is paid to ZUS
- **THEN** the ZUS metric displays Net ZUS as -400 PLN with a breakdown showing 1,000 PLN paid and 600 PLN refunded, while Gross Income excludes the 600 PLN

#### Scenario: Badging Cashback taxes in income sources list
- **WHEN** the income sources list renders the `"Cashback taxes"` category
- **THEN** it displays a "Tax Rebate / ZUS Offset" badge and clarifies that amounts are credited against ZUS contributions

### Requirement: USD FX and VAT-7 currency friction tracking

The system SHALL compute realized foreign exchange friction for USD income streams, comprising trade spread loss (the difference between realized Kantor conversion rates and official NBP mid-market rates on account-to-account transfers) and VAT-7 currency rate drag (the difference between the USD equivalent of invoiced PLN VAT and the actual USD expended to acquire the PLN needed for remittance).

#### Scenario: Tracking Kantor trade spread on USD exchange
- **WHEN** 3,000 USD is exchanged from a USD business account to a PLN account at an effective rate of 3.98 PLN/USD while the NBP mid-market rate is 4.02 PLN/USD
- **THEN** the system calculates an FX trade spread loss of 120 PLN and attributes it as foreign exchange friction

#### Scenario: Tracking VAT-7 currency rate drag
- **WHEN** a USD invoice fixes VAT at 9,430 PLN (equivalent to 2,300 USD at 4.10 NBP rate), but the user exchanges USD at 3.95 PLN/USD to remit the VAT
- **THEN** the system calculates a VAT-7 currency drag of 87.34 USD (345 PLN) representing the loss on pass-through currency conversion
