# Spec Delta

## MODIFIED Requirements

### Requirement: Throwaway debt account identification and initialization

The system SHALL recognize any non-deleted account category whose `categoryType` equals `CategoryType.DebtAccount` (type 5) as a Debt Account, irrespective of its name prefix. Users SHALL be able to initialize a new Debt Account from the Accounts & Cards section by providing an account name, a base currency (e.g., `USD`, `EUR`, `PLN`, `UAH`), and whether to exclude the account from the total liquid balance (`exceptFromBalance`, defaulting to `true`). The system SHALL create it as a native ExternalProvider debt account (`CategoryType.DebtAccount`, `icon: "debt"`), position its `order` immediately preceding the first archived (`_` prefixed) account so it does not appear below archived accounts, and persist the new and re-indexed category entities upstream via `/api/external-provider/Exchange/Ping`.

#### Scenario: Initializing a new throwaway debt account

- **WHEN** the user opens the "New Debt Account" dialog, enters `"Alex"`, selects base currency `"USD"`, leaves "Exclude from total balance" checked (true), and submits
- **THEN** the system creates a new category named `"Alex"` with `categoryType: CategoryType.DebtAccount`, `icon: "debt"`, `currencyId: "USD"`, `amount: 0`, and `exceptFromBalance: true`, inserts it immediately before the first `_`-prefixed archived account in `category.order`, persists the created and shifted categories via `/api/external-provider/Exchange/Ping`, and selects the new account to open its Clearing Ledger Workbench

#### Scenario: Preventing duplicate prefixes on initialization

- **WHEN** the user enters `"Alex"` or `"Debt: Alex"` in the account name field during initialization
- **THEN** the system creates the account without requiring synthetic `Debt:` prefixes, storing the user-provided name as a native `CategoryType.DebtAccount`

#### Scenario: Identifying active and archived throwaway debt accounts

- **WHEN** the Accounts & Cards list renders accounts where `categoryType === CategoryType.DebtAccount`
- **THEN** both active accounts (e.g. `"Alex"`) and archived accounts (e.g. `"_Past Deal"`) are badged as Debt Accounts (`Debt`) with the native scale icon and expose an action to open the Clearing Ledger Workbench

### Requirement: Recording outflows and fees on behalf of debtor

When a Debt Account is active in the Clearing Ledger Workbench, users SHALL be able to record outflows that increase the receivable balance or record associated deal fees with an explicit transaction date:
1. **Principal Purchase (Outflow on Behalf)**: Creates a transfer transaction from a selected personal account to the Debt Account. The form SHALL provide an explicit date picker (defaulting to current date in `YYYY-MM-DD` format), source and destination amounts, and optional comment. The system SHALL dispatch the transaction as an array payload `[tx]` to `/api/external-provider/api/transaction/create` containing complete .NET ticks for `dateTimestamp`, `createdTimestamp`, and `timestamp`, normalized `dateTimestampISO`, `isComplete: true`, and `debtPaymentAmount: 0`.
2. **Associated Fee**: Allows the user to specify an explicit transaction date and choose whether the **debtor absorbs the fee** (creates a transfer to the Debt Account with cross-currency conversion) or the **user absorbs the fee** (creates an expense transaction from the payment account to a selected Expense Category, leaving the Debt Account balance unchanged).

#### Scenario: Principal purchase in same currency

- **WHEN** the user records a principal purchase of `250 USD` from `"USD Card (USD)"` to debt account `"Alex (USD)"` with date set to `"2026-10-15"` and comment `"Monitor purchase"`
- **THEN** the system submits an array `[tx]` containing the transfer transaction (`sourceId: USD Card`, `destinationId: Alex`, `sourceAmount: 250`, `destinationAmount: 250`, `dateTimestamp` matching 2026-10-15 UTC midnight ticks, `createdTimestamp` matching current time ticks, `isComplete: true`) to `/api/external-provider/api/transaction/create` and refreshes account balances

#### Scenario: Cross-currency fee absorbed by debtor

- **WHEN** the user records an associated customs fee of `120 PLN` paid from `"PLN Card (PLN)"` on `"2026-10-20"` with `"Debtor absorbs fee"` selected and converted debt inflow of `30 USD` to debt account `"Alex (USD)"`
- **THEN** the system submits an array `[tx]` with the cross-currency transfer transaction (`sourceAmount: 120 PLN`, `destinationAmount: 30 USD`, date matching 2026-10-20) to `/api/external-provider/api/transaction/create`, increasing `"Alex"` receivable balance by `30 USD`

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

### Requirement: FX remainder reconciliation and zero-balance archiving

The Clearing Ledger Workbench SHALL provide a "Reconcile & Archive" closeout workflow for any Debt Account:
- **Positive Remainder (`balance > 0`, forgiven loss / FX loss)**: The system SHALL provide a date picker (defaulting to today) and pre-fill an adjustment Expense transaction for the exact remaining `balance` from the Debt Account to a user-selected Expense Category so the resulting balance equals `0.00`.
- **Negative Remainder (`balance < 0`, FX gain / overpayment)**: The system SHALL provide a date picker and pre-fill an adjustment Income transaction for `Math.abs(balance)` from a user-selected Income Source category to the Debt Account so the resulting balance equals `0.00`.
- **Zero Balance (`Math.abs(balance) < 0.005`)**: Once the balance equals `0.00` (either initially or after posting the remainder adjustment), the user SHALL be able to archive the account in one step, which prefixes the name with `_` (e.g., `_Alex`), ensures `exceptFromBalance: true`, moves the account to the end of the account order list, and persists the updated category entities via `/api/external-provider/Exchange/Ping`.

#### Scenario: Closing out a positive FX remainder and archiving

- **WHEN** debt account `"Alex (USD)"` has a remaining balance of `+1.45 USD` and the user executes "Reconcile & Archive" with date `"2026-10-24"` and target expense category `"FX Loss / Fees"`
- **THEN** the system submits an array `[tx]` with an expense transaction of `1.45 USD` from `"Alex"` to `"FX Loss / Fees"` to `/api/external-provider/api/transaction/create`, and upon success renames the account to `"_Alex"`, ensures `exceptFromBalance: true`, moves it to the end of the accounts order list, and persists the category changes via `/api/external-provider/Exchange/Ping`

#### Scenario: Closing out a negative FX remainder and archiving

- **WHEN** debt account `"Alex (USD)"` has a remaining balance of `-2.10 USD` and the user executes "Reconcile & Archive" with source income category `"FX Gain"`
- **THEN** the system submits an array `[tx]` with an income transaction of `2.10 USD` from `"FX Gain"` to `"Alex"` to `/api/external-provider/api/transaction/create`, and upon success archives the account as `"_Alex"` at the end of the accounts order list with `exceptFromBalance: true`

#### Scenario: Archiving an already zero-balance debt account

- **WHEN** debt account `"Alex (USD)"` already has a balance of `0.00 USD` and the user clicks "Archive Settled Debt Account"
- **THEN** no adjustment transaction is created, and the account is immediately renamed to `"_Alex"`, marked `exceptFromBalance: true`, moved to the end of the accounts order list, and persisted via `/api/external-provider/Exchange/Ping`

## ADDED Requirements

### Requirement: Safe proxy diagnostic logging and client error surfacing

The ExternalProvider server-side proxy route and client service SHALL provide safe structured logging for diagnostic visibility without exposing sensitive authentication material:
1. **Server Proxy Write & Error Logging**: On every non-cacheable request (such as transaction creation, updates, and category exchange), the proxy SHALL log the HTTP method, the sanitized upstream path, and the response HTTP status. In the event of an upstream non-2xx error, the proxy SHALL log the scrubbed error response body using `scrubSecrets` so credentials, bearer tokens, cookies, and user IDs are never written to logs.
2. **Proxy Request Body Isolation**: The proxy SHALL NOT inject `userId` into write request bodies (`/api/transaction/create`, `/api/transaction/update`), isolating `userId` injection strictly to read queries that require it (`/api/transaction/get`).
3. **Client Error Detail Surfacing**: When an upstream request fails, `external-provider-client.ts` SHALL extract both the error message and the scrubbed upstream `detail` property from the JSON response and surface them in thrown errors and UI error toasts.

#### Scenario: Logging a failed transaction creation upstream

- **WHEN** a client sends a transaction creation request that the upstream API rejects with HTTP `400 Bad Request` and body `{"error":"Invalid ticks"}`
- **THEN** the server proxy logs `[External API Proxy] POST /api/transaction/create -> 400 (upstream error: {"error":"Invalid ticks"})` with all secrets redacted, and the client receives a structured JSON error response containing message and detail

#### Scenario: Logging a successful transaction creation upstream

- **WHEN** a client successfully creates a transaction via `POST /api/external-provider/api/transaction/create` resulting in HTTP 200
- **THEN** the server proxy logs `[External API Proxy] POST /api/transaction/create -> 200 OK`
