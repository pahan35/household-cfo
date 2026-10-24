# Tasks

## 1. Budget Spent vs Limit Spend Isolation

- [x] 1.1 Update `computeBudgetSummaryItems` in `budget-summary-card.tsx` to accept category types and filter strictly by `CategoryType.Expense` (excluding `CategoryType.Income` and account types), verifying with updated unit tests.
- [x] 1.2 Update `BudgetSummaryCard` component call sites to supply category types and verify that income sources no longer render in the spent-versus-limit card.

## 2. Tax & Contra-Rebate Data Transforms

- [x] 2.1 Update `tax-transforms.ts` to identify `"Cashback taxes"` PFRON inflows, exclude them from `grossIncome`, and apply them as a direct contra-rebate against ZUS (`netZus = Math.max(0, grossZus - cashback)`).
- [x] 2.2 Update `aggregateTaxesByTag` in `tax-transforms.ts` to segregate VAT-7 (`#vat`) as neutral business pass-through, excluding it from personal tax sums and effective personal tax rate.
- [x] 2.3 Implement USD FX trade spread and VAT currency drag calculations in `tax-transforms.ts` using realized transfer rates versus NBP mid-market rates from `macro-data.ts`.
- [x] 2.4 Add unit tests in `tax-transforms.test.ts` verifying PFRON netting, VAT-7 pass-through segregation, and FX friction metrics.

## 3. Income & Taxes UI Components

- [x] 3.1 Update `IncomeSourcesCard` to badge `"Cashback taxes"` as "Tax Rebate / ZUS Offset" and display income budget targets (`limitAmount`) with target percentage progress.
- [x] 3.2 Refactor `TaxBreakdownCard` into an "Income Streams & Tax Flow" card displaying gross earnings, FX drag, net ZUS (with PFRON rebate subline), PIT, and net disposable cash, with VAT-7 in an isolated pass-through badge.
- [x] 3.3 Update `IncomeMetricsStrip` cards to display True Gross Inflow, FX Drag, Net ZUS, PIT, and Net Disposable Income.
- [x] 3.4 Fix `IncomeDashboard` transaction ledger to remove the 50-transaction arbitrary fallback and display a dedicated empty state when no income or tax transactions match.

## 4. Verification & Validation

- [x] 4.1 Run unit tests (`npm run test` or Jest/Node test runner) to verify budget extraction and tax transform tests pass.
- [x] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify zero linting, formatting, or strict TypeScript errors.
