# Proposal: Supabase Relational Mortgage Scenarios

## Why

Currently, the Mortgage & Home Goal Simulator stores all apartment acquisition parameters, financing terms, overlap timelines, and goal-tracking configurations in the user's browser `localStorage` (`family-budget:mortgage-simulator:v1`). Because home purchase planning is a high-stakes, collaborative household decision, storing this data in a single browser creates severe friction: planning scenarios cannot be viewed or updated across family devices (e.g. mobile vs. desktop or partner's laptop), data is vulnerable to Safari ITP eviction or browser cache clearing, and users cannot save and compare multiple prospective properties (e.g. "Mokotów 75m² Developer Finish" vs. "Wola 68m² Ready to Move").

Migrating mortgage configurations to a dedicated relational table in Supabase PostgreSQL enables multi-device cloud synchronization, permanent data retention, multiple named scenarios with primary scenario designation, and side-by-side scenario matrix comparison.

## What Changes

- Create a new relational PostgreSQL table `mortgage_scenarios` in Supabase with explicit numeric and boolean columns for all property, financing, overlap, and goal-tracking parameters.
- Provide server-side repository and Server Actions / API routes (`/api/family-budget/mortgage/scenarios`) for CRUD operations: listing scenarios, creating new scenarios, updating existing scenarios, duplicating scenarios, marking a primary scenario, and deleting scenarios.
- Add a multi-scenario selector toolbar and side-by-side scenario comparison sheet/dialog to the Mortgage & Home Goal dashboard (`/dashboard/family-budget/mortgage`).
- Update `MortgageRepository` on the client to read and write to Supabase when authenticated, with graceful fallback to browser `localStorage` when offline or in restricted environments.
- Automatically seed or migrate any existing browser `localStorage` configuration into the user's default Supabase scenario upon first load.

## Capabilities

### New Capabilities
<!-- None: This enhances the existing mortgage-home-goal-simulator capability -->

### Modified Capabilities
- `mortgage-home-goal-simulator`: Replace single-scenario browser `localStorage` persistence with Supabase relational `mortgage_scenarios` persistence, supporting multiple named scenarios per household, primary scenario selection, cloud synchronization across family devices, and side-by-side property comparison.

## Impact

- **Database**: Adds migration `0002_mortgage_scenarios.sql` creating table `mortgage_scenarios` with indexes on `is_primary` and `updated_at`.
- **Backend / APIs**: Adds `src/server/mortgage/db.ts` and Next.js server actions / route handlers for scenario mutations.
- **Frontend**: Extends `src/app/(main)/dashboard/family-budget/mortgage/_components/` with scenario switcher, comparison matrix drawer/card, and adapts `MortgageRepository` to sync with Supabase.
- **Dependencies**: Uses existing Supabase REST / database client infrastructure; zero new npm packages needed.
