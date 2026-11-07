# Tasks

## 1. Database Schema & Migration

- [x] 1.1 Create `supabase/migrations/0003_offer_comparator_tracks.sql` defining `offer_tracks`, `offer_revisions`, and `offer_comparator_assumptions` tables with appropriate constraints, foreign keys, and indexes, and verify syntax.

## 2. Server Data Layer & API

- [x] 2.1 Implement `src/server/offers/db.ts` providing typed interfaces and `SupabaseRestOfferStore` for offer tracks, revisions, and global assumptions CRUD.
- [x] 2.2 Add unit tests in `src/server/offers/__tests__/db.test.ts` verifying relational serialization, revision cascading, and assumptions storage.
- [x] 2.3 Implement Server Actions or API route handler at `src/app/api/family-budget/offers/route.ts` and verify authenticated endpoint responses.

## 3. Client Repository & Auto-Migration

- [x] 3.1 Update `OfferRepository` in `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository.ts` to sync with Supabase while caching locally in `localStorage`.
- [x] 3.2 Add auto-migration logic to seed Supabase with existing `localStorage` data if the database is initially empty.
- [x] 3.3 Update `src/app/(main)/dashboard/family-budget/offer-comparator/_components/__tests__/offer-repository.test.ts` to test cloud sync, schema parsing, and offline fallback.

## 4. UI Integration & Verification

- [x] 4.1 Verify track creation, revision editing, and multi-track comparison in `OfferComparatorDashboard` across simulated browser reload.
- [x] 4.2 Run static verification (`npm run verify`) and unit tests (`npm test`) to ensure TypeScript compliance and zero regressions.
