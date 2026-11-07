# Tasks

## 1. Core Logic & Resolution Fixes

- [x] 1.1 Remove `?? points[0]` fallback and implement strict month-start matching in `budget-overview-dashboard.tsx` and `computeBudgetSummaryItems` in `budget-summary-card.tsx`, verifying that months with no point resolve to `undefined` and empty category arrays.
- [x] 1.2 Remove `?? points[0]` fallback in `income-dashboard.tsx`, ensuring month queries without points resolve cleanly to 0 spend without prior-month leakage.
- [x] 1.3 Implement `evaluateMonthCompleteness` helper with tests covering current-month and missing-subsequent-month conditions.

## 2. UI Components

- [x] 2.1 Create `BudgetOverviewEmptyMonthCard` component displaying a unified empty state with guidance and a quick action button to switch to the latest month with activity.
- [x] 2.2 Add the "Incomplete month" indicator badge with hover tooltip to `ExpensePieCard` header and `BudgetMetricsStrip`.
- [x] 2.3 Wire the unified empty state into `budget-overview-dashboard.tsx` when both `statCategories` and `periodTransactions` are empty.

## 3. Verification & Regression Testing

- [x] 3.1 Update and expand unit tests in `spending-metrics.test.ts` to verify normalized month matching, zero-data empty returns, and incomplete month detection.
- [x] 3.2 Run static verification (`npm run verify`) and unit tests (`npm test`) to confirm zero regressions.
