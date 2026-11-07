# Proposal: Supabase Relational Budget Exclusion Presets

## Why

In the Family Budget dashboard, category exclusion presets (such as "Net Living" deducting taxes from income, or "Controllable Expenses" excluding rent from expenses) govern all net disposable income and controllable burn figures. Currently, customized presets and the active preset identifier are stored in browser `localStorage` (`family-budget:presets:v1` and `family-budget:active-preset:v1`).

Because family members review budget statistics across different devices (desktop, tablet, mobile), having custom category filters trapped in one browser causes confusing metric discrepancies: one spouse sees a budget figure with custom exclusions applied, while the other sees different numbers on their phone. Migrating exclusion presets to a shared Supabase PostgreSQL table ensures consistent, household-wide financial metrics across all devices.

## What Changes

- Create a PostgreSQL relational table `budget_exclusion_presets` in Supabase with explicit columns for preset name, income deduction category IDs (`TEXT[]`), expense exclusion category IDs (`TEXT[]`), built-in flags, and active status.
- Add server-side data access in `src/server/presets/db.ts` and Server Actions for preset CRUD and active preset selection.
- Update `use-exclusion-presets.ts` hook to synchronize with Supabase while caching locally in `localStorage`.
- Automatically seed default built-in presets and migrate existing custom `localStorage` presets into Supabase on first run.

## Capabilities

### New Capabilities
<!-- None: This enhances the existing expense-customization capability -->

### Modified Capabilities
- `expense-customization`: Replace single-browser `localStorage` preset persistence with a shared Supabase relational table (`budget_exclusion_presets`), synchronizing custom expense exclusions and active preset choice across family devices.

## Impact

- **Database**: Adds migration `0006_budget_exclusion_presets.sql` with unique index on active preset per household.
- **Backend / APIs**: Adds `src/server/presets/db.ts` and route handlers at `/api/family-budget/presets`.
- **Frontend**: Updates `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` to sync with Supabase and maintain `localStorage` cache.
- **Dependencies**: Uses existing Supabase infrastructure; zero new dependencies.
