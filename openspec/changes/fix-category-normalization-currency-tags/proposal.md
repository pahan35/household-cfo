# Proposal

## Why

The Category Normalization Assistant currently hardcodes Ukrainian Cyrillic category translations and pre-2022 legacy categories to the `" UAH"` suffix and `[Add UAH]` tag, regardless of the category's actual currency (`currencyId`). For categories denominated in non-UAH currencies such as `"Навчання EUR"` (`currencyId: "EUR"`), the assistant erroneously proposes renaming to `"Learning UAH"` with `[Translate UA]` and `[Add UAH]`.

Furthermore, active categories denominated in non-default currencies (such as EUR or USD) that lack currency suffixes in their names are not offered normalization renames to add their corresponding currency suffix (`[Add <CURRENCY>]`).

## What Changes

- Resolve a category's effective currency by checking `currencyId`, trailing name currency suffix, and transaction history / pre-2022 timestamp before proposing normalization renames.
- For Ukrainian Cyrillic categories, translate the Ukrainian label while preserving or appending the category's actual currency suffix when it differs from the default currency (`PLN`), instead of hardcoding `UAH`.
- When an existing Ukrainian category already has a foreign currency suffix (e.g., `"Навчання EUR"`), retain that suffix (`"Learning EUR"`) and tag only with `[Translate UA]`.
- When an Expense or Income category is denominated in a non-default currency (`categoryCurrency !== defaultCurrency`) and lacks a currency suffix in its name, offer to append its currency suffix (e.g. `"Hotels EUR"`, `"Salary USD"`) with tag `[Add <CURRENCY>]` (such as `[Add EUR]`, `[Add USD]`, `[Add UAH]`).
- Expand `LOCALIZED_CATEGORY_DICTIONARY` with `"навчання": "Learning"` and common Ukrainian budget terms.
- Generalize `RENAME_TAGS` to dynamically support currency-specific add tags via `getAddCurrencyTag(currency)`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `category-management`: Update normalization rules to resolve category currency dynamically, retain existing foreign suffixes during Cyrillic translation, and offer `[Add <CURRENCY>]` renames for non-default currency categories across both Expense and Income tabs.

## Impact

- Affected code: `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`, `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx`, and test suites `external-provider-data.test.ts`.
- No upstream API schema or database breaking changes.
