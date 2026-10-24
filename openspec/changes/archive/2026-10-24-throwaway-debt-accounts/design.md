# Design

## Context

See `proposal.md` for motivation and `specs/throwaway-debt-accounts/spec.md` for requirements.

ExternalProvider's web backend represents accounts, income sources, and expense categories as `ExternalProviderCategory` entities synchronized via `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2`), and double-entry transactions via `POST /api/external-provider/api/transaction/create` (which is already covered by `PATH_ALLOWLIST` in `src/server/external-provider/config.ts` under `/api/transaction`).

In parallel, the `archive-and-reorder-accounts` change introduces pure account ordering and archiving functions in `external-provider-data.ts`:
- `archiveAccountCategory(allCategories, accountId)`
- `unarchiveAccountCategory(allCategories, accountId)`
- `findAccountsBelowArchived(allCategories)`
- `moveAccountsAboveArchived(allCategories, accountIds)`

This design builds directly on those primitives so that Throwaway Clearing Accounts (`Debt: <Person/Deal>`) integrate seamlessly with the `_` prefix archiving and account ordering conventions.

## Goals / Non-Goals

**Goals:**
- Provide pure, deterministic domain functions in `external-provider-data.ts` to identify `Debt:` accounts, construct new throwaway account categories positioned immediately above archived accounts, build ExternalProvider double-entry transaction payloads (`.NET` ticks, ISO dates, GUID v4 IDs, cross-currency `sourceAmount`/`destinationAmount`), and compute FX closeout adjustments.
- Integrate a "New Debt Account" initialization dialog (`DebtAccountInitDialog`) and a `Debt` badge in `AccountsCard`.
- Build an interactive **Clearing Ledger Panel** (`DebtClearingPanel`) rendered in `FamilyBudgetDashboard` when a throwaway debt account is selected, supporting all four accounting phases:
  1. Principal Purchase (Outflow on Behalf)
  2. Associated Fees (Debtor-absorbed transfer vs. User-absorbed expense)
  3. Third-Party Settlements (Case A: Shared Expense, Case B: Direct Service Payment, Case C: Family/Account Transfer)
  4. FX Remainder Reconciliation (`balance > 0` loss or `balance < 0` gain) + 1-click Archive (`_Debt: <Person/Deal>`)
- Invalidate server proxy and client caches automatically upon `/api/transaction/create` or `/api/transaction/update` writes.

**Non-Goals:**
- Deleting accounts or transactions (ExternalProvider accounts must never be deleted once settled).
- Building a separate top-level sidebar route (the workflow lives directly inside `/dashboard/family-budget`).
- Introducing any external state management library or storing credentials outside the server proxy.

## Decisions

### Decision 1: Naming Convention & Account Identification
We identify Throwaway Clearing Accounts via a pure predicate `isThrowawayDebtAccount(category)`:
- Checks `isAccountType(category.categoryType)` and `!category.deleted`.
- Strips any leading `_` prefix (`name.trim().replace(/^_+/, "").trim()`) and checks if the normalized name starts with `Debt:` (case-insensitive, e.g., `/^debt:\s*/i`).
- `formatThrowawayDebtAccountName(rawName)` normalizes user input (e.g., `"Alex"`, `"Debt: Alex"`, `"_Debt: Alex"`) to `"Debt: Alex"`.

*Rationale:* Using the `Debt: <Name>` naming convention on standard `CategoryType.Account` (`2`) categories requires zero external database state, persists natively across ExternalProvider Web and Mobile apps, and composes cleanly with `_` archiving (`_Debt: <Name>`).

### Decision 2: Account Initialization & Ordering Integration with `archive-and-reorder-accounts`
When creating a new Throwaway Clearing Account (`buildNewDebtAccountCategory(allCategories, input)`):
- Generates a client-side UUID (`crypto.randomUUID()`), sets `categoryType: CategoryType.Account` (`2`), `name: formatThrowawayDebtAccountName(input.name)`, `currencyId: input.currencyId`, `amount: 0`, `limitAmount: 0`, `periodizedLimitAmount: 0`, `deleted: false`, `deletedWithTransactions: false`, `goalClosed: false`, `icon: "Miscellaneous"`, `parentUid: null`, `exceptFromBalance: Boolean(input.exceptFromBalance)`, `createdTimestamp: toDotNetTicks(new Date())`.
- Places the new account in the sorted accounts group immediately before the first archived (`_` prefixed) account (using the same insertion slot logic as `unarchiveAccountCategory` and `moveAccountsAboveArchived` from `archive-and-reorder-accounts`), re-indexing sequential integer `order` values (`0, 1, 2, ...`).
- Persists all modified/created categories in a single `updateCategoriesOrder` call (`POST /api/external-provider/Exchange/Ping` with `ExchangeKey.Category`).
- Extends `archiveAccountCategory(allCategories, accountId, options?: { exceptFromBalance?: boolean })` so archiving a settled debt account can also set `exceptFromBalance: true` while prefixing `_` and moving it to the end of the account list.

*Rationale:* ExternalProvider normally appends new accounts at the bottom of the account list (below archived accounts). Inserting immediately above the first archived account at creation time prevents newly initialized debt accounts from triggering the "positioned below archived accounts" warning banner.

### Decision 3: Double-Entry Transaction Construction & `.NET` Ticks Conversion
ExternalProvider transactions require both `.NET` ticks (`dateTimestamp`) and ISO strings (`dateTimestampISO`), plus explicit source and destination fields. We will add a pure builder `buildClearingTransaction(params)` in `external-provider-data.ts`:
- **`.NET` Ticks Formula**: `ticks = Math.round(date.getTime() * 10000) + 621355968000000000` (matching `docs/externalProvider/NOTES.md`).
- **Four High-Level Recipe Builders**:
  1. `buildPrincipalOutflowTransaction`: `source = myAccount`, `destination = debtAccount`, `sourceAmount = paidAmount`, `destinationAmount = debtCurrencyAmount`.
  2. `buildFeeTransaction`:
     - If `absorbedBy === "debtor"`: Transfer `source = myAccount`, `destination = debtAccount`, `sourceAmount = feeAmount`, `destinationAmount = debtCurrencyAmount`.
     - If `absorbedBy === "me"`: Expense `source = myAccount`, `destination = feeExpenseCategory`, `sourceAmount = feeAmount`, `destinationAmount = feeCategoryAmount`.
  3. `buildSettlementTransaction`:
     - *Case A (Shared Expense)* & *Case B (Direct Service Payment)*: Expense `source = debtAccount`, `destination = expenseCategory`, `sourceAmount = deductedDebtAmount`, `destinationAmount = expenseCategoryAmount`.
     - *Case C (Family / Account Transfer)*: Transfer `source = debtAccount`, `destination = targetAccount` (or Expense to `targetExpenseCategory` if external), `sourceAmount = deductedDebtAmount`, `destinationAmount = receivedTargetAmount`.
  4. `buildFxReconciliationTransaction`:
     - If `balance > 0` (FX loss / forgiven remainder): Expense `source = debtAccount`, `destination = fxLossExpenseCategory`, `sourceAmount = balance`, `destinationAmount = convertedOrSameAmount`.
     - If `balance < 0` (FX gain): Income `source = fxGainIncomeCategory`, `destination = debtAccount`, `sourceAmount = Math.abs(balance)`, `destinationAmount = Math.abs(balance)`.

*Rationale:* Encapsulating the accounting recipes as pure functions in `external-provider-data.ts` ensures 100% unit-testable accounting math (sign conventions, currency conversions, `.NET` ticks, and FX remainder direction) before touching the network or UI.

### Decision 4: Upstream Transaction Creation & Proxy Cache Invalidation
- In `src/app/api/external-provider/[...path]/route.ts`:
  - Treat `upstreamPath === "/api/transaction/create"` and `upstreamPath === "/api/transaction/update"` as non-cacheable write requests (`isTransactionWritePayload = true`).
  - Inject `userId` via `injectUserId` for `/api/transaction/*` POST bodies when web credentials are active.
  - On transaction write, invalidate proxy cache prefixes `/api/transaction`, `/Exchange/Ping`, and `/stat/ping` so subsequent reads fetch updated category balances and transaction feeds.
- In `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`:
  - Add `createTransaction(tx: ExternalProviderTransaction, options?: { signal?: AbortSignal })` which POSTs to `/api/external-provider/api/transaction/create` with `Cache-Control: no-cache`, and invalidates client cache entries (`categories`, `tx:*`, `stat:*`).

### Decision 5: UI Composition in `/dashboard/family-budget`
- **`AccountsCard` Enhancements**:
  - Add a compact `"New Debt"` (`Plus` icon) button in the card header action bar next to the `"Show archived"` toggle.
  - Render a distinct `"Clearing"` / `"Debt"` badge on rows where `isThrowawayDebtAccount(account)` is true, and add `"Open Clearing Ledger"` to the row's `DropdownMenu`.
- **`DebtClearingPanel` Component**:
  - Rendered in `FamilyBudgetDashboard` above `RecentTransactionsCard` in the right-hand column (`xl:col-span-7`) whenever `selectedAccount` is a Throwaway Clearing Account (`isThrowawayDebtAccount(selectedAccount)`).
  - Features a compact status header (Account name, native currency, current receivable balance, status badge: `Active Receivable`, `Ready to Archive (0.00)`, or `Archived`), and a 4-tab interactive form (`Outflow`, `Fee`, `Settle`, `Reconcile & Archive`) with live currency conversion pre-fills using `convertCurrencyAmount`.

## Risks / Trade-offs

- **[Risk] Upstream `/api/transaction/create` vs `/Exchange/Ping` balance sync timing**  
  $\rightarrow$ *Mitigation*: After `createTransaction` succeeds, invalidate both proxy and client caches and trigger `loadBaseData(undefined, true)` + `setRefreshKey` in `FamilyBudgetDashboard` so ExternalProvider's updated category `amount` and transaction list are immediately refetched. Also update local category `amount` optimistically so the UI responds immediately.
- **[Risk] Cross-currency rounding discrepancies**  
  $\rightarrow$ *Mitigation*: Pre-fill converted amounts using `convertCurrencyAmount` rounded to 2 decimal places (`Math.round(val * 100) / 100`), while always allowing the user to type the exact bank/deal settlement numbers in both `sourceAmount` and `destinationAmount` inputs.
- **[Risk] Conflict with in-progress `archive-and-reorder-accounts` tasks**  
  $\rightarrow$ *Mitigation*: Reuse `archiveAccountCategory`, `unarchiveAccountCategory`, `findAccountsBelowArchived`, and `moveAccountsAboveArchived` in `external-provider-data.ts` without breaking their signatures or existing unit tests.
