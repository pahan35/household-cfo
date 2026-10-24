# Tasks: Income & Tax Management

## 1. Data Transforms & Utilities

- [x] 1.1 Implement `filterAndClassifyIncomeSources` and soft-archive helpers (`archiveIncomeCategory`, `unarchiveIncomeCategory`) in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`, and verify with unit tests in `external-provider-data.test.ts`.
- [x] 1.2 Extend `reorderCategoriesSubset` in `external-provider-data.ts` to recognize `CategoryType.Income` group ordering, and verify reordering behavior via unit tests.
- [x] 1.3 Implement tax aggregation utilities (`aggregateTaxesByTag`, `detectUntaggedTaxTransactions`, `computeIncomeTaxMetrics`) in a dedicated transform file `tax-transforms.ts`, and verify tag grouping and missing tag detection via unit tests.

## 2. API & Client Integration

- [x] 2.1 Implement `updateTransactionTags` (or generalized `updateTransaction`) in `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` targeting `/api/external-provider/api/transaction/update`, and verify proxy forwarding and cache invalidation.
- [x] 2.2 Wire income category reordering and archiving through `updateCategoriesOrder` in `external-provider-client.ts`, verifying that category cache is properly updated.

## 3. UI Components

- [x] 3.1 Create `IncomeMetricsStrip` in `src/app/(main)/dashboard/family-budget/_components/income-metrics-strip.tsx` displaying Gross Income, Taxes Deducted, Effective Tax Rate %, Net Disposable Income, and Expense Coverage Ratio.
- [x] 3.2 Create `IncomeSourcesCard` in `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx` with drag-and-drop reordering, soft-archiving with `_`, archived toggle, last payout summary badges, and row selection for transaction filtering.
- [x] 3.3 Create `TaxBreakdownCard` in `src/app/(main)/dashboard/family-budget/_components/tax-breakdown-card.tsx` rendering tag-based subtotals, effective tax rate, and the gross-to-net tax waterfall.
- [x] 3.4 Create `TaxAuditCard` in `src/app/(main)/dashboard/family-budget/_components/tax-audit-card.tsx` listing untagged tax transactions with an inline tag selector and save button for immediate remediation.

## 4. Page Assembly & Navigation

- [x] 4.1 Create the Income & Taxes screen at `src/app/(main)/dashboard/family-budget/income/page.tsx` composing the metrics strip, income sources card, tax breakdown & audit cards, and the embedded filtered transaction ledger.
- [x] 4.2 Register the "Income & Taxes" screen in `src/navigation/sidebar/sidebar-items.ts` under the "Family Budget" group with a `Banknote` icon and route `/dashboard/family-budget/income`.

## 5. Verification & Review

- [x] 5.1 Run `npm run verify` (`biome check && tsc --noEmit`) to verify strict typing, linting, and formatting compliance across all new and touched files.
- [x] 5.2 Run unit tests for data transforms and tax tag aggregations to ensure full test coverage and no regressions.
