# Design

## Context

See `proposal.md` for problem motivation and `specs/budget-overview/spec.md` for observable behavioral requirements.

Currently:
1. `budget-overview-dashboard.tsx` resolves `statCategories` with `points.find(...) ?? points[0]`.
2. `budget-summary-card.tsx` resolves `activePoint` in `computeBudgetSummaryItems` with `points.find(...) ?? points[0]`.
3. `income-dashboard.tsx` resolves `activePoint` with `points.find(...) ?? points[0]`.
4. There is no helper evaluating whether a month's transaction stream is incomplete or cutoff.

## Goals / Non-Goals

**Goals:**
- Eliminate stale prior-month category leaks into unrecorded months.
- Provide a clean, unified empty state card when an active month has neither statistics nor transactions.
- Implement an explicit detection helper for incomplete months and display a badge in "Expenses Breakdown" or adjacent to "Controllable Expenses".
- Maintain backward compatibility with existing multi-month YoY trends and historical date parsing.

**Non-Goals:**
- Synthesizing or projecting mock transaction data for empty future months.
- Changing upstream ExternalProvider `/stat/ping` payload format or server caching mechanisms.
- Modifying lifestyle, runway simulator, or offer comparator pages outside the budget overview and income scopes.

## Decisions

### Decision 1: Strict month normalization without fallback to `points[0]`
- **Rationale**: When querying a month absent from `/stat/ping` (like November 2026), falling back to `points[0]` causes October's spending and limits to be displayed under November's heading. Normalizing `fromDate` to `startOfMonth` and strictly returning `undefined` when no point matches ensures empty months correctly yield `statCategories = []`.
- **Alternatives considered**:
  - *Keep `points[0]` but check if month matches year/month*: Equivalent to strict resolution, but cleaner to remove the fallback entirely.
  - *Generate zeroed categories for all known categories*: Misleading because it shows 0 spent against arbitrary limits when no point was ever tracked.

### Decision 2: Unified empty state card for zero-data months
- **Rationale**: When both `statCategories` and `periodTransactions` are empty, rendering multiple empty cards (empty metrics strip with 0.00, empty donut chart, empty limits list) creates visual noise. A single unified `BudgetOverviewEmptyMonthCard` clearly communicates that no data exists for this period and provides a 1-click action to switch to the latest month with recorded activity (`availableMonths[0]` or the latest point).
- **Alternatives considered**:
  - *Keep separate empty states per card*: Creates fragmented UI and multiple identical "No data" notices.
  - *Redirect the URL immediately to the previous month*: Violates user expectations by overriding user navigation and URL state.

### Decision 3: Deterministic Incomplete Month Evaluation Helper
- **Rationale**: Create a pure, testable function `evaluateMonthCompleteness({ activeMonthDateStr, transactions, referenceDate })`:
  1. If `startOfMonth(activeMonthDateStr)` equals `startOfMonth(referenceDate ?? new Date())`: `isIncomplete: true`, `reason: "current_month"`.
  2. If all non-deleted transactions across the dataset stop before the start of `activeMonth + 1 month` (i.e. `hasTransactionsInFollowingMonth === false`): `isIncomplete: true`, `reason: "no_subsequent_transactions"`.
  3. Otherwise: `isIncomplete: false`.
- **Badge presentation**: Render a compact amber outline badge (`<Badge variant="outline">Incomplete month</Badge>`) in `ExpensePieCard` header and optionally inside `BudgetMetricsStrip` with a hover tooltip explaining the reason.

## Risks / Trade-offs

- **[Risk] Existing unit test expects fallback**: `spending-metrics.test.ts` line 518 tested `falls back to points[0] when exact fromDate match is absent` with a mid-month date `"2026-10-24"`.
  - **Mitigation**: Update the test to reflect normalized month matching (`startOfMonth`), verifying that `"2026-10-24"` matches `"2026-10-01"`, while `"2026-11-01"` correctly returns empty without falling back to October.
