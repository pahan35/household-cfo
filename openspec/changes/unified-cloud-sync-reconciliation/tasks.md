# Tasks

## 1. Shared Synchronization Engine & UI Primitives

- [ ] 1.1 Implement generic reconciliation utility in `src/lib/cloud-sync-reconciler.ts` handling offline ID auto-replay, clean merge, and conflict detection; verify with comprehensive unit tests in `src/lib/__tests__/cloud-sync-reconciler.test.ts`.
- [ ] 1.2 Implement `useCloudSyncState` hook in `src/hooks/use-cloud-sync-state.ts` providing standard status transitions (`synced`, `syncing`, `offline`, `conflict`), online/offline event listeners, and conflict resolution handlers; verify with unit tests in `src/hooks/__tests__/use-cloud-sync-state.test.ts`.
- [ ] 1.3 Implement `<CloudSyncBadge />` and `<CloudConflictDialog />` in `src/components/cloud-sync-badge.tsx` supporting status icons, tooltips, and interactive conflict resolution choices (`Keep Local` vs `Use Cloud`); verify component rendering via test.

## 2. Mortgage & Runway Simulators Integration

- [ ] 2.1 Update `MortgageRepository` in `src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-repository.ts` to integrate the reconciler, auto-replaying `offline-*` scenarios on reconnect and preventing silent overwrites on conflict; verify with updated repository tests.
- [ ] 2.2 Refactor `MortgageScenarioToolbar` to use `<CloudSyncBadge />` and bind conflict resolution; verify by running mortgage toolbar tests.
- [ ] 2.3 Update `RunwayRepository` in `src/app/(main)/dashboard/family-budget/runway/_components/runway-repository.ts` to integrate the reconciler, auto-replaying `offline-*` scenarios on reconnect and preventing silent overwrites; verify with updated repository tests.
- [ ] 2.4 Refactor `RunwayScenarioToolbar` to use `<CloudSyncBadge />` and bind conflict resolution; verify by running runway toolbar tests.

## 3. Offer Comparator & Time-Value Motivator Integration

- [ ] 3.1 Update `LocalStorageOfferRepository` in `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository.ts` to track sync status, auto-replay offline tracks, and detect conflicts; verify with offer repository tests.
- [ ] 3.2 Add `<CloudSyncBadge />` to `OfferComparatorDashboard` header/toolbar with conflict resolution handlers; verify in `offer-comparator-dashboard.tsx`.
- [ ] 3.3 Update `TimeValueRepository` in `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository.ts` to integrate auto-replay for offline weekly logs/profiles and conflict detection; verify with time-value repository tests.
- [ ] 3.4 Add `<CloudSyncBadge />` to `TimeValueDashboard` header with conflict resolution handlers; verify in `time-value-dashboard.tsx`.

## 4. Budget Exclusion Presets Integration

- [ ] 4.1 Update `useExclusionPresets` in `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` to adopt the reconciler for custom presets and category exclusions without silent cache wipe; verify with `use-exclusion-presets.test.ts`.
- [ ] 4.2 Embed `<CloudSyncBadge />` into `PresetDialog` header in `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx` and bind conflict resolution; verify with preset dialog tests.

## 5. Verification & Validation

- [ ] 5.1 Run full project test suite (`npm test`) to verify all unit, integration, and repository tests pass.
- [ ] 5.2 Run static validation (`npm run verify`) to ensure zero Biome formatting/lint issues and full TypeScript type checks across all modified files.
