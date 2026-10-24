# Tasks

## 1. Period Comparison Transform & Helpers

- [ ] 1.1 Add `computePeriodComparison` and comparison types (`CompareMode`, `MetricDelta`, `CategoryComparisonDelta`) in `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts` to calculate KPI deltas and per-category variance between an active period and a baseline period, and verify with unit tests in `spending-metrics.test.ts`
- [ ] 1.2 Add a helper in `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts` to extract the sorted list of available months (`{ year, monthIndex, dateStr, label }`) from `/stat/ping` points and resolve relative baseline months (`prev_month`, `prev_year`, `custom`), and verify with unit tests

## 2. Unified Month & Year Picker & Header Comparison Selector

- [ ] 2.1 Create `MonthPeriodPicker` in `src/app/(main)/dashboard/family-budget/_components/month-period-picker.tsx` with `<` / `>` month steppers, a year/month grid popover bounded by available history, `Current Month` / `Previous Month` quick pills, and the `Compare vs` selector (`Off`, `Previous Month`, `Same Month Last Year`, `Custom Month...`), verifying keyboard/a11y and TypeScript types
- [ ] 2.2 Integrate `MonthPeriodPicker` into `BudgetOverviewDashboard` (`src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`), unifying period state under a single `activeMonthDateStr` and removing the redundant `Current Month / Previous Month` toggle from `BudgetSummaryCard` (`src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`)

## 3. In-Place Comparison Deltas Across Overview Cards

- [ ] 3.1 Update `BudgetMetricsStrip` (`src/app/(main)/dashboard/family-budget/_components/budget-metrics-strip.tsx`) to accept optional comparison deltas and render inline `+PLN / -PLN` and `%` badges on all 4 KPI cards when comparison mode is active
- [ ] 3.2 Update `ExpensePieCard` (`src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`) and `BudgetSummaryCard` (`src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`) to display per-category comparison deltas (`+PLN / -PLN` and `%` vs. baseline month) and add category variance sorting (`By Spend`, `Biggest Increase`, `Biggest Decrease`) in `ExpensePieCard`

## 4. Verification & Quality Gates

- [ ] 4.1 Run `npx vitest run` to verify all unit tests for period comparison and month resolution pass
- [ ] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) to confirm formatting, linting, and strict TypeScript types pass with zero errors
