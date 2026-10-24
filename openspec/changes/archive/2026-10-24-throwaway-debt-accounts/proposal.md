# Proposal

## Why

In ExternalProvider ("Unlimited Premium" / legacy tiers), there is no dedicated Debt account workflow for tracking multi-currency third-party purchases, shared expenses, or complex settlements. Instead, third-party receivables and clearing deals are tracked by creating temporary standard ExternalProvider accounts (`Debt: <Person/Deal>`) and archiving them with a leading `_` prefix (`_Debt: <Person/Deal>`) once their balance reaches `0.00` so historical transactions and analytics remain intact. Currently, initializing these throwaway debt accounts, recording cross-currency principal outflows, absorbed/reimbursed fees, third-party expense/transfer settlements, and FX remainder closeouts requires tedious, error-prone manual calculations and multi-step setup in ExternalProvider.

## What Changes

- **Throwaway Clearing / Debt Account Recognition & Filtering**: Recognize standard ExternalProvider accounts (`CategoryType.Account`) whose name starts with `Debt:` (active) or `_Debt:` (archived) as Throwaway Clearing Accounts, displaying dedicated visual badges and quick actions in `AccountsCard` alongside the account archiving and reordering tools from `archive-and-reorder-accounts`.
- **Initialize Throwaway Debt Account (`debt init`)**: Add a dialog in `AccountsCard` to create a new standard ExternalProvider account named `Debt: <Person/Deal>` with a selected base currency (e.g., `USD`, `EUR`, `PLN`, `UAH`), optional `exceptFromBalance` toggle, and automatic positioning immediately above the first archived account (reusing the `archive-and-reorder-accounts` ordering convention so newly created debt accounts never sit below `_` archived accounts).
- **Interactive Clearing Ledger Workbench**: When a `Debt:` account is selected in `/dashboard/family-budget` (or via its row action), render a dedicated **Clearing Ledger Panel / Drawer** with four guided workflow actions that construct and sync ExternalProvider transactions via `/api/external-provider/api/transaction/create` (and `/Exchange/Ping` for account state):
  1. **Outflow on Behalf (Principal Purchase)**: Record an asset transfer from a real personal account (e.g., `USD Card` or `PLN Card`) to `Debt: <Person>` with cross-currency conversion calculation (`sourceAmount` -> `destinationAmount`).
  2. **Associated Fee**: Record a fee either absorbed by the debtor (transfer from a personal account to `Debt: <Person>` with currency conversion) or absorbed by the user (expense from a personal account to a Fees/Commissions expense category).
  3. **Inflow / Third-Party Settlement**: Record debtor repayments via:
     - *Case A (Shared Expense)*: Expense from `Debt: <Person>` to an Expense Category (e.g., `Taxi / Delivery`) deducting the user's share in the debt currency and recording the expense in the category's currency.
     - *Case B (Direct Service Provider Payment)*: Expense from `Debt: <Person>` to a personal Expense Category (e.g., `Psychologist`) with agreed debt deduction and category currency amount.
     - *Case C (Transfer to Family Member)*: Either a Transfer from `Debt: <Person>` to a tracked family Account (converting debt currency to recipient account currency) or an Expense to a Family/Wife category if external.
  4. **Reconciliation & Closeout (`debt settle` & `debt archive`)**: Automatically detect any FX / rounding remainder on `Debt: <Person>`:
     - If `balance > 0` (forgiven loss): generate an adjustment Expense from `Debt: <Person>` to an FX Loss / Fees category to bring the balance to `0.00`.
     - If `balance < 0` (FX gain): generate an adjustment Income from an FX Gain income source to `Debt: <Person>` to bring the balance to `0.00`.
     - Once `balance == 0.00`, trigger the archive workflow (`archiveAccountCategory` from `archive-and-reorder-accounts`), renaming to `_Debt: <Person>`, setting `exceptFromBalance = true`, and moving the account to the end of the account order list.
- **Proxy Cache Invalidation on Transaction Writes**: Ensure `/api/external-provider/api/transaction/create` and `/api/external-provider/api/transaction/update` automatically invalidate cached `/Exchange/Ping`, `/api/transaction/get`, and `/stat/ping` entries so account balances and transaction feeds update immediately after any clearing operation.

## Capabilities

### New Capabilities
- `throwaway-debt-accounts`: Lifecycle management and accounting workbench for throwaway clearing/debt accounts (`Debt: <Person/Deal>`), including account initialization above archived accounts, principal and fee outflows, multi-currency third-party settlements, FX remainder reconciliation to `0.00`, and one-click archiving.

### Modified Capabilities
- `budget-overview`: Integrate throwaway debt account creation, visual badges, transaction write cache invalidation, and clearing ledger selection into the Accounts & Transactions screen (`/dashboard/family-budget`).

## Impact

- **Affected Code**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`: Pure domain helpers for identifying `Debt:` accounts, building new category entities positioned above archived accounts, constructing double-entry ExternalProvider transaction payloads (with `.NET` ticks timestamps and cross-currency conversions), and computing FX closeout adjustments.
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`: Client mutation helpers `createCategory` (via `/Exchange/Ping`) and `createTransaction` (via `/api/transaction/create` / `/Exchange/Ping`) with client cache invalidation.
  - `src/app/api/external-provider/[...path]/route.ts`: Cache invalidation for `/api/transaction/create` and `/api/transaction/update`.
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`: "New Debt Account" button, `Debt` badge on `Debt:` accounts, and quick action to open the Clearing Workbench.
  - `src/app/(main)/dashboard/family-budget/_components/debt-account-init-dialog.tsx`: Modal dialog to initialize a `Debt: <Person/Deal>` account.
  - `src/app/(main)/dashboard/family-budget/_components/debt-clearing-panel.tsx`: Interactive clearing ledger panel/drawer for recording principal outflows, fees, third-party settlements, FX closeout, and archiving.
  - `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`: State wiring between `AccountsCard`, `DebtClearingPanel`, and `RecentTransactionsCard`.
- **Dependencies**: Uses existing `archive-and-reorder-accounts` helpers (`archiveAccountCategory`, `moveAccountsAboveArchived`, `findAccountsBelowArchived`) and existing shadcn/ui components (`Dialog`, `Sheet`/`Drawer`, `Tabs`, `Select`, `Input`, `Badge`, `Button`).
