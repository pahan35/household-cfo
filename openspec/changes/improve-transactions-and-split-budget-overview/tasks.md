# Tasks

## 1. Data Layer & Client API Enhancements

- [ ] 1.1 Extend `external-provider-data.ts` with `ExternalProviderCurrency` types, `convertCurrencyAmount`, `computeAccountLiquiditySummary`, `resolveTransactionEndpoints`, and `computeTransactionsWithRunningBalance` (plus category-aware `buildLastTransactionMap`), and verify with unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`
- [ ] 1.2 Extend `external-provider-client.ts` to support `categoryIds?: string[]` in `getTransactionPage` (including cache key segmentation) and fetch `ExchangeKey.Currency` (`key: 4`) in `getCurrencies` / `/Exchange/Ping`, verifying with `npm run verify`

## 2. Accounts & Transactions Review Components

- [ ] 2.1 Create `account-liquidity-strip.tsx` to display Total Net Liquid Balance in default currency (using `ExchangeKey.Currency` rates and respecting `exceptFromBalance`), native currency breakdown, and active account filter / debt & reconciliation summary, verifying with `npm run verify`
- [ ] 2.2 Update `accounts-card.tsx` to accept `selectedAccountId` and `onSelectAccount`, visually highlight the selected account row, allow clicking an account row to toggle the filter without breaking drag-and-drop reordering, and use multi-currency conversion for the header total, verifying with `npm run verify`
- [ ] 2.3 Update `recent-transactions-card.tsx` to accept `categories`, `selectedAccountId`, and `onClearAccountFilter`, render explicit `Source -> Target` names, display transaction amounts and running account balances (`Bal: ...`) in the account's native currency after each transaction, and paginate all-time history (`take: 20`) via "Load more transactions", verifying with `npm run verify`

## 3. Screen Split & Navigation

- [ ] 3.1 Create `budget-overview-dashboard.tsx` and route `src/app/(main)/dashboard/family-budget/budget-overview/page.tsx` housing the period selector (`Current Month`, `Previous Month`, historical month focus), `BudgetMetricsStrip`, `ExpensePieCard`, `YoYTrendsCard`, and `BudgetSummaryCard`, verifying with `npm run verify`
- [ ] 3.2 Update `family-budget-dashboard.tsx`, `src/app/(main)/dashboard/family-budget/page.tsx`, and `src/navigation/sidebar/sidebar-items.ts` so `/dashboard/family-budget` focuses on "Accounts & Transactions" (with `AccountLiquidityStrip`, `AccountsCard`, and `RecentTransactionsCard` side-by-side and no header month selector) and the sidebar includes "Accounts & Transactions", "Budget Overview", and "FX & Inflation", verifying with `npx vitest run` and `npm run verify`
