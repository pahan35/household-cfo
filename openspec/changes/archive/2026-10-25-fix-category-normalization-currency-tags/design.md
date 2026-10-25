# Design

## Context

The Category Normalization Assistant provides batch category renaming under the Clean Default convention. In `generateProposedCategoryRenames()` (`src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`), Ukrainian translation and legacy categories currently hardcode `proposedStem = \`${translated} UAH\`` and `tags.push(RENAME_TAGS.ADD_UAH)`. This causes categories denominated in non-UAH currencies (such as `"Навчання EUR"` with `currencyId: "EUR"`) to be wrongly rewritten to `"Learning UAH"`.

## Goals / Non-Goals

**Goals:**
- Resolve category currency hierarchically: `category.currencyId` -> trailing name suffix -> historical transaction / timestamp fallback -> `defaultCurrency`.
- In Cyrillic translation, preserve existing non-default currency suffixes (e.g. `"Навчання EUR"` -> `"Learning EUR"` with tag `[Translate UA]`).
- For categories whose resolved currency does not equal `defaultCurrency` and lack a currency suffix in their names, propose appending the currency suffix with dynamic tag `[Add <CURRENCY>]` (e.g. `[Add EUR]`, `[Add USD]`, `[Add UAH]`).
- Work identically for both `Expense` and `Income` scopes.
- Maintain existing two-step topological ordering (`Step 1: vacate base name` -> `Step 2: claim base name`) and collision detection.

**Non-Goals:**
- Modifying ExternalProvider API contracts or `/Exchange/Ping` payloads.
- Altering the smart order activity decay score or category liquidity metrics.

## Decisions

### 1. Currency Resolution Hierarchy

We establish a helper `resolveCategoryCurrency(cat, options)`:
1. `cat.currencyId` (trimmed and uppercased) if present and non-empty.
2. Trailing currency suffix in `cat.name` matching known default or foreign currency regex.
3. Transaction currency history for this category or pre-2022 timestamp (`"UAH"`).
4. Fallback to `defaultCurrency` (`"PLN"`).

*Rationale*: ExternalProvider stores the true denomination in `cat.currencyId`. Where `currencyId` is present, it must be the source of truth.

### 2. Suffix Preservation vs Append in Translation

When `hasCyrillic` is detected:
- Extract the base stem by stripping any foreign suffix.
- Translate the base stem using `LOCALIZED_CATEGORY_DICTIONARY`.
- Determine target currency from `resolveCategoryCurrency`.
- If target currency equals `defaultCurrency`: propose the bare translated name (no currency suffix) with `[Translate UA]`.
- If target currency differs from `defaultCurrency`:
  - If the original name already had that currency suffix: retain the suffix (`${translated} ${curr}`), tagging only `[Translate UA]` (no `[Add ...]` tag).
  - If the original name did NOT have that currency suffix: append ` ${curr}`, tagging both `[Translate UA]` and `[Add ${curr}]`.

*Alternative considered*: Always adding `[Add <CURRENCY>]` even when already present. Rejected because the tag implies a newly added suffix, whereas here the suffix was already part of the category's original name.

### 3. Dynamic Currency Add Tag Helper

Replace the static `RENAME_TAGS.ADD_UAH` with:
```ts
export function getAddCurrencyTag(currency: string): string {
  return `[Add ${currency.toUpperCase()}]`;
}
```
In `category-renaming-dialog.tsx`, the tag badge rendering already styles any tag where `tag.includes("Add")` with emerald badge classes, so `[Add EUR]`, `[Add USD]`, and `[Add UAH]` seamlessly render with existing UI styles.

### 4. Dictionary Expansion

Add common Ukrainian budget categories to `LOCALIZED_CATEGORY_DICTIONARY`:
- `"навчання": "Learning"`
- `"освіта": "Education"`
- `"зарплата": "Salary"`

## Risks / Trade-offs

- **[Risk]** Categories with an inaccurate `currencyId` stored in ExternalProvider might propose unexpected currency tags.
  → *Mitigation*: The interactive preview dialog allows users to edit target names in-place or uncheck individual proposals before batch persistence.
