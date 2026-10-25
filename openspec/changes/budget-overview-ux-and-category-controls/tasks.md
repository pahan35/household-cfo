# Tasks

## 1. Multi-Period Zero-Spend & Last Active Indicator

- [ ] 1.1 Implement multi-period zero-spend evaluation helper supporting scopes (`current-month`, `3-months`, `6-months`, `12-months`, `all-time`) in `external-provider-data.ts` and verify with unit tests
- [ ] 1.2 Add lookback scope selector to Zero Spend view mode in `BudgetSummaryCard` and verify zero-spend counts update according to selected scope
- [ ] 1.3 Surface interactive "Last active:" indicator with timestamp and counterpart popover on every category row in `SortableBudgetCategoryRow` across all view modes and verify display

## 2. Category-Currency Budget Progress Normalization

- [ ] 2.1 Refactor `computeBudgetSummaryItems` in `budget-summary-card.tsx` to align currencies between spend and limits, converting reporting spend to native currency for standalone foreign categories and using default currency for Smart Groups, and verify with unit tests
- [ ] 2.2 Fix `SortableBudgetCategoryRow` rendering to display native spend and limit for foreign categories without double currency conversions and verify progress percentage and overrun state
- [ ] 2.3 Add unit tests in `spending-metrics.test.ts` covering foreign category progress calculations, smart group aggregations, and tooltip values

## 3. Unified Category Organization & Reorder Modal

- [ ] 3.1 Create `CategoryOrganizationDialog` consolidating Smart Order (activity lookback) and Tier Cleanup strategies with an interactive Before & After Diff table showing rank deltas and affected category counts
- [ ] 3.2 Replace scattered header reorder buttons and alert banners in `BudgetSummaryCard` with a unified `Organize Categories...` action and wire up dialog state
- [ ] 3.3 Add unit tests verifying order preview generation, affected entity counting, and `/Exchange/Ping` persistence payload generation

## 4. Quality & Regression Verification

- [ ] 4.1 Run unit tests (`npm test` or vitest) for budget transforms and category organization
- [ ] 4.2 Run `npm run verify` to validate formatting, linting, and strict TypeScript types
