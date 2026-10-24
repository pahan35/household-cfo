# Design

## Context

See `proposal.md` for motivation and `specs/budget-overview/spec.md` for behavioral requirements.

Currently:
- `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx` renders all widgets on a single page (`/dashboard/family-budget`), coupling an all-time account ledger with a period-bound budget dashboard.
- `RecentTransactionsCard` is controlled by `periodTransactions` fetched with `period: { from, to }` and `take: 100`. Because a single month rarely exceeds 100 transactions, `hasMoreData` is almost always `false`, preventing users from paging through historical transactions.
- Upstream `POST /api/transaction/get` payloads frequently omit `sourceName`, `destinationName`, `sourceType`, `destinationType`, `sourceCurrencyId`, and `destinationCurrencyId`, supplying only `sourceId` and `destinationId` GUIDs. Without a `categories` lookup map, `RecentTransactionsCard` falls back to `"Transaction"` or `"Income"`.
- Upstream `POST /api/transaction/get` accepts `categoryIds: string[]`, which filters transactions server-side to those where `sourceId` or `destinationId` matches any ID in `categoryIds`.
- Upstream `POST /Exchange/Ping` supports requesting multiple keys in a single round-trip: `ExchangeKey.Category` (`2`) and `ExchangeKey.Currency` (`4`), where currency entities have `{ id: "PLN", rate: 4.02, ... }` relative to `"USD"`.

## Goals / Non-Goals

**Goals:**
- Separate the real-time **Accounts & Transactions** workspace (`/dashboard/family-budget`) from the period-driven **Budget Overview** analytics screen (`/dashboard/family-budget/budget-overview`).
- Enable one-click account filtering from `AccountsCard` to `RecentTransactionsCard` backed by server-side `categoryIds` queries and all-time `"Load more"` pagination (`take: 20`).
- Resolve every transaction's `Source` and `Target` category metadata (`name`, `categoryType`, `currencyId`) from the `categories` map so every row explicitly shows `Source -> Target`.
- Compute and display the exact **running balance after each transaction** in the account's native currency by walking backwards from each account's current live balance (`account.amount` / `currentAmount`).
- Replace `BudgetMetricsStrip` on the Accounts & Transactions screen with `AccountLiquidityStrip`, accurately converting multi-currency balances into the user's default currency using ExternalProvider's `ExchangeKey.Currency` rates and respecting `exceptFromBalance`.

**Non-Goals:**
- Creating, editing, or deleting transactions upstream (read and review only in this change).
- Modifying `/dashboard/family-budget/fx-inflation` or its macro analysis components.

## Decisions

### 1. Screen Split & Component Co-location

- **Decision**: Keep all components co-located under `src/app/(main)/dashboard/family-budget/_components/` since `/dashboard/family-budget` and `/dashboard/family-budget/budget-overview` share the same domain models, client cache, and category/transaction utilities.
  - `/dashboard/family-budget/page.tsx` renders `FamilyBudgetDashboard` (Accounts & Transactions workspace: header without month selector, `AccountLiquidityStrip`, 5-col `AccountsCard` + 7-col `RecentTransactionsCard`).
  - `/dashboard/family-budget/budget-overview/page.tsx` renders `BudgetOverviewDashboard` (Period selector header, `BudgetMetricsStrip`, `ExpensePieCard`, `YoYTrendsCard`, and `BudgetSummaryCard`).
- **Alternatives considered**: Moving shared components to `src/app/(main)/dashboard/_components/`. Rejected per `AGENTS.md` co-location rules because all components remain inside the `family-budget` route subtree.

### 2. Fetching Categories and Currencies Together via `/Exchange/Ping`

- **Decision**: Extend `/Exchange/Ping` category fetching (or provide `getExchangeBootstrap` / `getCurrencies` alongside `getCategories`) to request both `ExchangeKey.Category` (`2`) and `ExchangeKey.Currency` (`4`), or extract `ExternalProviderCurrency` (`{ id: string; rate?: number; sign?: string }`).
- ExternalProvider's `CurrencyManager.convert(fromCurrencyId, amount, toCurrencyId)` converts via `USD` as base (`rate` is units per 1 USD):
  - `inUsd = fromCurrencyId === "USD" || !fromRate ? amount : amount / fromRate`
  - `inTarget = toCurrencyId === "USD" || !toRate ? inUsd : inUsd * toRate`
- If currency rates are unavailable or missing for a code, fallback gracefully to 1:1 for matching currency codes and display native currency subtotals without failing.

### 3. Explicit `Source -> Target` Resolution & Direction Model

- **Decision**: Introduce a pure helper `resolveTransactionEndpoints(tx, categoryById, defaultCurrency)` in `external-provider-data.ts`:
  - Looks up `sourceCategory = categoryById.get(tx.sourceId)` and `destCategory = categoryById.get(tx.destinationId)`.
  - Resolves `sourceName = tx.sourceName || sourceCategory?.name || "Unknown Source"` and `destinationName = tx.destinationName || destCategory?.name || "Unknown Target"`.
  - Resolves `sourceType = tx.sourceType ?? sourceCategory?.categoryType` and `destinationType = tx.destinationType ?? destCategory?.categoryType`.
  - Resolves `sourceCurrency = tx.sourceCurrencyId || sourceCategory?.currencyId || defaultCurrency` and `destinationCurrency = tx.destinationCurrencyId || destCategory?.currencyId || defaultCurrency`.
  - Determines whether each endpoint is an account (`CategoryType.Account`, `CategoryType.BankAccount`, `CategoryType.DebtAccount`).

### 4. Backward Running Balance Algorithm (`computeTransactionsWithRunningBalance`)

- **Decision**: Because `POST /api/transaction/get` returns transactions in reverse-chronological order (newest first) starting from the present, we compute running balances in a single $O(N)$ pass from index `0` (newest) to `N - 1` (oldest):
  1. Initialize `runningBalanceByAccountId = new Map<string, { balance: number; currency: string; name: string }>()` from all non-deleted account-type categories in `categories` (using `account.currentAmount ?? account.amount ?? 0` and `account.currencyId ?? defaultCurrency`).
  2. Sort non-deleted loaded transactions newest-first (by `dateTimestamp ?? Date.parse(dateTimestampISO)` descending, preserving server order on ties).
  3. For each transaction `tx`:
     - If `tx.sourceId` is in `runningBalanceByAccountId`:
       - The balance of `sourceId` **immediately after** `tx` occurred is the current value in `runningBalanceByAccountId.get(tx.sourceId).balance`.
       - Record `sourceBalanceAfter` (and its currency/account name).
       - Step backwards to the balance **before** `tx`: `balance += Math.abs(tx.sourceAmount ?? tx.defaultAmount ?? 0)`.
     - If `tx.destinationId` is in `runningBalanceByAccountId`:
       - The balance of `destinationId` **immediately after** `tx` occurred is the current value in `runningBalanceByAccountId.get(tx.destinationId).balance`.
       - Record `destinationBalanceAfter` (and its currency/account name).
       - Step backwards to the balance **before** `tx`: `balance -= Math.abs(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount ?? 0)`.
  4. When filtering by a specific `selectedAccountId`:
     - Display the primary signed amount and running `balanceAfter` specifically for `selectedAccountId` in its native currency (`-sourceAmount` when `sourceId === selectedAccountId`, `+destinationAmount` when `destinationId === selectedAccountId`).
  5. When viewing all accounts (`selectedAccountId === null`):
     - For expenses (`Account -> Expense`), display `-sourceAmount` in `sourceCurrency` and `Bal: <sourceBalanceAfter>`.
     - For income (`Income -> Account`), display `+destinationAmount` in `destinationCurrency` and `Bal: <destinationBalanceAfter>`.
     - For transfers (`Account -> Account`), display the transfer amount(s) and running balance(s) (`sourceBalanceAfter -> destinationBalanceAfter`, or filtered account if selected).

### 5. Account Filtering & All-Time Pagination in `RecentTransactionsCard`

- **Decision**:
  - Extend `getTransactionPage` in `external-provider-client.ts` to accept `categoryIds?: string[]` and include `categoryIds` in both the POST body and the client cache key (`tx:${skip}:${take}:${from}:${to}:${categoryIdsKey}`).
  - On the **Accounts & Transactions** screen, `RecentTransactionsCard` fetches all-time history (`periodFilter` omitted, `take: 20`, `categoryIds: selectedAccountId ? [selectedAccountId] : undefined`).
  - Whenever `selectedAccountId` changes, `RecentTransactionsCard` resets `skip = 0` and loads the first page of 20 transactions for that filter, showing `Load more transactions` whenever `hasMoreData` is `true`.
  - Clicking an account row in `AccountsCard` (outside the drag handle and tooltips) toggles `selectedAccountId`.

## Risks / Trade-offs

- **[Risk] Drag-and-drop vs. click-to-select conflict on `AccountsCard` rows** -> **Mitigation**: Dragging is already bound exclusively to the `GripVertical` drag handle (`ref={handleRef}`). Clicking the row body toggles selection without interfering with drag-and-drop reordering.
- **[Risk] Deleted or missing category references in historical transactions** -> **Mitigation**: `resolveTransactionEndpoints` falls back to `tx.sourceName` / `tx.destinationName` if present, or `"Archived / Unknown"` if the category GUID was permanently deleted, and only renders running balance when the account ID exists in the active `categories` list.
