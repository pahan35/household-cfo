# throwaway-debt-accounts Specification

## MODIFIED Requirements

### Requirement: Recording outflows and fees on behalf of debtor

When a Debt Account is active in the Clearing Ledger Workbench, users SHALL be able to record outflows that increase the receivable balance or record associated deal fees with an explicit transaction date:
1. **Principal Purchase (Outflow on Behalf)**: Creates a transfer transaction from a selected personal account to the Debt Account. The form SHALL provide an explicit date picker (defaulting to current date in `YYYY-MM-DD` format), source and destination amounts, and optional comment. The system SHALL dispatch the transaction as an array payload `[tx]` to `/api/external-provider/api/transaction/create` containing complete .NET ticks for `dateTimestamp`, `createdTimestamp`, and `timestamp`, normalized `dateTimestampISO`, `isComplete: true`, and `debtPaymentAmount: 0`.
2. **Associated Fee**: Allows the user to specify an explicit transaction date and choose whether the **debtor absorbs the fee** (creates a transfer to the Debt Account with cross-currency conversion) or the **user absorbs the fee** (creates an expense transaction from the payment account to a selected Expense Category, leaving the Debt Account balance unchanged).
3. **Currency Resolution Integrity**: When recording fees absorbed by the user, the fee category currency SHALL be resolved dynamically using canonical category currency resolution rather than hardcoding default currency (`PLN`), and fee entry inputs SHALL display the verified currencies of the payment account and fee category.

#### Scenario: Principal purchase in same currency
- **WHEN** the user records a principal purchase of `250 USD` from `"USD Card (USD)"` to debt account `"Alex (USD)"` with date set to `"2026-10-15"` and comment `"Monitor purchase"`
- **THEN** the system submits an array `[tx]` containing the transfer transaction (`sourceId: USD Card`, `destinationId: Alex`, `sourceAmount: 250`, `destinationAmount: 250`, `dateTimestamp` matching 2026-10-15 UTC midnight ticks, `createdTimestamp` matching current time ticks, `isComplete: true`) to `/api/external-provider/api/transaction/create` and refreshes account balances

#### Scenario: Cross-currency fee absorbed by debtor
- **WHEN** the user records an associated customs fee of `120 PLN` paid from `"PLN Card (PLN)"` on `"2026-10-20"` with `"Debtor absorbs fee"` selected and converted debt inflow of `30 USD` to debt account `"Alex (USD)"`
- **THEN** the system submits an array `[tx]` with the cross-currency transfer transaction (`sourceAmount: 120 PLN`, `destinationAmount: 30 USD`, date matching 2026-10-20) to `/api/external-provider/api/transaction/create`, increasing `"Alex"` receivable balance by `30 USD`

#### Scenario: Associated fee absorbed by user with non-default currency category
- **WHEN** the user records a fee paid from `"EUR Card (EUR)"` to an expense category `"Banking Fees EUR"`
- **THEN** the system resolves `"Banking Fees EUR"` currency as `"EUR"`, displays EUR input fields, and submits an expense transaction for the proper EUR amount without converting or hardcoding to PLN

#### Scenario: Associated fee absorbed by user
- **WHEN** the user records a fee of `120 PLN` paid from `"PLN Card (PLN)"` on `"2026-10-20"` with `"I absorb fee"` selected and targets expense category `"Fees / Commissions"`
- **THEN** the system submits an array `[tx]` with an expense transaction from `"PLN Card"` to `"Fees / Commissions"` for `120 PLN` without altering the balance of `"Alex"`

### Requirement: Recording third-party inflows and settlements

When a Debt Account is active in the Clearing Ledger Workbench, users SHALL be able to record settlements that decrease the receivable balance with an explicit transaction date across three supported settlement patterns:
1. **Case A — Debtor pays for shared expense**: Records the user's share as an Expense transaction from the Debt Account (`sourceAmount` deducted in debt currency) to a selected Expense Category (`destinationAmount` in expense currency).
2. **Case B — Debtor pays personal service provider directly**: Records an Expense transaction from the Debt Account (`sourceAmount` deducted in agreed debt currency) to the corresponding personal Expense Category.
3. **Case C — Debtor transfers money to a family member or personal account**:
   - When the recipient account is tracked in the same ExternalProvider profile: records a Transfer transaction from the Debt Account to the recipient Account.
   - When the recipient's finances are external: records an Expense transaction from the Debt Account to a selected Family/External Expense Category.
4. **Target Currency Display & Estimation**: In all settlement cases, target accounts and categories SHALL display their resolved native currency. When cross-currency settlement occurs, the workbench SHALL show the converted amount estimation computed via canonical exchange rates while allowing manual adjustment.
All settlement transactions SHALL be dispatched as an array `[tx]` to `/api/external-provider/api/transaction/create` with complete .NET ticks, normalized `dateTimestampISO`, and `isComplete: true`.

#### Scenario: Shared expense settlement (Case A)
- **WHEN** the user selects "Shared Expense" with date `"2026-10-18"`, deducting `20 USD` from debt account `"Alex (USD)"` and recording `80 PLN` into Expense Category `"Taxi / Delivery (PLN)"`
- **THEN** the system submits an array `[tx]` with an expense transaction (`sourceId: Alex`, `sourceAmount: 20`, `destinationId: Taxi / Delivery`, `destinationAmount: 80`, date matching 2026-10-18) to `/api/external-provider/api/transaction/create`, reducing `"Alex"` balance by `20 USD`

#### Scenario: Direct service provider settlement (Case B)
- **WHEN** the user selects "Direct Service Payment" with date `"2026-10-19"`, deducting `110 USD` from `"Alex (USD)"` toward Expense Category `"Psychologist"` (`100 EUR`)
- **THEN** the system creates an expense transaction from `"Alex"` (`sourceAmount: 110`) to `"Psychologist"` (`destinationAmount: 100`) and dispatches it in an array to `/api/external-provider/api/transaction/create`

#### Scenario: Family member transfer settlement to tracked account (Case C)
- **WHEN** the user selects "Family / Account Transfer" with date `"2026-10-21"` to tracked account `"Wife Card (UAH)"`, deducting `150 USD` from `"Alex (USD)"` and crediting `6200 UAH`
- **THEN** the system creates a transfer transaction from `"Alex"` (`sourceAmount: 150`) to `"Wife Card"` (`destinationAmount: 6200`) and dispatches it in an array to `/api/external-provider/api/transaction/create`
