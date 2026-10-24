# Proposal

## Why

Users reviewing the "Expenses Breakdown" on the Budget Overview dashboard can see aggregated category totals and period-over-period variances (e.g. Groceries increased by 567 PLN), but cannot inspect the underlying transactions that produced those numbers without leaving the screen. When investigating variances or auditing monthly spend, users need an effortless way to trace which specific expenses occurred within a category in the active month and in the comparison baseline month across all accounts, without losing their dashboard context or being forced to filter by account first.

## What Changes

- Make category rows in the "Expenses Breakdown" card interactive, enabling users to click any category (or smart group) to launch a dedicated Category Expense Trace slide-over sheet.
- Introduce a Slide-over Sheet (`CategoryExpenseTraceSheet`) on `/dashboard/family-budget/budget-overview` that loads all transactions for the inspected category.
- Support dual-period tracing: provide tabs to inspect transactions for the **Active Month**, the **Comparison Baseline Month** (when a comparison mode such as Previous Month, Same Month Last Year, or Custom Month is enabled), or a **Side-by-Side / Combined** view.
- Default to showing all transactions across all accounts, badging each transaction with its paying account (Primary Bank, Revolut, Cash, etc.).
- Provide non-intrusive in-sheet Account Filter chips (`All Accounts`, plus chips for each account involved in that category's spending with subtotal amounts) allowing users to isolate transactions from a specific account on demand.
- Support deep linking and URL state reflection via query parameters (e.g., `?traceCategory=<id>&traceMonth=yyyy-MM-dd`) so trace views are bookmarkable and browser-back friendly.
- Provide an optional action inside the sheet to open the full filtered ledger in `/dashboard/family-budget`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `budget-overview`: Enhance the Expenses Breakdown section to support category-level transaction tracing via an in-place slide-over sheet with active month, comparison baseline month, and non-intrusive account filtering.

## Impact

- **Affected Code**:
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx` (add click handlers to category rows, visual affordance/hover state).
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx` (state management for category inspection, comparison month synchronization, URL query sync).
  - New component `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-sheet.tsx` (slide-over sheet with period selector, account chips, transaction list).
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` / caching (utilizes existing `getTransactionPage` with `categoryIds` and `periodFilter`).
- **Dependencies & UI Components**:
  - Uses existing shadcn `Sheet`, `Badge`, `Button`, `ScrollArea` / `Tabs`.
- **Breaking Changes**: None. Backwards-compatible addition to the Budget Overview screen.
