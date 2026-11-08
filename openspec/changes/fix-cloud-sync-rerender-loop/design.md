# Design

## Context

Commit `ad06945a` introduced `useCloudSyncState` across four simulators: Mortgage, Runway, Time-Value Motivator, and Offer Comparator. The hook returns a composite object containing reactive state (`status`, `conflicts`, `activeConflict`, `lastSyncedAt`) alongside action methods (`setSyncing`, `setSynced`, `setOffline`, `setConflictDetected`, `resolveConflict`, `clearConflicts`, `selectConflict`).

Currently, `useCloudSyncState` does not memoize its return object. Furthermore, handlers like `setSynced` and `resolveConflict` recreate callbacks when options (`storageSyncKey`, `onConflictResolved`) change, which happens on every render when options are passed as object literals. Consuming components (`mortgage-dashboard.tsx`, `runway-dashboard.tsx`, `time-value-dashboard.tsx`, `offer-comparator-dashboard.tsx`) included `syncState` in their `useCallback` or `useEffect` dependency arrays, causing a cyclic re-render and re-fetch loop whenever sync status transitions occur.

See `proposal.md` for background motivation.

## Goals / Non-Goals

**Goals:**
- Eliminate the infinite re-render and re-fetch loop across all four family budget simulators.
- Guarantee that all action methods returned by `useCloudSyncState` are referentially stable across re-renders.
- Ensure window event listeners in `useCloudSyncState` are registered once and not repeatedly unbound and rebound.
- Memoize the composite return value of `useCloudSyncState` so identity remains unchanged when state is unchanged.
- Update `MortgageDashboard`, `RunwayDashboard`, `TimeValueDashboard`, and `OfferComparatorDashboard` to eliminate reactive sync state dependencies from data fetching and mount effects.
- Stabilize pattern matching in `useExclusionPresets` so identical category lists do not trigger redundant remote sync requests.

**Non-Goals:**
- Altering the underlying reconciliation logic or conflict resolution schemas defined in `cloud-sync-reconciler.ts`.
- Changing the visual presentation or UI behavior of `<CloudSyncBadge />`.
- Rewriting simulator calculation engines or repository contracts.

## Decisions

### 1. Ref-Stabilize Options in `useCloudSyncState`
- **Decision**: Store the incoming `options` object in a `useRef` updated during render (`optionsRef.current = options`).
- **Rationale**: Consumers frequently pass inline options (e.g. `onConflictResolved: async (...) => { ... }`). By accessing callbacks and configuration properties through the ref, all hook action functions (`setSynced`, `resolveConflict`, `onReconnect`) can be wrapped in `useCallback` with empty `[]` dependencies, making their function references 100% stable.
- **Alternatives Considered**:
  - Requiring callers to `useCallback` all props: Fragile and easy for developers to accidentally omit, leading to regression.
  - Splitting the hook into separate `useCloudSyncState` and `useCloudSyncActions`: More verbose API for consumers.

### 2. Memoize the Composite Return Value
- **Decision**: Wrap the object returned by `useCloudSyncState` in `useMemo` depending on `[state, stableActions...]`.
- **Rationale**: If the internal `state` (`status`, `conflicts`, `activeConflict`, `lastSyncedAt`) has not changed, the returned object reference remains identical, preventing child component re-renders.

### 3. Decouple Effect Dependencies in Simulators
- **Decision**:
  - In `MortgageDashboard` and `RunwayDashboard`: Destructure stable action methods (`setSyncing`, `setSynced`, `setOffline`, `setConflictDetected`) and include only those stable action functions in `loadData`'s dependency list. Never put `syncState` in `loadData` or `useEffect`.
  - In `TimeValueDashboard`: Isolate cloud synchronization inside a mount effect with `[]` or stable repository instances, invoking action functions via stable references.
  - In `OfferComparatorDashboard`: Run `initRepo` on mount (`[]` dependency array) rather than depending on `syncState`.
- **Rationale**: A `useEffect` that triggers an asynchronous state update must NEVER depend on the state it updates; doing so produces a classic circular dependency loop.

### 4. Category Key Signature in `useExclusionPresets`
- **Decision**: Derive `detectedTaxCategoryIds` and `detectedRentCategoryIds` by caching the joined list of category IDs/names or comparing previous sets, preventing new array references when category content is identical.
- **Rationale**: Prevents background sync in `useExclusionPresets` from re-firing if a parent component updates its categories array with equivalent contents.

## Risks / Trade-offs

- **[Risk]** Consuming components might rely on `options.onConflictResolved` capturing state from previous renders if not carefully handled.
  → **Mitigation**: `optionsRef.current` is updated synchronously on every render, ensuring any invocation of `resolveConflict` always calls the latest closure provided by the component.
- **[Risk]** Stale closures if `resolveConflict` references outdated conflict list.
  → **Mitigation**: Use functional state updates or read directly from the latest state inside the handler.
