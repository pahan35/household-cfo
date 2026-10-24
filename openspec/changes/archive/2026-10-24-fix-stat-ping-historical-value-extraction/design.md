# Design

## Context

See `proposal.md` for motivation. ExternalProvider's `/stat/ping` (`statisticType: 0`, `RevenuesAndExpenses`) returns up to 46 monthly `points`, each containing a `categories` array of serialized C# category DTOs. In ExternalProvider's server model:
- `statCat.value` holds the calculated spending or income for **that specific historical period** (`point.id`).
- `statCat.amount` holds the **current balance/spend on the `Category` entity itself**, which is identical across every point in `points[]`.
- `statCat.currentAmount` is `0.0`.

In ExternalProvider's own web client (`upstream client`), `RevenuesAndExpenses`, `Expenses`, `Revenues`, and `AccumulatedCapital` read `statCat.value` exclusively. Our transforms (`expense-transforms.ts`, `budget-summary-card.tsx`, and `income-dashboard.tsx`) currently evaluate `statCat.amount ?? statCat.currentAmount ?? statCat.value`, causing `statCat.amount` to short-circuit on every historical month and render identical bars across all years.

## Goals / Non-Goals

**Goals:**
- Prioritize `statCat.value` before `statCat.amount` and `statCat.currentAmount` across all `/stat/ping` category transforms.
- Normalize active-point resolution in `BudgetOverviewDashboard` and `BudgetSummaryCard` using `parsePointDate(p)?.dateStr === fromDate`.
- Ensure historical months on `BudgetOverviewDashboard` resolve gross income accurately from `/stat/ping` category values when transaction pages are incomplete or unconverted.
- Fix `IncomeDashboard` controllable expense calculation to use the latest point (`points[0]` or sorted latest) and `cat.value ?? cat.amount` for expense categories only.
- Add multi-month regression tests where `statCat.amount` is constant across points while `statCat.value` varies.

**Non-Goals:**
- Changing the period picker UI or adding month-over-month comparison controls (scoped to `month-picker-and-period-comparison`).
- Altering upstream `/stat/ping` query parameters or proxy caching.

## Decisions

### 1. Spending & Income Field Extraction Order (`value ?? amount ?? currentAmount`)
- **Decision**: Extract `rawSpend` in `transformExpenses` (`expense-transforms.ts`) and `computeBudgetSummaryItems` (`budget-summary-card.tsx`) as:
  ```ts
  const rawSpend = statCat.value ?? statCat.amount ?? statCat.currentAmount;
  const amount = Math.max(0, Number(rawSpend) || 0);
  ```
- **Rationale**: In `/stat/ping` responses (`statisticType: 0`), `value` is always a number representing that point's monthly aggregate in the reporting currency. Falling back to `amount ?? currentAmount` preserves compatibility with synthetic unit test fixtures that omit `value`.
- **Alternatives considered**: Reading `statCat.value` only—rejected because some existing unit test cases construct minimal `StatCategoryPoint` objects with only `amount` or `currentAmount`.

### 2. Normalized Point Lookup & Historical Gross Income Resolution
- **Decision**:
  1. Match points via `points.find((p) => p.id === fromDate || parsePointDate(p)?.dateStr === fromDate) ?? points[0]`.
  2. In `transformExpenses`, `computedIncome` is already summed from `CategoryType.Income` entries in `statCategories` (which `/stat/ping` converts to the reporting currency). In `BudgetOverviewDashboard`, use `computedIncome` from `/stat/ping` when positive (or fall back to `grossIncome` from `periodTransactions` when `/stat/ping` has no income categories), avoiding false low income totals when a historical month has >100 transactions or foreign-currency income transactions.
- **Rationale**: Prevents mismatch between `/stat/ping` expenses (reporting currency, full month) and partial/unconverted transaction page sums.

## Risks / Trade-offs

- **[Risk] Existing unit tests in `spending-metrics.test.ts` that test fallback order** -> **Mitigation**: Update `spending-metrics.test.ts` to explicitly set different numbers for `amount` (e.g. current month `8451.47`) vs `value` (e.g. historical month `2000`) on historical points so any future regression to `amount`-first immediately fails the test suite.
