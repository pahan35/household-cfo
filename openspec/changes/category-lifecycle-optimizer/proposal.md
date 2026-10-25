# Proposal: Category Lifecycle Optimizer & Smart Order

## Why

Managing categories in Family Budget currently suffers from three friction points:
1. Category renaming is constrained: the normalization assistant only proposes changes matching specific heuristic rules (currency tags, Cyrillic translation), while standard categories cannot be renamed in bulk or directly from category row action menus.
2. Inactive or orphaned categories are invisible: views prioritize categories with positive spending in the active month, obscuring categories that have never had transactions (orphaned deadwood) or categories with rare one-off transactions that warrant consolidation.
3. Category sequence in ExternalProvider `#order` is either manual drag-and-drop or currency-tier sorted, without a way to automatically optimize visual hierarchy based on how frequently and recently categories are actually used.

## What Changes

- **In-App Direct & Batch Category Renaming**:
  - Add a "Rename category..." action to category row dropdown menus (`...`) in `SortableBudgetCategoryRow` (`BudgetSummaryCard`) and `IncomeSourcesCard`, opening a focused rename dialog with live in-scope collision checks (evaluating collisions strictly within Expense vs Income).
  - Enable editable target name inputs for *all* categories inside `CategoryRenamingDialog`'s "All Categories" view, allowing arbitrary single and batch renames alongside rule-based normalizations.
- **Category Activity & Orphan Audit**:
  - Introduce an activity audit classifying categories into: Zero-Transaction (all-time unused), Low-Frequency ($\le 3$ transactions), and Active.
  - Provide an audit view/filter in the assistant with quick one-click actions to archive (`_` prefix) or rename orphaned categories.
  - Recognize standalone foreign currency categories without main currency counterparts (e.g. occasional `EUR` or `CHF` buckets) so they are preserved without false-positive orphan warnings.
  - Add an "Inactive / Zero Spend" filter pill to `BudgetSummaryCard` to quickly inspect categories with no activity in the selected period.
- **Smart Order Optimization (Frequency & Recency)**:
  - Implement a time-decayed activity scoring engine ($\text{Score}(c) = \sum_{tx} 2^{-\text{age}(tx)/\tau}$ with $\tau \approx 30$ days) combining transaction frequency and recency.
  - Support configurable lookback scopes: "All-Time" (initial baseline setup) and rolling "90 Days" / "180 Days" (periodic recalibration).
  - Respect existing architectural tiers: re-ranking applies within Active Primary (PLN) and Active Foreign tiers, strictly keeping soft-archived (`_`) and soft-deleted categories at the bottom.
  - Provide an interactive "Smart Order Optimizer" preview dialog displaying rank deltas (`+5`, `-3`), transaction volume, and last-active dates before committing changes upstream via `updateCategoriesOrder`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `category-management`: Add requirements for arbitrary direct and batch category renaming with in-scope collision checking, zero-transaction and low-frequency activity auditing with foreign-currency counterpart awareness, and time-decayed frequency/recency smart order optimization with preview and tier preservation.

## Impact

- **Client Components**:
  - `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx`: Editable target inputs in All view, activity audit tab/filter, smart order preview dialog/tab.
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`: Row dropdown "Rename category..." action, "Inactive / Zero Spend" filter view, toolbar trigger for Smart Order Optimizer.
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx`: Row dropdown "Rename category..." action.
- **Data Transforms & Utilities**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`: Time-decayed activity scoring functions, category activity categorization helpers, smart ordering within currency tiers.
- **Tests**:
  - Unit tests in `external-provider-data.test.ts` for scoring algorithms, tier-preserved smart sorting, and collision detection.
