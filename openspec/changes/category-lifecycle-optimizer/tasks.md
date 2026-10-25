# Tasks

## 1. Data Transforms & Scoring Engine

- [ ] 1.1 Implement time-decayed category activity scoring function (`computeCategoryActivityScores`) using exponential half-life decay ($\tau = 30$ days) supporting configurable lookback windows in `external-provider-data.ts`, and verify via unit tests in `external-provider-data.test.ts`
- [ ] 1.2 Implement category audit classifier (`classifyCategoryActivity`) identifying zero-transaction, low-frequency ($\le 3$ tx), and active categories with standalone foreign-currency counterpart protection in `external-provider-data.ts`, and verify via unit tests
- [ ] 1.3 Implement tier-preserved smart ordering function (`optimizeCategoryOrderByActivity`) sorting active default and foreign tiers by activity score while anchoring soft-archived (`_`) and soft-deleted categories at the bottom in `external-provider-data.ts`, and verify via unit tests

## 2. Direct Category Renaming

- [ ] 2.1 Build focused `RenameCategoryDialog` component with in-scope collision checking (Expense vs Income), empty name prevention, and upstream persistence via `updateCategoriesOrder`
- [ ] 2.2 Add "Rename category..." action to category row dropdown menus in `SortableBudgetCategoryRow` (`budget-summary-card.tsx`), and verify dialog triggers with prefilled name and updates state upon confirmation
- [ ] 2.3 Add "Rename category..." action to category row dropdown menus in `IncomeSourcesCard` (`income-sources-card.tsx`), and verify dialog triggers with prefilled name and updates state upon confirmation

## 3. Category Renaming Assistant Enhancements

- [ ] 3.1 Enable editable target name inputs across all category rows in the "All Categories" view of `category-renaming-dialog.tsx`, and verify arbitrary edits participate in topological submission and collision checking
- [ ] 3.2 Add "Zero / Low Activity" audit tab to `category-renaming-dialog.tsx` displaying all-time zero-transaction and low-frequency categories with bulk archive capability, and verify status indicators render correctly

## 4. Budget Overview Inactive Filter & Smart Order Optimizer

- [ ] 4.1 Add "Zero Spend" filter pill to `BudgetSummaryCard` view controls alongside "Active in Month" and "All Categories" to isolate categories with no activity in the active period
- [ ] 4.2 Build `SmartOrderOptimizerDialog` featuring lookback scope selection ("All-Time", "180 Days", "90 Days"), before/after rank delta indicators (`+5`, `-3`), and transaction stats preview
- [ ] 4.3 Add "Smart Order" toolbar action to `BudgetSummaryCard` connecting to `SmartOrderOptimizerDialog` and persisting confirmed order sequences upstream via `updateCategoriesOrder`

## 5. Verification & Quality Assurance

- [ ] 5.1 Run `npm run verify` (`biome check && tsc --noEmit`) and ensure all linting, formatting, and strict TypeScript types pass without errors
