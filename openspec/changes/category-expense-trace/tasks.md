# Tasks

## 1. Trace Sheet Component & Data Integration

- [x] 1.1 Create `CategoryExpenseTraceSheet` component in `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-sheet.tsx` with shadcn `Sheet`, loading transactions for the specified category and date period via `getTransactionPage`. Verify it renders a clean loading skeleton, empty state, and reverse-chronological transaction list.
- [x] 1.2 Implement dynamic account breakdown and filter chips (`All Accounts`, plus each paying account with its subtotal spend and count). Verify transactions default to showing all accounts and narrow correctly upon selecting an account chip.
- [x] 1.3 Implement dual-period controls (`Active Month`, `Comparison Baseline Month`, `Side-by-Side / Combined`) when baseline data is available, showing transaction totals and period variances. Verify switching tabs updates the displayed transaction set without refetching cached data.
- [x] 1.4 Support smart groups (e.g. Transport & Taxi) by passing both parent and child category IDs to the query and rendering sub-category badges on line items. Verify child items are identified properly.

## 2. Expenses Breakdown Card & Dashboard Wiring

- [x] 2.1 Update `ExpensePieCard` (`src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`) to add hover styles, click handlers, and an accessible button affordance to each category row and smart group child item, calling an `onSelectCategory` callback.
- [x] 2.2 Wire `CategoryExpenseTraceSheet` into `BudgetOverviewDashboard` (`src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`), providing active month date, baseline resolution date, category definitions, and default currency.
- [x] 2.3 Implement URL search parameter synchronization (`?traceCategory=<id>`) via `history.replaceState` or Next.js navigation utilities, verifying opening and closing the sheet updates the URL without causing a full-page reload or scroll reset.

## 3. Verification & Quality Gates

- [x] 3.1 Add unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/category-expense-trace.test.ts` covering account subtotal calculations, transaction filtering by account, and smart group ID resolution. Verify tests pass.
- [x] 3.2 Run `npm run verify` (`biome check && tsc --noEmit`) to confirm all files pass formatting, linting, and strict TypeScript typechecking.
