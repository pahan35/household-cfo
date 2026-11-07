# Proposal: Supabase Relational Runway Scenarios

## Why

The Runway & Income Loss Simulator (`/dashboard/family-budget/runway`) models household financial survival if Polish B2B (JDG) income ceases, calculating capital depletion across statutory zero-revenue obligations, Month-1 tax lag, and category-level austerity reductions. Currently, all scenario settings, capital pool selections, and category slider cuts are stored in browser `localStorage` (`family-budget:runway-simulator:v1`).

Furthermore, the runway engine currently attempts an awkward, brittle browser-side read of the Offer Comparator's `localStorage` key to determine baseline income. Storing runway models in Supabase PostgreSQL enables cloud persistence across family devices, multiple named austerity scenarios (e.g. "Full Freeze with Suspended JDG" vs. "Moderate Austerity"), and a clean relational foreign key (`baseline_offer_revision_id`) referencing the active compensation package in `offer_revisions`.

## What Changes

- Create PostgreSQL relational tables in Supabase:
  - `runway_scenarios`: Stores statutory JDG posture (active/suspended/wakacje), tax regime, ZUS stage, health tier, accounting costs, Month-1 tax tail, capital pool safety floor, and an optional foreign key link to an `offer_revisions` record.
  - `runway_category_cuts`: Stores per-category austerity retention percentages and active toggles linked to each scenario.
- Add server-side data access in `src/server/runway/db.ts` and Server Actions for scenario CRUD.
- Adapt `RunwayRepository` to synchronize with Supabase while caching locally in `localStorage`.
- Automatically migrate legacy browser `localStorage` settings into the initial primary scenario on first load.
- Add a multi-scenario selector toolbar to the runway dashboard.

## Capabilities

### New Capabilities
<!-- None: This enhances the existing jdg-runway-simulator capability -->

### Modified Capabilities
- `jdg-runway-simulator`: Replace browser `localStorage` persistence with Supabase relational tables (`runway_scenarios` and `runway_category_cuts`), supporting multiple named scenarios per household, cloud sync across devices, and a relational link to active offer compensation.

## Impact

- **Database**: Adds migration `0004_runway_scenarios.sql` with foreign keys to `ext_categories` and `offer_revisions`.
- **Backend / APIs**: Adds `src/server/runway/db.ts` and route handlers at `/api/family-budget/runway/scenarios`.
- **Frontend**: Extends `src/app/(main)/dashboard/family-budget/runway/_components/` with scenario selection and updates `RunwayRepository` to sync with Supabase.
- **Dependencies**: Uses existing Supabase infrastructure; zero new dependencies.
