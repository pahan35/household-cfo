# Design

## Context

See `proposal.md` for motivation. Currently on `/dashboard/family-budget/budget-overview`:
1. `BudgetOverviewDashboard` holds `periodMonth: "current" | "previous"` AND a separate `selectedHistoricalPeriod: SelectedPeriod | null` state, rendering a `[ Current Month | Previous Month | <Historical Badge> ]` toggle in the header.
2. `BudgetSummaryCard` renders its own `[ Current Month | Previous Month ]` toggle in its card header, which falls out of sync whenever `selectedHistoricalPeriod` is set.
3. All 40+ historical monthly points are already loaded in memory inside `statData.selection.points`, meaning switching to any historical month or comparing any two historical months can be performed synchronously in memory.

## Goals / Non-Goals

**Goals:**
- Consolidate period state in `BudgetOverviewDashboard` into a single normalized month identifier (`activeMonthDateStr: string`, e.g., `"2026-10-01"`).
- Replace the binary header toggle with a `MonthPeriodPicker` component (`[<] [ CalendarIcon Oct 2026 v ] [>]`) supporting 1-click `Current Month` / `Previous Month` presets and a year/month grid popover bounded by available `/stat/ping` points.
- Remove the duplicate period toggle from `BudgetSummaryCard`.
- Add an in-place `Compare vs` selector (`"none" | "prev_month" | "prev_year" | "custom"`) in the header next to `MonthPeriodPicker`.
- Display inline PLN and `%` deltas in `BudgetMetricsStrip`, `ExpensePieCard`, and `BudgetSummaryCard` when comparison mode is active.

**Non-Goals:**
- Adding a separate standalone comparison screen or modal (we use Approach A: in-place comparison across existing cards).
- Issuing additional `/stat/ping` requests when changing comparison months.

## Decisions

### 1. Unified Period State (`activeMonthDateStr`) & Available Months Index
- **Decision**: Derive an ordered list of available months from `statData.selection.points` via `parsePointDate(p)` (always including at least the current and previous calendar months even while loading). Store the active period as a single `activeMonthDateStr` (`"yyyy-MM-01"`, defaulting to the current month start).
- **Rationale**: Eliminates the split-brain state between `periodMonth: "current" | "previous"` and `selectedHistoricalPeriod: SelectedPeriod | null`, making `<` / `>` stepping, popover selection, and chart-click selection uniform.

### 2. In-Place Comparison Baseline Resolution (`CompareMode`)
- **Decision**: Support four comparison modes in the header control:
  - `none` (default: no comparison deltas shown)
  - `prev_month` (automatically resolves to 1 month before `activeMonthDateStr`, e.g. `Sep 2026` when viewing `Oct 2026`)
  - `prev_year` (automatically resolves to 12 months before `activeMonthDateStr`, e.g. `Oct 2025` when viewing `Oct 2026`)
  - `custom` (user picks any specific baseline month `compareCustomDateStr` from the year/month grid)
- **Rationale**: Automatic relative modes (`Previous Month` and `Same Month Last Year`) stay valid even as the user steps `<` / `>` through different active months, while `Custom Month` supports arbitrary month-to-month comparisons (e.g., comparing two vacation months or high-spend months).

### 3. Pure Comparison Transform Helper (`computePeriodComparison`)
- **Decision**: Add a pure transform helper in `expense-transforms.ts` that takes `currentTransformed: TransformedExpenseData` and `baselineTransformed: TransformedExpenseData | null` and computes:
  - KPI-level deltas (`deltaAbs`, `deltaPercent`) for `grossIncome`, `netDisposableIncome`, `totalControllableExpense`, and `netCashFlowMargin`.
  - Per-category delta map (`categoryId -> { baselineAmount, deltaAbs, deltaPercent }`), covering categories present in either the active month or the baseline month.
- **Rationale**: Keeps UI components declarative and makes the comparison math straightforward to unit-test in `spending-metrics.test.ts`.

### 4. Category Breakdown Variance Sorting in `ExpensePieCard`
- **Decision**: When a comparison baseline is active, `ExpensePieCard`'s "Top Categories" list header shows a compact sort pill (`By Spend | Biggest Increase | Biggest Decrease`) and renders each category's baseline delta (`+PLN 420 (+18%)` or `-PLN 150 (-12%)`) next to its current amount.
- **Rationale**: Directly answers "why did my controllable expenses go up or down this month compared to Month B?" without leaving the overview card.

## Risks / Trade-offs

- **[Risk] Baseline month has no data in `/stat/ping` (e.g. comparing earliest 2023 month against 2022)** -> **Mitigation**: If the resolved baseline month is not present in `statData.selection.points`, display a subtle `"No data for <Month Year>"` badge in the comparison control and omit misleading `0` deltas.
- **[Risk] Division by zero when a category had `PLN 0` spend in the baseline month** -> **Mitigation**: When `baselineAmount === 0` and `currentAmount > 0`, `deltaPercent` is `null` and the UI renders `"New (+PLN X)"` instead of `Infinity%` or `0%`.
