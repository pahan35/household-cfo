# Tasks

## 1. Database Schema & Migration

- [ ] 1.1 Create `supabase/migrations/0005_time_value_weekly_logs.sql` defining `time_value_profiles`, `time_value_goals`, and `time_value_weekly_logs` with unique constraints, check columns, and indexes, and verify valid syntax.

## 2. Server Data Layer & API

- [ ] 2.1 Implement `src/server/lifestyle/time-value-db.ts` providing typed interfaces and `SupabaseRestTimeValueStore` for profiles, goals, and weekly log CRUD.
- [ ] 2.2 Add unit tests in `src/server/lifestyle/__tests__/time-value-db.test.ts` verifying upsert semantics, log history queries, and goal updates.
- [ ] 2.3 Implement Server Actions or API route handler at `src/app/api/family-budget/time-value/route.ts` and verify authenticated endpoint responses.

## 3. Client Repository & Auto-Migration

- [ ] 3.1 Update `TimeValueRepository` in `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository.ts` to sync with Supabase while caching locally in `localStorage`.
- [ ] 3.2 Add auto-migration logic to seed Supabase with existing `localStorage` data if the database is initially empty.
- [ ] 3.3 Update `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/__tests__/time-value-repository.test.ts` to test cloud sync, two-player logs, and offline fallback.

## 4. UI Integration & Polish

- [ ] 4.1 Verify Sunday weekly check-in logging and personal goal updates in `TimeValueDashboard` across simulated browser reload.
- [ ] 4.2 Run static verification (`npm run verify`) and unit tests (`npm test`) to ensure TypeScript compliance and zero regressions.
