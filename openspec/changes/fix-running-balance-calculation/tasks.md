# Tasks

## 1. Core Data Helper & Running Balance Calculation

- [ ] 1.1 Export `getAccountBalance(category: ExternalProviderCategory | null | undefined): number` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` prioritizing `amount` over `currentAmount`, and update `computeTransactionsWithRunningBalance`, `filterAndClassifyAccounts`, and `computeAccountLiquiditySummary` to use it
- [ ] 1.2 Update `src/app/(main)/dashboard/family-budget/_components/account-liquidity-strip.tsx` (`selectedBalance`) and `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx` (selected account filter label) to use `getAccountBalance`

## 2. Unit Tests & Regression Prevention

- [ ] 2.1 Add test cases to `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` verifying `getAccountBalance` against categories with `currentAmount: 0.0`, undefined fields, and negative balances
- [ ] 2.2 Update `computeTransactionsWithRunningBalance` unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` to include upstream category payloads with `currentAmount: 0.0`, verifying that running balances anchor to the live account balance (`amount`) across all-time transaction steps
- [ ] 2.3 Run test suite (`npm test`) and project verification (`npm run verify`) to confirm all unit tests pass cleanly without type or linting errors
