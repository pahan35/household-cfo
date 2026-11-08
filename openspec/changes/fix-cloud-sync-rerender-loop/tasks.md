# Tasks

## 1. Stabilize `useCloudSyncState` Hook

- [ ] 1.1 Refactor `src/hooks/use-cloud-sync-state.ts` to store dynamic options in a ref, make all action functions referentially stable with `useCallback`, wrap online/offline listeners to prevent listener churn, and memoize the composite return value; verify with unit tests in `src/hooks/__tests__/use-cloud-sync-state.test.tsx`.
- [ ] 1.2 Add unit tests in `src/hooks/__tests__/use-cloud-sync-state.test.tsx` ensuring action handlers (`setSyncing`, `setSynced`, `setOffline`, etc.) retain reference equality across re-renders with inline callback props.

## 2. Decouple Dashboard Simulator Dependencies

- [ ] 2.1 Update `MortgageDashboard` in `src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-dashboard.tsx` to destructure stable action functions, remove `syncState` from `loadData`'s dependency array, and verify existing mortgage unit tests pass.
- [ ] 2.2 Update `RunwayDashboard` in `src/app/(main)/dashboard/family-budget/runway/_components/runway-dashboard.tsx` to destructure stable action functions, remove `syncState` from `loadData`'s dependency array, and verify existing runway unit tests pass.
- [ ] 2.3 Update `TimeValueDashboard` in `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-dashboard.tsx` to remove `syncState` from the mount `useEffect` dependency array, and verify existing time-value unit tests pass.
- [ ] 2.4 Update `OfferComparatorDashboard` in `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-comparator-dashboard.tsx` to remove `syncState` from the mount `useEffect` dependency array, and verify existing offer comparator unit tests pass.

## 3. Stabilize Preset Categories Matching & Full Verification

- [ ] 3.1 Optimize category pattern detection in `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` so structurally identical category lists do not trigger redundant remote preset synchronization; verify with `use-exclusion-presets.test.ts`.
- [ ] 3.2 Run full project validation (`npm run verify` and `npm test`) to confirm zero regressions, no TypeScript errors, and complete test suite passes.
