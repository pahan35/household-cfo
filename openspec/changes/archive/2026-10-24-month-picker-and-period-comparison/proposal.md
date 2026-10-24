# Proposal

## Why

The Budget Overview screen currently restricts top-level period navigation to a binary `Current Month / Previous Month` toggle (duplicated inside `BudgetSummaryCard`) and requires clicking chart points to inspect older months, while offering no direct way to compare spending, income, and category movers between two specific months. Replacing the binary toggle with a unified Month & Year Picker and an in-place "Compare vs" baseline selector lets users inspect any historical month directly and immediately see PLN and percentage deltas across KPIs and expense categories.

## What Changes

- **Unified Header Month & Year Picker**: Replace the `Current Month / Previous Month` segmented toggle in `BudgetOverviewDashboard` with an interactive Month & Year Picker featuring previous/next month steppers (`<` / `>`), a popover calendar grid of available years and months (`Jan`–`Dec`) bounded by loaded `/stat/ping` history, and 1-click shortcuts for `Current Month` and `Previous Month`.
- **Single Period Source of Truth**: Remove the redundant `Current Month / Previous Month` toggle from `BudgetSummaryCard`'s header so the entire Budget Overview screen follows the header picker (and bidirectional clicks from `YoYTrendsCard`).
- **In-Place "Compare vs" Baseline Selector (Approach A)**: Add a comparison baseline control in the `BudgetOverviewDashboard` header (`Off`, `Previous Month`, `Same Month Last Year`, or `Custom Month...` selected from available history).
- **KPI Strip Comparison Deltas**: Enhance `BudgetMetricsStrip` so that when a comparison baseline month is active, all four metric cards (`Gross Income`, `Net Disposable Income`, `Controllable Expenses`, and `Net Cash Margin`) render inline absolute (`+PLN` / `-PLN`) and percentage (`%`) variance badges with semantic favorable/unfavorable styling.
- **Category Breakdown & Budget Summary Comparison Deltas**: Enhance `ExpensePieCard` and `BudgetSummaryCard` to display per-category spending deltas (`+PLN` / `-PLN` and `%` vs. the baseline month) alongside current period spending, including a sort mode in `ExpensePieCard` to order categories by biggest increase or decrease.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Update period selection, net income and controllable expense metrics, expense composition pie chart, and budget spent-versus-limit summary requirements to specify the unified Month & Year Picker and in-place month-over-month comparison mode.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
- `src/app/(main)/dashboard/family-budget/_components/budget-metrics-strip.tsx`
- `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`
- `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`
- `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
- New month picker / comparison helper component(s) in `src/app/(main)/dashboard/family-budget/_components/`
- Zero new upstream API requests (reuses the cached 40+ month `/stat/ping` series in memory).
