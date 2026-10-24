# Tasks

## 1. Domain Utilities: Canonical Base Name & Normalization Engine

- [ ] 1.1 Add `extractCanonicalBaseName`, `LOCALIZED_CATEGORY_DICTIONARY`, and clean-default normalization helpers in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` and verify unit tests in `external-provider-data.test.ts`.
- [ ] 1.2 Implement category rename generation and collision-detection helper `generateProposedCategoryRenames` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` and verify unit tests.

## 2. In-App Category Normalization & Renaming Assistant Dialog

- [ ] 2.1 Create `CategoryRenamingDialog` in `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx` displaying current names, proposed names, tags (`[Strip PLN]`, `[Translate UA]`, `[Add UAH]`), checkboxes, and editable inputs.
- [ ] 2.2 Wire up batch category updates in `CategoryRenamingDialog` via `updateCategoriesOrder` to `POST /api/external-provider/Exchange/Ping`, cache invalidation, and toast feedback.
- [ ] 2.3 Mount the "Normalize Categories" trigger button in the Budget Overview / Accounts card header.

## 3. Generalized Smart Category Grouping in `expense-transforms.ts`

- [ ] 3.1 Update `groupSmartSlices` in `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts` to automatically roll up categories sharing the same canonical base name into unified smart groups with `hasForeignCurrency`, `foreignCurrencies`, and child slices.
- [ ] 3.2 Update `spending-metrics.test.ts` to verify multi-currency smart grouping, child slice preservation, and clean-default name handling.

## 4. UI Updates: Expenses Breakdown Card (`ExpensePieCard`)

- [ ] 4.1 Update `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx` to render canonical base names (without default currency suffixes) on the donut chart and list.
- [ ] 4.2 Add foreign currency indicator icon/badge (`Globe` / `Coins` / `[+UAH]`) to categories with non-default currency spend in the breakdown list and render expandable/indented child line items.
- [ ] 4.3 Enhance donut chart tooltip to display native currency breakdown when foreign currencies are present.

## 5. Verification & Quality Gates

- [ ] 5.1 Run `npm run verify` (`biome check && tsc --noEmit`) and ensure all linting, formatting, and type checks pass with zero errors.
- [ ] 5.2 Run automated unit tests (`npm test` or test runner) to ensure all budget overview, category normalization, and expense transformation suites pass.
