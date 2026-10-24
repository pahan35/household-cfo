# Tasks

## 1. Core Domain & Clearing Logic (`external-provider-data.ts`)

- [x] 1.1 Implement `isThrowawayDebtAccount` and `formatThrowawayDebtAccountName` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` to identify `Debt:` / `_Debt:` accounts and normalize person/deal names without duplicate prefixes, and verify with unit tests
- [x] 1.2 Implement `toDotNetTicks` and `buildNewDebtAccountCategory` in `external-provider-data.ts` to create a `CategoryType.Account` entity named `Debt: <Person/Deal>`, insert it immediately preceding the first archived (`_` prefixed) account, and re-index sequential `order` values, and verify with unit tests
- [x] 1.3 Extend `archiveAccountCategory` in `external-provider-data.ts` with an optional `{ exceptFromBalance?: boolean }` parameter (backwards-compatible with `archive-and-reorder-accounts` tests) so settled debt accounts can set `exceptFromBalance: true` when archived, and verify with unit tests
- [x] 1.4 Implement double-entry clearing transaction builders (`buildPrincipalOutflowTransaction`, `buildFeeTransaction`, `buildSettlementTransaction`, and `buildFxReconciliationTransaction`) in `external-provider-data.ts` covering same-currency and cross-currency outflows, debtor- vs. user-absorbed fees, Case A/B/C settlements, and positive/negative FX remainder closeout, and verify with unit tests in `external-provider-data.test.ts`

## 2. Proxy Cache Invalidation & Client API (`route.ts` & `external-provider-client.ts`)

- [x] 2.1 Update `src/app/api/external-provider/[...path]/route.ts` to inject `userId` on `/api/transaction/*` POST requests, bypass caching for `/api/transaction/create` and `/api/transaction/update`, and invalidate cached `/api/transaction`, `/Exchange/Ping`, and `/stat/ping` proxy entries upon transaction writes, verifying with unit tests
- [x] 2.2 Add `createTransaction` in `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` to POST to `/api/external-provider/api/transaction/create` with `Cache-Control: no-cache` and invalidate client cache entries (`categories` and transaction pages), verifying TypeScript types compile cleanly

## 3. UI Components & Clearing Ledger Workbench

- [x] 3.1 Create `DebtAccountInitDialog` in `src/app/(main)/dashboard/family-budget/_components/debt-account-init-dialog.tsx` allowing users to enter a person/deal name, choose a base currency (`USD`, `EUR`, `PLN`, `UAH`, or any available currency), toggle `exceptFromBalance`, and initialize the account above archived accounts
- [x] 3.2 Update `AccountsCard` in `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx` to add a "New Debt" action button in the header, render a `Clearing` badge on `Debt:` / `_Debt:` account rows, and include "Open Clearing Ledger" in the row action dropdown menu
- [x] 3.3 Create `DebtClearingPanel` in `src/app/(main)/dashboard/family-budget/_components/debt-clearing-panel.tsx` with 4 workflow tabs (`Outflow`, `Fee`, `Settle`, `Reconcile & Archive`), automatic cross-currency pre-filling via `convertCurrencyAmount`, and 1-click FX closeout + `_` archiving
- [x] 3.4 Integrate `DebtAccountInitDialog` and `DebtClearingPanel` into `FamilyBudgetDashboard` (`src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`), wiring account creation, transaction creation, and closeout archiving with optimistic state updates and `sonner` toasts

## 4. Verification & Quality Gates

- [x] 4.1 Run `npx vitest run` to verify all unit tests for `archive-and-reorder-accounts` and `throwaway-debt-accounts` pass without regressions
- [x] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) to confirm formatting, linting, and strict TypeScript types pass with zero errors
