# Proposal

## Why

The current `/dashboard/family-budget` screen mixes real-time account and transaction operations (an all-time ledger) with period-bound budget analytics (month selector, pie chart, YoY trends, and category budget limits), while the transactions feed falls back to generic `"Transaction"` labels, lacks account-level filtering, hides `"Load more"` pagination behind a single-month cap, and does not show the account's native-currency running balance after each transaction. Splitting period-based budget analytics onto a dedicated Budget Overview page and upgrading the main page into an account-and-transaction review workspace makes daily ledger reconciliation and historical transaction review fast and unambiguous.

## What Changes

- **Split Family Budget into two focused screens**:
  - **Main Screen (`/dashboard/family-budget`, "Accounts & Transactions")**: Focuses on accounts, balances, and all-time transaction review. Removes the month filter selector from this screen's header and replaces `BudgetMetricsStrip` with an **Account Liquidity & Activity Strip** (Total Net Liquid Balance in default currency using ExternalProvider's `ExchangeKey.Currency` exchange rates and respecting `exceptFromBalance`, per-currency native balance breakdown, and unreconciled/debt/selected-account status).
  - **New Budget Overview Screen (`/dashboard/family-budget/budget-overview`, "Budget Overview")**: Houses the period selector (`Current Month`, `Previous Month`, and historical month focus), `BudgetMetricsStrip` (Gross Income, Net Disposable Income, Controllable Expenses), `ExpensePieCard`, `YoYTrendsCard`, and `BudgetSummaryCard`.
  - **Sidebar Navigation Update**: Under "Family Budget", list "Accounts & Transactions" (`/dashboard/family-budget`), "Budget Overview" (`/dashboard/family-budget/budget-overview`), and "FX & Inflation" (`/dashboard/family-budget/fx-inflation`).
- **Interactive Account Filtering in `AccountsCard` & `RecentTransactionsCard`**:
  - Clicking an account row in `AccountsCard` selects that account (or clears it when clicked again / via a clear filter chip) and filters the transactions feed to show all-time transactions for that account via `POST /api/transaction/get` with `categoryIds: [accountId]`.
- **All-Time Pagination ("Load More")**:
  - Fetch transactions newest-first without a single-month date restriction on the main screen (using a 20-item page size) so `hasMoreData` accurately drives incremental "Load more transactions" pagination across both all-accounts and single-account filtered views.
- **Explicit `Source -> Target` Resolution**:
  - Resolve transaction source and destination names, types, and currencies from the loaded `categories` map (`sourceId` / `destinationId`) whenever raw transaction payloads omit `sourceName` or `destinationName`, eliminating generic `"Transaction"` or `"Income"` fallbacks and clearly rendering `Source -> Target` on every transaction row.
- **Account Currency Amounts & Running Balance After Each Transaction**:
  - Display transaction amounts in the involved account's native currency (`sourceAmount` / `sourceCurrencyId` for outflows, `destinationAmount` / `destinationCurrencyId` for inflows, or cross-currency transfer pair).
  - Calculate and display the **running balance of the specific account after each transaction** (in that account's native currency) by walking backwards from each account's current live balance (`account.amount` / `currentAmount`) across the reverse-chronological transaction stream.

## Capabilities

### New Capabilities

<!-- None - extends and refines the existing `budget-overview` capability -->

### Modified Capabilities

- `budget-overview`: Update navigation requirements to include `/dashboard/family-budget/budget-overview` alongside `/dashboard/family-budget`, update account snapshot requirements to include click-to-filter selection and multi-currency liquidity metrics, and update recent transactions requirements to cover account filtering, all-time "Load more" pagination, explicit `Source -> Target` resolution, account-currency amounts, and per-transaction running account balances.

## Impact

- **Routes & Navigation**:
  - `src/navigation/sidebar/sidebar-items.ts`
  - `src/app/(main)/dashboard/family-budget/page.tsx`
  - `src/app/(main)/dashboard/family-budget/budget-overview/page.tsx` (new route)
- **Components & Data Layer**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` (currency entity parsing, `Source -> Target` resolution helper, backward running-balance calculator, multi-currency liquidity aggregation)
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` (`categoryIds` support in `getTransactionPage` and cache key, optional `ExchangeKey.Currency` extraction in `/Exchange/Ping`)
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx` (account selection state & click handler)
  - `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx` (`Source -> Target` rendering, account filter banner, running balance badge, all-time "Load more" paging)
  - `src/app/(main)/dashboard/family-budget/_components/account-liquidity-strip.tsx` (new metrics strip for Accounts & Transactions screen)
  - `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx` & `budget-overview-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` (unit tests for running balance calculation, `Source -> Target` resolution, and currency conversion)
