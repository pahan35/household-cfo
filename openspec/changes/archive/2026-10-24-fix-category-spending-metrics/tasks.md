# Tasks

## 1. Test Harness Setup

- [x] 1.1 Configure lightweight unit test runner and `npm test` script in `package.json`, verifying it executes cleanly without network dependencies
- [x] 1.2 Create test fixtures modeling real ExternalProvider `/stat/ping` and `/Exchange/Ping` payloads (including non-zero `amount`, zero `currentAmount`, `id`, and `date` formats)

## 2. Core Transform Fixes

- [x] 2.1 Update `expense-transforms.ts` to extract spending amounts from `amount ?? currentAmount ?? value` and category titles from `statCat.title ?? catMap.get(id)?.name`, verifying with unit tests
- [x] 2.2 Update `budget-summary-card.tsx` to read spending amounts from `amount ?? currentAmount ?? value`, verifying with unit tests
- [x] 2.3 Update `yoy-transforms.ts` to implement resilient `parsePointDate` prioritizing ISO `point.id` and parsing `"M-yyyy"` fallback, verifying with unit tests

## 3. Query Anchoring & Point Resolution

- [x] 3.1 Update `family-budget-dashboard.tsx` `currentMonthAnchor` to today's date (`format(new Date(), "yyyy-MM-dd")`), verifying query includes the active month
- [x] 3.2 Update active point fallback in `family-budget-dashboard.tsx` to select `points[0]` (newest) instead of `points[points.length - 1]`, verifying proper period data display when exact match is absent

## 4. Verification and Validation

- [x] 4.1 Run full unit test suite (`npm test`) and verify 100% test pass rate
- [x] 4.2 Run project verification (`npm run verify`) and ensure type-checking and Biome linting pass without errors
