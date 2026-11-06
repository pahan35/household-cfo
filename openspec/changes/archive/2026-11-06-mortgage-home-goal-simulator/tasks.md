# Tasks: Mortgage & Home Goal Simulator

## 1. Domain Types, Calculation Engine & Unit Tests

- [x] 1.1 Create `mortgage-types.ts` defining property inputs, financing settings, ExternalProvider Goal milestones, overlap phases, and persistence schemas, and verify types compile with `npx tsc --noEmit`.
- [x] 1.2 Implement `mortgage-engine.ts` with pure calculation functions (`calculatePropertyAcquisition`, `calculateAmortization`, `calculateOverlapTimeline`, `auditSavingsPace`) and verify comprehensive unit tests in `mortgage-engine.test.ts` pass with `npx vitest run src/app/\(main\)/dashboard/family-budget/mortgage/_components/__tests__/mortgage-engine.test.ts`.
- [x] 1.3 Implement `mortgage-repository.ts` with versioned `localStorage` loading and saving, and verify default fallbacks and serialization work cleanly.

## 2. Card Components & ExternalProvider Goal Integration

- [x] 2.1 Build `property-acquisition-card.tsx` (apartment size/price, parking, storage, 0% PCC, notary/court fees, and renovation budget) and verify controls update acquisition totals.
- [x] 2.2 Build `mortgage-financing-card.tsx` (down payment selector, renovation mode toggle, interest rate, term, and installment schedule) and verify loan principal and day-1 cash calculations.
- [x] 2.3 Build `home-goal-tracker-card.tsx` with ExternalProvider Goal category picker, two-milestone progress bars (Signing vs Handover), savings pace audit against `/stat/ping` net cashflow, and upstream "Sync Target to ExternalProvider Goal" action via `/api/external-provider/Exchange/Ping`.
- [x] 2.4 Build `overlap-cashflow-card.tsx` showing the multi-phase timeline (construction grace period interest + rent, finishing peak overlap, and steady state) and verify tranche interest calculations.
- [x] 2.5 Build `budget-impact-card.tsx` showing pre- vs post-move-in cashflow (rent replaced by mortgage + admin fee), DTI gauge, and interest rate stress slider.

## 3. Page Assembly, Navigation & Validation

- [x] 3.1 Build `mortgage-dashboard.tsx` composing all cards with live ExternalProvider data fetching (`getCategories`, `getCurrencies`, `getBudgetSelection`) and create `src/app/(main)/dashboard/family-budget/mortgage/page.tsx`.
- [x] 3.2 Add the "Mortgage & Home Goal" navigation entry to `src/navigation/sidebar/sidebar-items.ts` under the Family Budget group and verify it renders in the sidebar.
- [x] 3.3 Run `npm run verify` (`biome check && tsc --noEmit`) and verify zero errors, lint warnings, or type mismatches.
