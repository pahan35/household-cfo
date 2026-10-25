# Tasks

## 1. Currency & Endpoint Resolution Engine

- [x] 1.1 Implement `resolveTransactionSpend` in `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-helpers.ts` (or `external-provider-data.ts`) to resolve source/destination category `currencyId`, extract native amount, and convert to reporting currency via `convertCurrencyAmount`. Verify with unit tests in `category-expense-trace.test.ts`.
- [x] 1.2 Update `getLastTransactionSummaryForCategory` and `buildLastTransactionMap` in `external-provider-data.ts` to inspect counterpart category currency from `categoryById` and populate both `amount` / `currency` (native) and `normalizedAmount` (in `defaultCurrency`). Verify with unit tests in `external-provider-data.test.ts`.

## 2. Inspect Transactions Sheet Multi-Currency Normalization

- [x] 2.1 Update `CategoryExpenseTraceSheetProps` in `category-expense-trace-sheet.tsx` to accept `currencies: ExternalProviderCurrency[]`, and update `budget-overview-dashboard.tsx` to pass `currencies`. Verify props compile cleanly with `npm run verify`.
- [x] 2.2 Update `computeAccountBreakdown` and `computePeriodSpendSummary` in `category-expense-trace-helpers.ts` to aggregate normalized amounts for valid math while recording native currency subtotals per account. Verify with unit tests in `category-expense-trace.test.ts`.
- [x] 2.3 Update transaction row presentation in `category-expense-trace-sheet.tsx` according to Option A: primary converted amount (`-48,78 zł`) and secondary native amount (`500,00 ₴`) with conversion rate tooltip. Verify visually or via component unit tests.
- [x] 2.4 Update account chips in `category-expense-trace-sheet.tsx` to display converted spend totals with native subtotals on hover. Verify with unit tests.

## 3. Last Transaction Badge & Popover Normalization

- [x] 3.1 Update `LastTransactionBadge` in `last-transaction-badge.tsx` to display the normalized amount in reporting currency as primary, and present original native currency and amount (`500,00 ₴`) in the badge popover header. Verify with unit tests in `external-provider-data.test.ts`.
- [x] 3.2 Update `budget-overview-dashboard.tsx` to pass `currencies` and `defaultCurrency` into `buildLastTransactionMap`. Verify with `npm run verify`.

## 4. Budget Spent vs Limit Multi-Currency Display

- [x] 4.1 Update `BudgetSummaryCardProps` in `budget-summary-card.tsx` to accept `currencies: ExternalProviderCurrency[]` and `periodTransactions: ExternalProviderTransaction[]`, and pass them from `budget-overview-dashboard.tsx`. Verify types compile with `npm run verify`.
- [x] 4.2 Support standalone foreign categories in `budget-summary-card.tsx`: if limit is defined in a foreign currency (e.g. UAH), render native limit and spend (`4 500 ₴ / 5 000 ₴`) with converted reporting equivalent on hover tooltip. Verify with tests in `spending-metrics.test.ts`.
- [x] 4.3 Support Smart Category Groups in `budget-summary-card.tsx`: render group row normalized in primary reporting currency (`PLN`), and render child breakdown rows in their respective native currencies. Verify with unit tests in `spending-metrics.test.ts`.

## 5. End-to-End Verification & Quality Gates

- [x] 5.1 Run full TypeScript verification and linter checks (`npm run verify`) and ensure all test suites pass without regression (`npm run test:fast` or vitest).
