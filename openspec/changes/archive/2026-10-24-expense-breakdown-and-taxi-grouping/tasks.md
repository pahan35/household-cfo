# Tasks

## 1. Tax Regex and Classification Bug Fix

- [x] 1.1 Update `TAX_CATEGORY_REGEX` in `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts` and `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` to use word boundaries (`/(?:\btax(?:es)?\b|podat|налог)/i`), and verify unit tests in `tax-transforms.test.ts` pass without matching `"Taxi PLN"`.
- [x] 1.2 Check `lifestyle-transforms.ts` `FIXED_EXPENSE_CATEGORY_REGEX` to ensure `tax` has word boundaries and does not match `taxi`.

## 2. Invariant Net Cash Margin & Controllable Budget Capacity

- [x] 2.1 Update `transformExpenses` in `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts` so `netCashFlowMargin = netDisposableIncome - (totalControllableExpense + excludedExpenseSum)` and export `availableControllablePool` and `controllableCashLeft`.
- [x] 2.2 Update unit tests in `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts` to assert `netCashFlowMargin` invariance under presets with exclusions.

## 3. UI Updates: KPI Strip & Expenses Breakdown Card

- [x] 3.1 Update `src/app/(main)/dashboard/family-budget/_components/budget-metrics-strip.tsx` Controllable Expenses card to display available pool and cash left (`Pool: X PLN • Left: Y PLN`).
- [x] 3.2 Rename `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx` to "Expenses Breakdown", update donut center label to "Expenses" or "Included", and add the "Cash Left" badge in the summary strip.

## 4. Smart Grouping for Transport & Taxi

- [x] 4.1 Implement `groupSmartSlices` and transport group helpers in `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts` linking `Transport` and `Taxi` into a unified slice on the donut chart when minor (< 3%).
- [x] 4.2 Update `ExpensePieCard` breakdown legend/list in `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx` to render the Transport group with distinct sub-items for transit and taxi (Uber/Bolt).
- [x] 4.3 Add unit tests in `spending-metrics.test.ts` covering Transport + Taxi smart grouping and small-slice threshold behavior.

## 5. Verification & Quality Gates

- [x] 5.1 Run `npm run verify` (`biome check && tsc --noEmit`) and ensure all TypeScript types and lint checks pass cleanly.
- [x] 5.2 Run automated unit test suite with `npx vitest run src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts` and `src/app/(main)/dashboard/family-budget/_components/__tests__/tax-transforms.test.ts` to verify full test suite passes.
