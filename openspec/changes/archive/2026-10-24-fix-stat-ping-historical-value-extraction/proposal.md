# Proposal

## Why

In the Year-over-Year Budget Trends chart and across historical period views on the Budget Overview screen, every month across 2023–2026 currently renders the exact same controllable expense bar (`PLN 8,451.47` and `0.0%` YoY change), and switching to Previous Month continues to display the current month's category spending. This happens because `/stat/ping` (`statisticType: 0`) populates `statCat.amount` with the static current-month balance of the `Category` entity across all 40+ historical points while storing each month's actual historical spending/income in `statCat.value`, whereas our transforms currently read `statCat.amount ?? statCat.currentAmount ?? statCat.value`.

## What Changes

- **Historical Value Priority in Transforms**: Update `transformExpenses` (`expense-transforms.ts`), `computeBudgetSummaryItems` (`budget-summary-card.tsx`), and `IncomeDashboard` (`income-dashboard.tsx`) to extract period spending/income using `statCat.value ?? statCat.amount ?? statCat.currentAmount`, matching ExternalProvider Web's `ck-stat.js` selector logic.
- **Normalized Period Point Lookup**: Update `BudgetOverviewDashboard` and `BudgetSummaryCard` to match the selected period's `fromDate` against `parsePointDate(point)?.dateStr === fromDate` (instead of raw `point.id === fromDate` string equality) so historical points are reliably resolved regardless of date formatting.
- **Accurate Period Income Resolution**: In `BudgetOverviewDashboard`, allow `transformExpenses` to use `/stat/ping`'s reporting-currency income category totals (`statCat.value` for `CategoryType.Income`) when available so historical months do not show partial or unconverted transaction sums.
- **Multi-Month Regression Unit Tests**: Update and expand `spending-metrics.test.ts` with multi-period `/stat/ping` fixtures where `statCat.amount` remains constant across points (modeling the upstream static category snapshot) while `statCat.value` varies per month, verifying that `transformExpenses`, `computeBudgetSummaryItems`, `transformYoYPoints`, and `transformChronologicalTrends` produce distinct monthly totals and non-zero YoY deltas.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Update requirements for budget spent-versus-limit summary and automated regression tests so category spending/income extraction prioritizes `value` over static `amount` across `/stat/ping` points and matches points via normalized month-start dates.
- `historical-budget-trends`: Clarify historical time-series extraction requirements so each historical period's metrics derive from period-specific `value` fields rather than static category `amount` snapshots.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`
- `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
- `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
- `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
- `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts`
- Zero new dependencies or upstream proxy changes.
