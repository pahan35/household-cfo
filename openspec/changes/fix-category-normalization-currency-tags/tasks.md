# Tasks

## 1. Currency Resolution & Tag Infrastructure

- [ ] 1.1 Expand `LOCALIZED_CATEGORY_DICTIONARY` with `"навчання": "Learning"`, `"освіта": "Education"`, and `"зарплата": "Salary"` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`.
- [ ] 1.2 Implement `resolveCategoryCurrency()` helper and dynamic `getAddCurrencyTag(currency: string)` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`.

## 2. Normalization Rule Engine Updates

- [ ] 2.1 Update `generateProposedCategoryRenames()` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` to preserve existing foreign currency suffixes during Cyrillic translation (e.g. `"Навчання EUR"` -> `"Learning EUR"` with tag `[Translate UA]`).
- [ ] 2.2 Update `generateProposedCategoryRenames()` to propose appending non-default currency suffixes (`[Add <CURRENCY>]`) when `categoryCurrency !== defaultCurrency` and the category name lacks a currency suffix, across both Expense and Income scopes.
- [ ] 2.3 Verify `category-renaming-dialog.tsx` renders dynamic add tags (`[Add EUR]`, `[Add USD]`, etc.) cleanly with emerald badge styling.

## 3. Unit Tests & Verification

- [ ] 3.1 Add unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` covering `"Навчання EUR"` translation to `"Learning EUR"`, untagged non-default currency categories (`"Hotels"` EUR -> `"Hotels EUR"` with `[Add EUR]`), and Income category normalization.
- [ ] 3.2 Run `npx vitest run src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` and `npm run verify` to ensure all tests pass without type or lint errors.
