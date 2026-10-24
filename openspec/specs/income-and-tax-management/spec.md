# income-and-tax-management Specification

## Purpose

Provides income source lifecycle management (ordering, soft-archiving, budgeting), multi-currency tax transaction breakdown by tag, missing tax tag auditing with quick-fix remediation, and net disposable income analytics.

## Requirements

### Requirement: Income source listing and metrics

The system SHALL list all non-deleted ExternalProvider income sources (`CategoryType.Income`) with their current period received amount, budgeted target (`limitAmount`), assigned currency, and last transaction summary (date, counterpart, amount). Active income sources SHALL be displayed in ascending `category.order` sequence.

#### Scenario: Viewing active income sources
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** all non-archived income sources are displayed with their period earnings, budgeted limits, and last transaction summary in ascending order sequence

#### Scenario: Missing budget target fallback
- **WHEN** an income source does not specify a `limitAmount` or specifies zero
- **THEN** the income source row displays the actual earnings without an overrun/adherence warning and indicates no target set

### Requirement: Income source reordering and upstream synchronization

The system SHALL allow users to reorder income sources via drag-and-drop. The reordered sequence SHALL update each affected income source's `order` property sequentially and persist the modified categories to ExternalProvider via `/Exchange/Ping` under `ExchangeKey.Category`, invalidating the cached categories.

#### Scenario: Drag-and-drop reordering persists upstream
- **WHEN** the user drags an income source to a new position in the list
- **THEN** the updated order is persisted upstream to `/api/external-provider/Exchange/Ping` and cached categories are refreshed without page reload

### Requirement: Income source soft-archiving and unarchiving

The system SHALL allow users to archive an active income source via an archive action, which SHALL prepend `_` to its name, move it to the end of the income source order list, and persist the update to ExternalProvider via `/Exchange/Ping`. Archived income sources SHALL be hidden by default and viewable on demand via a toggle. Users SHALL be able to unarchive an archived income source, which SHALL strip the leading `_` prefix, move it to immediately precede the first archived income source, and persist the update upstream.

#### Scenario: Archiving an income source
- **WHEN** the user triggers the archive action on an active income source
- **THEN** the income source name is prefixed with `_`, moved after the last active source, persisted to ExternalProvider, and hidden from the default active list

#### Scenario: Unarchiving an income source
- **WHEN** the user unarchives a soft-archived income source from the archived list
- **THEN** the leading `_` prefix is stripped, the source is repositioned to become the last active source, and the updated sequence is persisted upstream

### Requirement: Multi-currency tax categorization by transaction tags

The system SHALL identify dedicated tax expense categories for each active currency and categorize outgoing tax transactions by their `tags` array (attributing tags such as `#pit`, `#zus`, `#vat`, `#health` to their respective tax buckets). The system SHALL compute total taxes paid, tag-based percentage distribution, and effective tax rate against gross income.

#### Scenario: Tax transactions broken down by tag
- **WHEN** tax transactions in the tax expense category contain tags such as `#pit` and `#zus`
- **THEN** the system aggregates tax sums by tag, displaying distinct subtotals and percentages for PIT, ZUS, and other tagged tax types

#### Scenario: Multiple currencies handled independently
- **WHEN** tax payments occur in multiple currencies (e.g., PLN and USD)
- **THEN** the tax breakdown presents subtotals in their native currency as well as converted totals in the user's default currency

### Requirement: Missing tax tag audit and quick-fix remediation

The system SHALL audit all transactions sent to dedicated tax categories and flag any transaction that lacks a recognized tax tag. The system SHALL present an audit alert listing untagged transactions and provide an inline tag selector allowing the user to choose a tag and save it. Saving SHALL invoke `/api/transaction/update` to persist the updated tags array and immediately clear the audit flag.

#### Scenario: Detecting untagged tax transactions
- **WHEN** one or more transactions in a tax category have an empty tags array or no recognized tax tag
- **THEN** the system renders a warning badge indicating the number of untagged tax transactions and displays them in the audit list

#### Scenario: Applying a quick-fix tag to an untagged transaction
- **WHEN** the user selects a tax tag from the inline selector on an untagged transaction and clicks save
- **THEN** the system sends the updated transaction with the chosen tag to `/api/external-provider/api/transaction/update`, removes the transaction from the untagged audit list, and updates the tag breakdown

### Requirement: Net disposable income and expense coverage analytics

The system SHALL calculate Total Gross Income, Total Tax Deductions, Effective Tax Rate (Total Taxes / Total Gross), and Net Disposable Income (Gross Income - Tax Deductions). The screen SHALL display an expense coverage indicator comparing Net Disposable Income against total controllable living expenses for the period.

#### Scenario: Calculating net disposable income and effective rate
- **WHEN** gross income is 30,000 PLN and tax transactions total 5,000 PLN
- **THEN** the metrics strip displays Net Disposable Income as 25,000 PLN and Effective Tax Rate as 16.7%

#### Scenario: Expense coverage comparison
- **WHEN** Net Disposable Income is 25,000 PLN and total monthly controllable expenses are 15,000 PLN
- **THEN** the system indicates an expense coverage ratio of 167% and displays the net surplus margin

### Requirement: Filtered transaction ledger for income and tax

The Income & Taxes screen SHALL include an embedded transaction ledger. Clicking an income source SHALL filter the ledger to transactions originating from that income source (`tx.sourceId === selectedSourceId`). Clicking a tax tag or audit filter SHALL filter the ledger to transactions destined for the tax category matching the selected tag or audit state.

#### Scenario: Filtering transactions by income source
- **WHEN** the user selects a specific income source
- **THEN** the transaction ledger displays only transactions where that income source is the source counterpart

#### Scenario: Filtering transactions by tax tag
- **WHEN** the user clicks a specific tax tag in the tax breakdown card
- **THEN** the transaction ledger displays only tax transactions carrying that tag
