# Tasks

## 1. Database Schema & Migration

- [ ] 1.1 Create `supabase/migrations/0004_runway_scenarios.sql` defining `runway_scenarios` and `runway_category_cuts` with appropriate constraints, foreign key to `offer_revisions`, and indexes, and verify valid syntax.

## 2. Server Data Layer & API

- [ ] 2.1 Implement `src/server/runway/db.ts` providing typed interfaces and `SupabaseRestRunwayStore` for runway scenario and category cut CRUD.
- [ ] 2.2 Add unit tests in `src/server/runway/__tests__/db.test.ts` verifying scenario serialization, category cut cascading, and offer baseline linkage.
- [ ] 2.3 Implement Server Actions or API route handler at `src/app/api/family-budget/runway/scenarios/route.ts` and verify authenticated endpoint responses.

## 3. Client Repository & Auto-Migration

- [ ] 3.1 Update `RunwayRepository` in `src/app/(main)/dashboard/family-budget/runway/_components/runway-repository.ts` to sync with Supabase while caching locally in `localStorage`.
- [ ] 3.2 Add auto-migration logic to seed Supabase with existing `localStorage` data if the database is initially empty.
- [ ] 3.3 Update `src/app/(main)/dashboard/family-budget/runway/_components/__tests__/runway-repository.test.ts` to test cloud sync, multi-scenario loading, and offline fallback.

## 4. UI: Scenario Selector Toolbar & Polish

- [ ] 4.1 Implement `RunwayScenarioToolbar` providing scenario switching, creation, duplication, and deletion in `RunwayDashboard`.
- [ ] 4.2 Verify interactive category cut adjustments and multi-scenario switching across simulated browser reload.
- [ ] 4.3 Run static verification (`npm run verify`) and unit tests (`npm test`) to ensure TypeScript compliance and zero regressions.
