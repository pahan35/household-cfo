# Spec Delta

## Purpose

Provides lifecycle management and a two-way clearing ledger workbench for throwaway debt/clearing accounts (`Debt: <Person/Deal>`) emulated on standard ExternalProvider accounts, supporting multi-currency outflows, fees, third-party settlements, FX remainder closeout to `0.00`, and non-destructive `_` archiving.

## ADDED Requirements

### Requirement: Throwaway debt account identification and initialization

The system SHALL recognize any non-deleted account-type category whose name starts with `Debt:` (active) or `_Debt:` (archived, case-insensitive after any leading `_`) as a Throwaway Clearing Account. Users SHALL be able to initialize a new Throwaway Clearing Account from the Accounts & Cards section by providing a person or deal name, a base currency (e.g., `USD`, `EUR`, `PLN`, `UAH`), and whether to exclude the account from the total liquid balance (`exceptFromBalance`, defaulting to `false`). The system SHALL format the new account name as `Debt: <Person/Deal>` (stripping any duplicate `Debt:` or `_` prefix), create it as a standard ExternalProvider account (`CategoryType.Account`), position its `order` immediately preceding the first archived (`_` prefixed) account so it does not appear below archived accounts, and persist the new and re-indexed category entities upstream via `/api/external-provider/Exchange/Ping`.

#### Scenario: Initializing a new throwaway debt account

- **WHEN** the user opens the "New Debt Account" dialog, enters `"Alex"`, selects base currency `"USD"`, and submits
- **THEN** the system creates a new standard account named `"Debt: Alex"` with `currencyId: "USD"` and `amount: 0`, inserts it immediately before the first `_`-prefixed archived account in `category.order`, persists the created and shifted categories via `/api/external-provider/Exchange/Ping`, and selects the new account to open its Clearing Ledger Workbench

#### Scenario: Preventing duplicate prefixes on initialization

- **WHEN** the user enters `"Debt: Alex"` or `"_Debt: Alex"` in the person/deal name field during initialization
- **THEN** the system normalizes the created account name to `"Debt: Alex"` without duplicating the `Debt:` prefix or retaining a leading underscore

#### Scenario: Identifying active and archived throwaway debt accounts

- **WHEN** the Accounts & Cards list renders accounts named `"Debt: Alex"` and `"_Debt: Past Deal"`
- **THEN** both accounts are badged as Throwaway Clearing Accounts (`Clearing / Debt`) and expose an action to open the Clearing Ledger Workbench

### Requirement: Recording outflows and fees on behalf of debtor

When a Throwaway Clearing Account is active in the Clearing Ledger Workbench, users SHALL be able to record outflows that increase the receivable balance or record associated deal fees:
1. **Principal Purchase (Outflow on Behalf)**: Creates a transfer transaction from a selected personal account (e.g., `USD Card` or `PLN Card`) to `Debt: <Person>`. When the source account currency differs from the debt account's base currency, the form SHALL require both the `sourceAmount` (in source account currency) and `destinationAmount` (in debt account currency), pre-filling `destinationAmount` using ExternalProvider's exchange rates when available while allowing manual override.
2. **Associated Fee**: Allows the user to choose whether the **debtor absorbs the fee** (creates a transfer from the personal payment account to `Debt: <Person>` with cross-currency conversion, increasing the debt balance) or the **user absorbs the fee** (creates an expense transaction from the personal payment account to a selected Expense Category such as Fees/Commissions, leaving the `Debt: <Person>` balance unchanged).

#### Scenario: Principal purchase in same currency

- **WHEN** the user records a principal purchase of `250 USD` from `"USD Card (USD)"` to `"Debt: Alex (USD)"` with comment `"Monitor purchase"`
- **THEN** the system submits a transfer transaction (`sourceId: USD Card`, `destinationId: Debt: Alex`, `sourceAmount: 250`, `destinationAmount: 250`) to `/api/external-provider/api/transaction/create` and refreshes the account balance and transaction history

#### Scenario: Cross-currency fee absorbed by debtor

- **WHEN** the user records an associated customs fee of `120 PLN` paid from `"PLN Card (PLN)"` with `"Debtor absorbs fee"` selected and a converted debt inflow of `30 USD` to `"Debt: Alex (USD)"`
- **THEN** the system submits a cross-currency transfer transaction (`sourceAmount: 120 PLN`, `destinationAmount: 30 USD`) from `"PLN Card"` to `"Debt: Alex"`, increasing `"Debt: Alex"` receivable balance by `30 USD`

#### Scenario: Associated fee absorbed by user

- **WHEN** the user records a fee of `120 PLN` paid from `"PLN Card (PLN)"` with `"I absorb fee"` selected and targets expense category `"Fees / Commissions"`
- **THEN** the system submits an expense transaction from `"PLN Card"` to `"Fees / Commissions"` for `120 PLN` without altering the balance of `"Debt: Alex"`

### Requirement: Recording third-party inflows and settlements

When a Throwaway Clearing Account is active in the Clearing Ledger Workbench, users SHALL be able to record settlements that decrease the receivable balance across three supported settlement patterns:
1. **Case A — Debtor pays for shared expense**: Records only the user's share as an Expense transaction from `Debt: <Person>` (`sourceAmount` deducted in debt currency) to a selected Expense Category (`destinationAmount` recorded in the expense category's currency).
2. **Case B — Debtor pays personal service provider directly**: Records an Expense transaction from `Debt: <Person>` (`sourceAmount` deducted in agreed debt currency) to the corresponding personal Expense Category (`destinationAmount` recorded in the category's currency).
3. **Case C — Debtor transfers money to a family member or personal account**:
   - When the recipient account is tracked in the same ExternalProvider profile: records a Transfer transaction from `Debt: <Person>` (`sourceAmount` in debt currency) to the recipient Account (`destinationAmount` in recipient account currency).
   - When the recipient's finances are external: records an Expense transaction from `Debt: <Person>` (`sourceAmount` in debt currency) to a selected Family/External Expense Category (`destinationAmount` in category currency).

#### Scenario: Shared expense settlement (Case A)

- **WHEN** the user selects "Shared Expense" in the settlement form, enters total or personal share deducting `20 USD` from `"Debt: Alex (USD)"` and recording `80 PLN` into Expense Category `"Taxi / Delivery (PLN)"`
- **THEN** the system creates an expense transaction with `sourceId: Debt: Alex`, `sourceAmount: 20`, `destinationId: Taxi / Delivery`, and `destinationAmount: 80`, reducing the `"Debt: Alex"` balance by `20 USD`

#### Scenario: Direct service provider settlement (Case B)

- **WHEN** the user selects "Direct Service Payment", deducting `110 USD` from `"Debt: Alex (USD)"` toward Expense Category `"Psychologist"` (`100 EUR` / category currency)
- **THEN** the system creates an expense transaction from `"Debt: Alex"` (`sourceAmount: 110`) to `"Psychologist"` (`destinationAmount: 100`), reducing the `"Debt: Alex"` balance by `110 USD`

#### Scenario: Family member transfer settlement to tracked account (Case C)

- **WHEN** the user selects "Family / Account Transfer" to tracked account `"Wife Card (UAH)"`, deducting `150 USD` from `"Debt: Alex (USD)"` and crediting `6200 UAH` to `"Wife Card (UAH)"`
- **THEN** the system creates a transfer transaction from `"Debt: Alex"` (`sourceAmount: 150`) to `"Wife Card"` (`destinationAmount: 6200`)

### Requirement: FX remainder reconciliation and zero-balance archiving

The Clearing Ledger Workbench SHALL provide a "Reconcile & Archive" closeout workflow for any Throwaway Clearing Account:
- **Positive Remainder (`balance > 0`, forgiven loss / FX loss)**: The system SHALL pre-fill an adjustment Expense transaction for the exact remaining `balance` from `Debt: <Person>` to a user-selected Expense Category (e.g., `FX Loss / Fees`) so the resulting balance equals `0.00`.
- **Negative Remainder (`balance < 0`, FX gain / overpayment)**: The system SHALL pre-fill an adjustment Income transaction for `Math.abs(balance)` from a user-selected Income Source category (e.g., `FX Gain / Other Income`) to `Debt: <Person>` so the resulting balance equals `0.00`.
- **Zero Balance (`Math.abs(balance) < 0.005`)**: Once the balance equals `0.00` (either initially or immediately after posting the remainder adjustment), the user SHALL be able to archive the account in one step, which prefixes the name with `_` (e.g., `_Debt: Alex`), sets `exceptFromBalance: true`, moves the account to the end of the account order list, and persists the updated category entities via `/api/external-provider/Exchange/Ping`.

#### Scenario: Closing out a positive FX remainder and archiving

- **WHEN** `"Debt: Alex (USD)"` has a remaining balance of `+1.45 USD` and the user executes "Reconcile & Archive" with target expense category `"FX Loss / Fees"`
- **THEN** the system first creates an expense transaction of `1.45 USD` from `"Debt: Alex"` to `"FX Loss / Fees"`, and upon success renames the account to `"_Debt: Alex"`, sets `exceptFromBalance: true`, moves it to the end of the accounts order list, and persists the category changes via `/api/external-provider/Exchange/Ping`

#### Scenario: Closing out a negative FX remainder and archiving

- **WHEN** `"Debt: Alex (USD)"` has a remaining balance of `-2.10 USD` and the user executes "Reconcile & Archive" with source income category `"FX Gain"`
- **THEN** the system first creates an income transaction of `2.10 USD` from `"FX Gain"` to `"Debt: Alex"`, and upon success archives the account as `"_Debt: Alex"` at the end of the accounts order list with `exceptFromBalance: true`

#### Scenario: Archiving an already zero-balance debt account

- **WHEN** `"Debt: Alex (USD)"` already has a balance of `0.00 USD` and the user clicks "Archive Settled Debt Account"
- **THEN** no adjustment transaction is created, and the account is immediately renamed to `"_Debt: Alex"`, marked `exceptFromBalance: true`, moved to the end of the accounts order list, and persisted via `/api/external-provider/Exchange/Ping`
