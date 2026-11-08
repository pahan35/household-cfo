# Spec Delta

## ADDED Requirements

### Requirement: Referential stability of client-side sync state actions
The client-side synchronization hook (`useCloudSyncState`) SHALL provide referentially stable action functions (`setSyncing`, `setSynced`, `setOffline`, `setConflictDetected`, `resolveConflict`, `clearConflicts`, and `selectConflict`) whose function identities remain identical across component re-renders regardless of options object re-instantiation. The composite object returned by the hook SHALL be memoized such that consuming components in simulator toolbars and dashboards do not trigger infinite re-render loops or repeated network fetches when tracking synchronization state.

#### Scenario: Consuming sync state actions in effect or callback dependencies
- **WHEN** a simulator dashboard uses `setSyncing`, `setSynced`, `setOffline`, or `setConflictDetected` inside data loading routines
- **THEN** dispatching these action functions updates the hook's status without altering the identity of the action functions, preventing repeated execution of dependency-bound callbacks or effects

#### Scenario: Re-rendering with inline option handlers
- **WHEN** a component renders `useCloudSyncState` with inline callback props such as `onConflictResolved` or `onReconnect`
- **THEN** re-rendering the parent component does not tear down or re-register window event listeners, nor does it recreate the hook's action dispatchers
