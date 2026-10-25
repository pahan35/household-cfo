# Proposal

## Why

On the `/dashboard/family-budget/budget-overview` screen, the "Expenses Breakdown" section and its "Exclusion Presets & Fixed Obligations" modal exhibit several usability and persistence defects:
1. A redundant and non-persisted "Exclude Rent" switch overrides preset definitions in memory, creating confusing dual state.
2. Custom category exclusion selections for the built-in "Controllable Expenses" preset disappear on page reload due to dialog synchronization issues and built-in preset filtering in local storage.
3. The preset configuration checklist surfaces unrelated accounts (cards, bank accounts, debt accounts), pure income sources, and savings goals rather than actual expense categories.
4. Soft-archived categories (prefixed with `_`) are displayed indiscriminately without the standard archive filtering applied across the rest of the dashboard.

Streamlining this flow establishes a single source of truth for controllable expense exclusions, preserves user selections across reloads, and presents a clean, accurate category list.

## What Changes

- **Remove "Exclude Rent" Switch**: Eliminate the redundant switch in the "Expenses Breakdown" header and retire the temporary in-memory override in `useExclusionPresets`. All category exclusions (including housing and rent) are driven exclusively by the active preset.
- **Fix Preset Persistence & Dialog Synchronization**:
  - Ensure customized category exclusions for built-in presets (e.g. "Controllable Expenses") are persisted to `localStorage` and never discarded upon reload.
  - Synchronize draft exclusions and preset state whenever the configuration dialog is opened, correcting a bug where controlled Radix Dialog open transitions failed to initialize draft state.
  - Clean up redundant duplicate hook instantiations between parent and child components.
- **Filter Preset Modal Categories**: Restrict the checklist in the "Exclusion Presets & Fixed Obligations" modal strictly to valid expense categories by omitting account types (`Account`, `BankAccount`, `DebtAccount`), income sources (`Income`), and savings goals (`Goal`, `ClassicGoal`).
- **Apply Standard Category Archive Logic**:
  - Treat categories beginning with `_` as archived.
  - Hide inactive archived categories (0 period spending, 0 budget limit, and not currently excluded) by default in the checklist.
  - Surface a "Show archived (N)" toggle to allow users to inspect and toggle archived categories when necessary.
  - Format archived categories cleanly with an "Archived" badge and sanitized display names.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `expense-customization`: Update exclusion preset management and controllable expenses filtering requirements to specify category filtering (excluding accounts, income, goals), standard archive logic for inactive `_`-prefixed categories, removal of the standalone rent toggle in favor of preset definitions, and reliable persistence of customized preset selections across hard reloads.

## Impact

- Affected frontend components:
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts`
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
- Affected storage: `localStorage` keys `family-budget:presets:v1` and `family-budget:active-preset:v1`.
- No upstream ExternalProvider API or database schema changes.
