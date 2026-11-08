# Proposal

## Why

Following the unified cloud sync reconciliation refactoring in commit `ad06945a`, simulator screens (Mortgage, Runway, Time-Value Motivator, and Offer Comparator) began experiencing high CPU utilization caused by an infinite asynchronous re-render and re-fetch loop. This occurred because `useCloudSyncState` returned an unmemoized composite object containing state and action handlers; when dashboards included this object in `useCallback` or `useEffect` dependency arrays while calling its state setters within those same effects, continuous render cycles and network thrashing were triggered.

## What Changes

- **Stabilize `useCloudSyncState` Hook**:
  - Store dynamic options (`storageSyncKey`, `storage`, `onReconnect`, `onConflictResolved`) in internal React refs so callback identities remain referentially stable across renders.
  - Ensure action dispatchers (`setSyncing`, `setSynced`, `setOffline`, `setConflictDetected`, `resolveConflict`, `clearConflicts`, `selectConflict`) have stable references using functional state updaters and ref lookups.
  - Memoize the returned hook composite object with `useMemo` so the reference identity only updates when actual state (`status`, `conflicts`, `activeConflict`, `lastSyncedAt`) changes.
  - Prevent window online/offline listeners from tearing down and re-attaching on every render.
- **Decouple Dashboard Effect Dependencies**:
  - In `MortgageDashboard` and `RunwayDashboard`, destructure stable action functions and remove reactive composite sync state from `loadData`'s dependency array.
  - In `TimeValueDashboard` and `OfferComparatorDashboard`, remove `syncState` from mount `useEffect` dependency arrays.
- **Stabilize Category Pattern Detection in `useExclusionPresets`**:
  - Memoize category ID extraction by category list signature so re-renders with structurally identical categories do not trigger redundant remote preset synchronization.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `cloud-sync-reconciliation`: Add requirements for client-side synchronization hook referential stability and prevention of re-render loops across consuming simulators.

## Impact

- Affected source files:
  - `src/hooks/use-cloud-sync-state.ts`
  - `src/hooks/__tests__/use-cloud-sync-state.test.tsx`
  - `src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/runway/_components/runway-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-comparator-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts`
- Eliminates 100% CPU lockup, cancels endless loops of aborted requests to ExternalProvider and Supabase endpoints, and restores seamless simulator performance.
