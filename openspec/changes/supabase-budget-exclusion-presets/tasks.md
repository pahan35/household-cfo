# Tasks

## 1. Database Schema & Migration

- [ ] 1.1 Create `supabase/migrations/0006_budget_exclusion_presets.sql` defining `budget_exclusion_presets` with `TEXT[]` arrays, active preset indexing, and timestamps, and verify valid syntax.

## 2. Server Data Layer & API

- [ ] 2.1 Implement `src/server/presets/db.ts` providing typed interfaces and `SupabaseRestPresetStore` for preset CRUD and active preset updates.
- [ ] 2.2 Add unit tests in `src/server/presets/__tests__/db.test.ts` verifying default preset seeding, category array serialization, and active toggle logic.
- [ ] 2.3 Implement Server Actions or API route handler at `src/app/api/family-budget/presets/route.ts` and verify authenticated endpoint responses.

## 3. Client Hook & Auto-Migration

- [ ] 3.1 Update `use-exclusion-presets.ts` hook in `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` to sync with Supabase while caching locally in `localStorage`.
- [ ] 3.2 Add auto-migration logic to seed Supabase with existing `localStorage` presets if the database table is initially empty.
- [ ] 3.3 Update `src/app/(main)/dashboard/family-budget/_components/__tests__/use-exclusion-presets.test.ts` to verify cloud synchronization and offline fallback.

## 4. UI Verification & Polish

- [ ] 4.1 Verify that switching presets and editing category exclusions in the Preset Dialog updates both local and remote state across simulated browser reload.
- [ ] 4.2 Run static verification (`npm run verify`) and unit tests (`npm test`) to ensure TypeScript compliance and zero regressions.
