# Tasks

## 1. Spending & Income Transform Value Priority

- [ ] 1.1 Update `transformExpenses` in `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts` to extract category spending and income from `statCat.value ?? statCat.amount ?? statCat.currentAmount` and prefer `/stat/ping` reporting-currency `computedIncome` when non-zero, verifying with unit tests
- [ ] 1.2 Update `computeBudgetSummaryItems` in `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx` to extract per-category spent amounts from `cat.value ?? cat.amount ?? cat.currentAmount` and resolve the active point via normalized `parsePointDate(p)?.dateStr === fromDate`, verifying with unit tests
- [ ] 1.3 Update `BudgetOverviewDashboard` (`src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`) and `IncomeDashboard` (`src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`) to resolve active `/stat/ping` points using normalized month-start dates and `cat.value ?? cat.amount`, verifying TypeScript compilation

## 2. Multi-Month Regression Tests & Verification

- [ ] 2.1 Update `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts` with multi-period `/stat/ping` fixtures where `statCat.amount` holds a constant current-month snapshot while `statCat.value` varies per historical month, and verify `npx vitest run` passes
- [ ] 2.2 Run `npm run verify` (`biome check && tsc --noEmit`) and confirm zero lint, formatting, or TypeScript errors
