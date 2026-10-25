# Proposal

## Why

The Category Normalization Assistant, Expense Category Management, and Category Expense Trace workflows currently suffer from several UX, layout, and data-scoping defects:
1. **Crushed Modal & Sheet Layouts and Poor Unselected Contrast**: Both `CategoryRenamingDialog` (`max-w-2xl` vs `sm:max-w-sm`) and `CategoryExpenseTraceSheet` (`sm:max-w-xl` vs `data-[side=right]:sm:max-w-sm`) are overridden by base `sm:max-w-sm` (384px) classes, truncating category names and account filter chips. Inside `CategoryRenamingDialog`, unselected items stack `opacity-60` and `disabled:opacity-50` (~30% effective contrast) and disable text inputs, preventing users from editing colliding proposals prior to selecting them.
2. **Unscoped Normalization & Missing Full Category Impact / Coupled Dependency Chains**: Normalization and collision detection currently mix `Income` and `Expense` categories together (causing false collisions on shared names like `"Gifts"`), hide unchanged categories so users cannot see what a proposed rename collides with, and lack reactive dependency tracking when a coupled rename chain (such as Step 1: `"Hotels" -> "Hotels UAH"` vacating `"Hotels"` for Step 2: `"Hotels PLN" -> "Hotels"`) has its prerequisite unchecked.
3. **Incomplete Expense Category Lifecycle, All-Time Inspection, and Broken Navigation State**: Expense categories lack full directory visibility (including zero-spend foreign-currency categories like `"Hotels CHF"`), soft-archiving/unarchiving (`_` prefix), and "move above archived" ordering controls on `/dashboard/family-budget/budget-overview`. Furthermore, `CategoryExpenseTraceSheet` cannot inspect all-time category transactions across months, its `"Open in Ledger"` link (`/dashboard/family-budget?categoryId=...`) is ignored by the ledger, and navigating back to `/dashboard/family-budget/budget-overview` loses the selected month and comparison state.

## What Changes

- **Context-Aware, Wide `CategoryRenamingDialog` with Scoped `Expenses | Income` Tabs**:
  - Remove the misplaced `Normalize Categories` trigger from `AccountsCard` on `/dashboard/family-budget`. Expose the shared assistant on `/dashboard/family-budget/budget-overview` (defaulting to the `Expenses` tab) and on `/dashboard/family-budget/income` (defaulting to the `Income` tab).
  - Strictly partition normalization rules, counterpart detection, collision checks, and `order` indexing by category type (`Expense` vs `Income`). Preserve leading `_` archive prefixes when normalizing archived categories (e.g. `_Diet PLN` -> `_Diet`).
  - Widen the dialog (`sm:max-w-4xl lg:max-w-5xl`), eliminate name truncation, and replace low-contrast `opacity-60` + disabled inputs on unselected rows with high-contrast readable styling and always-editable target name inputs.
  - Introduce **Full Category Impact & Concept Rename Groups**: show all categories of the active type (with `#order`, tier badge, and last transaction metadata), group linked categories sharing a canonical base name into dependent rename chains (e.g. Step 1 vacating a base name to `UAH` before Step 2 strips `PLN`), recalculate collisions and broken-chain warnings reactively on every checkbox toggle or edit, and submit modified entities in topological dependency order.
- **Full Expense Category Directory, Lifecycle & ExternalProvider Order Management on `/dashboard/family-budget/budget-overview`**:
  - Extend `BudgetSummaryCard` with a view mode switcher (**Active in Month** vs **All Expense Categories**) so users can view, click to trace, and manage all expense categories in ExternalProvider `#order`—even categories with zero spend or limit in the active month (such as rarely-used `"Hotels CHF"` or `"Medicine UAH"`).
  - Add expense category lifecycle and ordering parity with accounts and income sources: `archiveExpenseCategory`, `unarchiveExpenseCategory`, `findExpenseCategoriesBelowArchived`, `moveExpenseCategoriesAboveArchived`, and a batch action to position foreign/legacy currency categories (`UAH`, `CHF`, `EUR`, etc.) immediately above `_`-archived categories.
- **Wider `CategoryExpenseTraceSheet`, All-Time History Tab, and Working Ledger Deep-Linking**:
  - Fix `SheetContent` width override (`data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`) so account filter chips and transaction rows are never crushed to 384px.
  - Add an **`All-Time`** period tab inside `CategoryExpenseTraceSheet` (alongside the active month and optional comparison baseline) to inspect all historical transactions for any category or Smart Group without month bounds.
  - Wire `?categoryId=...` (including multi-ID Smart Groups and optional `accountId`) on `/dashboard/family-budget` so `"Open in Ledger"` filters `RecentTransactionsCard` and displays a removable category filter badge.
- **Persistent Period & Comparison State (`URL + localStorage`)**:
  - Persist `month` (`activeMonthDateStr`), `compare` (`compareMode`), `compareDate` (`compareCustomDateStr`), and `traceCategory` in both URL query parameters and `localStorage` on `/dashboard/family-budget/budget-overview` so browser Back/Forward navigation and page reloads restore the exact reporting state.

## Capabilities

### New Capabilities
<!-- None - all changes extend existing capabilities -->

### Modified Capabilities
- `category-management`: Scope normalization and collision detection per category type (`Expense` vs `Income`), preserve `_` archive prefixes, add `Expenses | Income` tabs with route-based default selection, provide full category impact view with `#order` and tier metadata, model coupled Concept Rename Groups with reactive dependency/collision validation and topological submission order, and fix modal width and unselected row contrast.
- `budget-overview`: Remove normalization trigger from `AccountsCard`, add persistent URL + `localStorage` state for selected month and comparison mode on `/dashboard/family-budget/budget-overview`, add "All Expense Categories" directory view and full archive/unarchive/above-archived/foreign-tier ordering lifecycle to `BudgetSummaryCard`, widen `CategoryExpenseTraceSheet` with an `All-Time` history tab, and support `?categoryId` filtering in the `/dashboard/family-budget` transaction ledger.
- `income-and-tax-management`: Expose the shared `CategoryRenamingDialog` (defaulting to the `Income` tab) from the Income Sources header on `/dashboard/family-budget/income`.

## Impact

- **Components**:
  - `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-sheet.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx`
- **Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/category-expense-trace-helpers.test.ts`
- **APIs & Dependencies**: Uses existing `/api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2`) and `/api/external-provider/api/transaction/get` proxy endpoints; no new dependencies or modifications to `src/components/ui/`.
