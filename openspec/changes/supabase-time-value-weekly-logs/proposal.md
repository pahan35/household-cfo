# Proposal: Supabase Relational Time-Value Profiles & Weekly Logs

## Why

The Time & Opportunity Motivator (`/dashboard/family-budget/lifestyle/time-value`) provides an empathetic, cooperative financial and screen-time framework explicitly designed for two distinct household partners: `me` (primary player) and `wife` (spouse player). Currently, both partner profiles, personal goals, family pet projects, and chronological weekly check-in reflections are stored in a single browser's `localStorage` (`family-budget:time-value-motivator:v1`).

Having collaborative two-player weekly logs trapped on one device prevents spouses from recording their Sunday reflections from their own devices (e.g. mobile phones) and risks losing valuable long-term habit reflection data if browser storage is cleared. Migrating this data to Supabase PostgreSQL unlocks seamless multi-device partner collaboration, permanent time-series retention of weekly logs, and future SQL queries analyzing drift reduction and side-hustle monetization trends over time.

## What Changes

- Create PostgreSQL relational tables in Supabase:
  - `time_value_profiles`: Stores profile baselines, hours, and opportunity configurations for `me` and `wife`.
  - `time_value_goals`: Stores personal and shared wishlist reward goals with completion progress and owner scope.
  - `time_value_weekly_logs`: A time-series log recording weekly screen time, drift vs. joy hours, partner care, hours reallocated to side-hustles or learning, spousal bounties earned, and personal reflections.
- Add server-side data access in `src/server/lifestyle/time-value-db.ts` and Server Actions for profile, goal, and weekly log CRUD.
- Adapt `TimeValueRepository` to sync with Supabase while caching locally in `localStorage`.
- Automatically migrate existing `localStorage` state into Supabase on first launch if the database is unpopulated.

## Capabilities

### New Capabilities
<!-- None: This enhances the existing time-value-motivator capability -->

### Modified Capabilities
- `time-value-motivator`: Replace single-browser `localStorage` persistence with Supabase relational tables (`time_value_profiles`, `time_value_goals`, and `time_value_weekly_logs`), enabling multi-device partner logging and permanent time-series habit analysis.

## Impact

- **Database**: Adds migration `0005_time_value_weekly_logs.sql` with unique constraint on `(player, week_start_date)` and chronological indexes.
- **Backend / APIs**: Adds `src/server/lifestyle/time-value-db.ts` and route handlers at `/api/family-budget/time-value`.
- **Frontend**: Adapts `TimeValueRepository` in `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository.ts` to sync with Supabase.
- **Dependencies**: Uses existing Supabase REST / database client infrastructure; zero new dependencies.
