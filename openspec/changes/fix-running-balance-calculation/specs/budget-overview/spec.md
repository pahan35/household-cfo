# Spec Delta

## MODIFIED Requirements

### Requirement: Recent transactions list

The screen SHALL display all-time transactions in reverse-chronological order (either across all accounts or filtered by a selected account via `categoryIds`), each showing its date, explicit source and target names (`Source -> Target`) resolved from the categories lookup when omitted from the raw transaction payload, direction-aware amount in the account's native currency, any comment or tags, and the running balance of the involved account after that transaction in the account's currency. Running balances SHALL be anchored on the account's live balance (`category.amount`), correctly resolving against upstream payloads that include `currentAmount: 0.0`. Additional older transactions SHALL be retrievable via incremental "Load more" paging whenever `hasMoreData` is true.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData` and account categories with `amount` and `currentAmount: 0.0`
- **THEN** a first page of transactions is listed newest-first with date, resolved source and target category names (`Source -> Target`), direction-aware amount in the account's native currency, comment/tags (if any), and the calculated running balance of the account immediately after that transaction anchored on the account's live balance (`amount`)

#### Scenario: Filtering transactions by selected account

- **WHEN** an account is selected in the accounts list
- **THEN** the transactions list fetches and displays transactions for that `accountId`, shows an active filter indicator with the account's name and current balance in its native currency (extracted from `amount`), and displays the account's running balance after each transaction

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page of older transactions (globally or for the selected account) is fetched with the continuation (`skip`), appended without duplicating already-shown items, and running account balances are continuously calculated across the appended rows

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions for the current view or selected account
- **THEN** the transactions section shows an empty state (with an option to clear the account filter if one is active)

### Requirement: Automated regression tests for budget data transforms

The application SHALL include automated unit tests verifying the data ingestion and transformation pipeline for budget statistics, expense composition, year-over-year trends, and transaction running balance calculation. The test suite SHALL run via an npm script and execute in under 5 seconds without requiring live network access or keychain credentials.

#### Scenario: Unit tests validate category spend extraction and fallbacks

- **WHEN** `transformExpenses` receives statistics categories with `amount`, `currentAmount`, or `value`, or missing metadata names
- **THEN** the transformed expenses accurately extract the non-zero spent amounts and category names without defaulting to zero

#### Scenario: Unit tests validate date parsing across historical points

- **WHEN** `parsePointDate` and YoY transforms process statistics points with `id` (`"yyyy-MM-dd"`) or `date` (`"M-yyyy"`)
- **THEN** valid Date objects are returned and historical spending is aggregated without dropping points or producing `Invalid Date`

#### Scenario: Unit tests validate transaction running balance calculation with upstream payloads

- **WHEN** `computeTransactionsWithRunningBalance` and `getAccountBalance` process accounts containing non-zero `amount` alongside upstream `currentAmount: 0.0`
- **THEN** initial balances anchor to `amount` rather than `0.0`, and running balances calculate backwards from the live account balance
