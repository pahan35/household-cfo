# Tasks

## 1. Database Schema & Migration

- [ ] 1.1 Create `supabase/migrations/0002_mortgage_scenarios.sql` defining `mortgage_scenarios` with typed relational columns, default values, and indexes, and verify valid PostgreSQL syntax.

## 2. Server Data Layer & API

- [ ] 2.1 Implement `src/server/mortgage/db.ts` providing typed `MortgageScenario` interfaces, `MortgageStore` abstraction, and `SupabaseRestMortgageStore` for scenario CRUD (list, get, create, update, delete, setPrimary).
- [ ] 2.2 Add unit tests in `src/server/mortgage/__tests__/db.test.ts` to verify scenario serialization, column mappings, and primary scenario designation logic.
- [ ] 2.3 Implement Server Actions or API route handler at `src/app/api/family-budget/mortgage/scenarios/route.ts` and verify authenticated endpoint CRUD responses.

## 3. Client Repository & Auto-Migration

- [ ] 3.1 Update `MortgageRepository` in `src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-repository.ts` to support asynchronous multi-scenario synchronization with Supabase while keeping `localStorage` as an immediate offline cache.
- [ ] 3.2 Implement auto-migration logic so that existing user settings in `localStorage` are automatically seeded as the initial "Primary Plan" in Supabase on first run if the database is empty.
- [ ] 3.3 Update `src/app/(main)/dashboard/family-budget/mortgage/_components/__tests__/mortgage-repository.test.ts` with unit tests for multi-scenario retrieval, cloud sync, and offline fallback.

## 4. UI: Scenario Toolbar & Comparison Matrix

- [ ] 4.1 Implement `MortgageScenarioToolbar` in `src/app/(main)/dashboard/family-budget/mortgage/_components/` providing a scenario dropdown, "New Scenario", "Duplicate", "Rename", and "Delete" actions.
- [ ] 4.2 Implement `MortgageScenarioComparisonDialog` providing side-by-side card and table comparison between selected scenarios with acquisition cost, down payment, monthly payment, and timeline deltas computed via `mortgage-engine.ts`.
- [ ] 4.3 Integrate `MortgageScenarioToolbar` and comparison trigger into `MortgageDashboard` (`mortgage-dashboard.tsx`) and verify seamless switching and state persistence across page refreshes.

## 5. Verification & Polish

- [ ] 5.1 Run static analysis and tests (`npm run verify` and `npm test`) to verify type safety, linting, formatting, and test suites pass cleanly.
