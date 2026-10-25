# Design

## Context

See `proposal.md` for motivation and problem summary. Several concrete technical constraints shape the solution:
1. **UI Primitives Are Read-Only (`src/components/ui/`)**: Per repository rules, `src/components/ui/dialog.tsx` (which includes `sm:max-w-sm`) and `src/components/ui/sheet.tsx` (which includes `data-[side=right]:sm:max-w-sm`) must not be modified. All width overrides must be passed via `className` using matching variant prefixes (`sm:max-w-4xl lg:max-w-5xl` on `DialogContent`, and `data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl` on `SheetContent`) so `tailwind-merge` properly replaces the base width constraints.
2. **ExternalProvider Category Sync Protocol (`/Exchange/Ping`)**: `ExchangeKey.Category = 2` accepts an array of modified `ExternalProviderCategory` entities keyed by stable UUID `id`. Categories are partitioned by `categoryType` (`CategoryType.Income = 1`, `CategoryType.Account = 2 / 5 / 7`, `CategoryType.Expense = 3 / 4 / 6`), and each partition maintains its own 0-indexed `order` sequence (`0, 1, 2, ...`).

## Goals / Non-Goals

**Goals:**
- Partition normalization, counterpart detection, collision validation, and `order` management strictly by category scope (`expense` vs `income`).
- Provide a full category impact and Concept Rename Group model that surfaces unchanged categories, ExternalProvider `#order`, tier status, coupled step dependencies, and live reactive collision diagnostics.
- Provide full Expense Category lifecycle and ExternalProvider `order` management (archive/unarchive `_`, move active above archived, position foreign-currency tier right above archived, and inspect all categories regardless of monthly spend) on `/dashboard/family-budget/budget-overview`.
- Fix `CategoryExpenseTraceSheet` width, add an `All-Time` historical transaction tab, wire `?categoryId` filtering on `/dashboard/family-budget`, and persist Budget Overview period/comparison state across URL and `localStorage`.

**Non-Goals:**
- Modifying upstream ExternalProvider API endpoints or altering `src/components/ui/*` primitives.
- Auto-deleting categories (ExternalProvider soft-archiving via `_` prefix and `order` demotion remains the canonical non-destructive lifecycle pattern).

## Decisions

### 1. Scoped Category Normalization, Concept Groups, and Reactive Dependency Graph

- **Decision**: Introduce a `CategoryNormalizationScope = "expense" | "income"` parameter to `generateProposedCategoryRenames` (and a companion full-audit builder `buildCategoryNormalizationPlan`) in `external-provider-data.ts`:
  - `expense` scope includes `!c.deleted && (t === CategoryType.Expense || t === CategoryType.Goal || t === CategoryType.ClassicGoal)`.
  - `income` scope includes `!c.deleted && t === CategoryType.Income`.
  - **Archive Prefix Preservation**: Before checking currency suffixes or Ukrainian translations, extract any leading `_+` prefix (`isArchived = /^_+/.test(rawName)`). Run normalization on the clean stem, then re-prepend `_` if the original category was archived (e.g. `"_Diet PLN"` -> `"_Diet"`, `"_Ліки"` -> `"_Medicine UAH"`).
  - **Concept Rename Groups & Coupled Chains**: Group categories within the same scope by their canonical base name (`extractCanonicalBaseName`, stripping leading `_`). Within a group:
    - Any category whose rename **vacates** the canonical base name (e.g. `#12 Hotels -> Hotels UAH` via `[Add UAH]` or `[Translate UA]`) is assigned `stepOrder: 1` (`vacatesBaseName: "hotels"`).
    - Any category whose rename **claims** the canonical base name (e.g. `#3 Hotels PLN -> Hotels` via `[Strip PLN]`) is assigned `stepOrder: 2` (`claimsBaseName: "hotels"`, `dependsOnCategoryIds: [...]`).
  - **Reactive Collision & Dependency Evaluator**: Extract a pure function `evaluateCategoryRenameState(allScopeCategories, itemsState)` that runs on every checkbox toggle and input change:
    - Computes the **effective post-apply name** of every category in the scope: `item.selected ? item.editedName.trim() : item.currentName`.
    - If a selected item's `editedName` matches another category's effective post-apply name (case-insensitive) within the same scope:
      - If that other category is an unchecked prerequisite in the same Concept Group (e.g. `#12 Hotels` was unchecked so its effective name remains `"Hotels"`), flag a **Broken Chain / Dependency Collision**: *"Blocked: #12 'Hotels' is unchecked and still occupies 'Hotels'. Check #12 or edit target name."*
      - Otherwise, flag a **Name Collision** naming the exact conflicting category and its `#order` (e.g. *"Collides with #18 'Medicine UAH' (proposed from 'Medicine')"* or *"Collides with #6 'Medicine UAH' (unchanged)"*).
  - **Topological Submission Order**: When applying renames, sort selected modified categories by `stepOrder` ascending (`stepOrder: 1` vacating renames before `stepOrder: 2` claiming renames, tie-breaking by `order`) before calling `updateCategoriesOrder`.

- **Rationale**: Evaluating effective post-apply names across *all* categories in the active scope (both changed and unchanged) makes collision detection 100% reactive to both checkbox toggles and manual edits, while Concept Groups visually explain coupled UAH/PLN transitions without requiring multiple network passes.

### 2. High-Contrast Shared `CategoryRenamingDialog` with Route-Aware Default Tab

- **Decision**:
  - Accept `defaultScope?: "expense" | "income"` on `CategoryRenamingDialog` (`"expense"` on `/dashboard/family-budget/budget-overview`, `"income"` on `/dashboard/family-budget/income`). Remove the trigger from `AccountsCard` on `/dashboard/family-budget`.
  - Render `DialogContent` with `className="sm:max-w-4xl lg:max-w-5xl max-h-[88vh] flex flex-col p-6"`.
  - Provide top-level `Expenses` and `Income` tabs, a view filter (`Concept Groups & Changes` | `All Categories (#Order)` | `Collisions`), and a search input.
  - Replace `opacity-60` and `disabled={!item.selected}` on unselected rows with a high-contrast muted surface (`bg-muted/25 border-border/70 text-foreground`), an explicit `Skipped / Unchanged` badge, and an **enabled** `<Input>` so users can edit a colliding target name directly (editing an unselected row's name can either auto-select it or allow one-click selection once non-colliding).

### 3. Expense Category Lifecycle & Tiered ExternalProvider Order Management

- **Decision**:
  - Add pure helper functions in `external-provider-data.ts` mirroring Account and Income lifecycle functions:
    - `isExpenseCategory(c: ExternalProviderCategory): boolean` (`Expense`, `Goal`, `ClassicGoal`).
    - `archiveExpenseCategory(allCategories, categoryId)` -> prefixes `_`, moves to end of expense group, re-indexes `order: 0..N-1`.
    - `unarchiveExpenseCategory(allCategories, categoryId)` -> strips leading `_`, moves immediately before first `_` archived expense category, re-indexes `order`.
    - `findExpenseCategoriesBelowArchived(allCategories)` and `moveExpenseCategoriesAboveArchived(allCategories, categoryIds?)`.
    - `organizeExpenseCategoriesByCurrencyTier(allCategories, defaultCurrency)` -> partitions active expense categories into primary default-currency categories followed by foreign/legacy-currency suffixed categories (`UAH`, `CHF`, `EUR`, `USD`, `GBP`, `CZK`), followed by `_` archived categories, preserving relative order within each tier so rarely-used travel/legacy categories (like `"Hotels CHF"`) sit neatly right above archived categories.
  - In `BudgetSummaryCard`:
    - Add a view toggle: `Active in Month` vs `All Categories (${totalExpenseCount})`.
    - In `All Categories` mode (and in `Custom Order`), show every expense category with its `#order` badge, currency/tier badge, last transaction summary, drag-and-drop handle, row action menu (`Inspect Transactions`, `Move above archived`, `Archive` / `Unarchive`), and a banner when active expense categories sit below archived ones (plus a toolbar action to move foreign-currency categories right above archived).
    - Clicking any category row (or choosing `Inspect Transactions`) triggers `onSelectCategory` to open `CategoryExpenseTraceSheet`.

### 4. Wide `CategoryExpenseTraceSheet` with `All-Time` Tab and Ledger Deep-Linking

- **Decision**:
  - Override `SheetContent` width using `data-[side=right]:sm:max-w-xl data-[side=right]:md:max-w-2xl`.
  - Expand `periodTab` in `CategoryExpenseTraceSheet` to `"active" | "baseline" | "combined" | "all-time"`.
  - Always render the period tabs bar in `CategoryExpenseTraceSheet` (showing `Active Month (<Label>)`, optional `Baseline` / `Side-by-Side` when comparison is active, and `All-Time History`). When `All-Time History` is selected (or automatically if the user opens a category that has `0` transactions in the active month and switches to `All-Time`), fetch via `getTransactionPage({ categoryIds, take: 300 })` with `period: undefined` so transactions across all years (e.g., 2023 `"Hotels CHF"`) are displayed.
  - Update `ledgerLink` in `CategoryExpenseTraceSheet` to include all resolved `categoryIds` (`?categoryId=${categoryIds.join(",")}`) and optional `&accountId=${selectedAccountId}`.
  - In `FamilyBudgetDashboard` and `RecentTransactionsCard`:
    - Read `?categoryId` and `?accountId` from URL search params on mount and `popstate`.
    - Pass `selectedCategoryIds?: string[]` to `RecentTransactionsCard`, which forwards `categoryIds` to `getTransactionPage` (and filters client-side if both `selectedAccountId` and `selectedCategoryIds` are active), showing a removable category filter chip in the card header that clears the URL param when dismissed.

### 5. URL + `localStorage` Persistence for Budget Overview Period & Comparison State

- **Decision**:
  - Create a lightweight state synchronization hook/helper in `budget-overview-dashboard.tsx` using storage key `"family-budget:budget-overview-period-v1"`.
  - Priority order on initialization:
    1. URL search parameters (`?month=YYYY-MM-DD`, `?compare=none|prev|yoy|custom`, `?compareDate=YYYY-MM-DD`, `?traceCategory=<id>`).
    2. `localStorage` saved values (if valid `YYYY-MM-DD`).
    3. Default current month (`format(startOfMonth(new Date()), "yyyy-MM-dd")`).
  - Whenever `activeMonthDateStr`, `compareMode`, `compareCustomDateStr`, or `selectedTraceCategory` changes, update both `window.history.replaceState` query parameters and `localStorage`. Also listen to `popstate` so browser Back/Forward restores state immediately.

## Risks / Trade-offs

- **[Risk] Large number of categories (100+) in `CategoryRenamingDialog` or `All Categories` view** -> Mitigation: Use clean filter tabs (`Proposed Changes`, `Concept Groups`, `All Categories`, `Collisions`) and instant text search so users can either focus on actionable renames/chains or browse the full ExternalProvider `#order` list without clutter.
- **[Risk] Simultaneous `selectedAccountId` and `selectedCategoryIds` filter in `RecentTransactionsCard`** -> Mitigation: ExternalProvider's `/api/transaction/get` accepts `categoryIds: string[]`. When filtering by category IDs (e.g. from `Open in Ledger`), pass `categoryIds: selectedCategoryIds` to `getTransactionPage`, and if an `accountId` is also selected, filter the returned rows by `tx.sourceId === selectedAccountId || tx.destinationId === selectedAccountId`.
