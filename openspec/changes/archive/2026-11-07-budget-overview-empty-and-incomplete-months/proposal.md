# Proposal

## Why

When viewing the Budget Overview dashboard for months with no recorded transactions or budget statistics (e.g. `month=2026-11-01`), an unintended fallback (`?? points[0]`) causes categories and spending numbers from October 2026 to be rendered in November, while period transactions correctly show empty. Furthermore, for months with partial data (such as the current calendar month in progress, or past cutoff months like October 2026 where transactions ceased before the end of the month and no transactions exist in the subsequent month), the UI lacks visual indication that the month's records are incomplete.

Eliminating the stale-month fallback, presenting a unified empty state for months with no data, and badging incomplete months ensures household financial data is presented accurately without misleading category leakages.

## What Changes

- **Stale Month Fallback Removal**: Remove `?? points[0]` fallbacks in `BudgetOverviewDashboard`, `computeBudgetSummaryItems`, and `income-dashboard`, resolving target months strictly by month start and returning empty category slices when no point exists.
- **Unified Empty State for Zero-Data Months**: When a selected month contains neither budget statistic points nor transactions, display a unified empty state card in place of the metrics strip, expense pie card, and budget summary table, offering an immediate action to navigate back to the latest month with recorded activity.
- **Incomplete Month Detection**: Mark a month as incomplete if:
  1. It is the current calendar month (`isCurrentMonth(activeMonth)`), or
  2. There are no recorded transactions in any subsequent calendar month (`hasTransactionsInFollowingMonth === false`).
- **Incomplete Month UI Indicator**: Surface an amber "Incomplete month" badge with explanatory tooltip either directly in the "Expenses Breakdown" section header or adjacent to "Controllable Expenses" in the metrics strip.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Update requirements to specify unified empty states for zero-data months, strict month point resolution without stale fallbacks, and visual indicator badging for incomplete months.

## Impact

- Affected frontend components:
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/budget-metrics-strip.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
- Affected tests:
  - `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts`
  - Unit tests verifying empty state rendering and incomplete month evaluation.
