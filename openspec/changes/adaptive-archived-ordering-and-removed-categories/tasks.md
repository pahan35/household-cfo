# Tasks

## 1. Domain Logic & Ordering Utilities

- [ ] 1.1 Implement adaptive displacement analysis (`detectExpenseCategoryDisplacement`) and minimal-mutation reordering (`moveExpenseCategoriesToBottom`, preserving active category orders) in `external-provider-data.ts`, verified by unit tests in `external-provider-data.test.ts`.
- [ ] 1.2 Update `organizeExpenseCategoriesByCurrencyTier` and category sorting helpers in `external-provider-data.ts` to enforce the strict hierarchy (Active primary $\rightarrow$ Active foreign $\rightarrow$ Archived $\rightarrow$ Removed), verified by unit tests.
- [ ] 1.3 Update `computeBudgetSummaryItems` in `budget-summary-card.tsx` to strictly filter out `deleted: true` categories by default and remove the conflation with `showArchived`, verified by unit tests in `spending-metrics.test.ts`.

## 2. Card Presentation & Interactive Controls

- [ ] 2.1 Update `BudgetSummaryCard` banner and actions to adaptively display "Move archived to bottom" when archived categories sit above active categories and "Move above archived" when active categories sit below archived categories, and wire row-level "Move to bottom" actions.
- [ ] 2.2 Add a dedicated "Show removed (N)" toggle, distinct `Removed` badge styling, and bottom-placement rendering to `BudgetSummaryCard`.
- [ ] 2.3 Implement targeted transaction fetching for visible categories missing last-transaction dates in `budget-overview-dashboard.tsx` using `getTransactionPage` with `categoryIds`.
- [ ] 2.4 Add a "Show removed" toggle to `CategoryRenamingDialog` and update `isInNormalizationScope` to allow reviewing and renaming soft-deleted categories.

## 3. Verification & Quality Gates

- [ ] 3.1 Run `npm run verify` and unit tests to verify strict typing, Biome formatting, and zero regressions across all modified files.
