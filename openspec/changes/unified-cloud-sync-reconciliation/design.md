# Design

## Context

Five user-facing simulators and configuration stores persist data to Supabase with browser `localStorage` fallbacks (see `proposal.md` - Why). Currently, each module manages its own sync state independently, resulting in fragmented UI indicators and dangerous silent overwrites of local offline changes when reconnecting.

## Goals / Non-Goals

**Goals:**
- Provide a reusable, domain-agnostic synchronization state hook (`useCloudSyncState`) and reconciliation engine (`cloud-sync-reconciler.ts`).
- Standardize the visual UI indicator with `<CloudSyncBadge />` supporting four states: `synced`, `syncing`, `offline`, and `conflict`.
- Automatically replay non-destructive creations (`offline-*` IDs) and unconflicted updates to Supabase on reconnection.
- Safely halt silent local overwriting when concurrent conflicting edits exist, presenting `<CloudConflictDialog />` for user resolution.
- Adopt this unified contract across all 5 user-data persistence modules.

**Non-Goals:**
- Full CRDT / operational transform field-level merging (last-write-wins per entity with user prompt on conflict is appropriate for family budget scenarios).
- Background ServiceWorker offline push (standard window `online` listeners, tab focus hooks, and repository mutation callbacks are sufficient).
- Database schema changes (existing Supabase tables and `/api/family-budget/*` REST routes already support all required CRUD operations).

## Decisions

### 1. Unified Sync State Machine

```
              [ Mount / Page Load ]
                         |
                         v
                    ( Syncing ) <------------------------+
                     /       \                           |
         Fetch Success       Network Failure             |
                 /             \                         |
     ( Evaluate State )      ( Offline / Local Cache )   | Reconnect /
           /      \                                      | Retry Mutation
  No Conflict    Conflict Detected                       |
       /              \                                  |
( Cloud Synced )   ( Conflict Detected )                 |
                          |                              |
                  User Resolves Conflict ----------------+
```

Status type definition:
```typescript
export type CloudSyncStatus = "synced" | "syncing" | "offline" | "conflict";

export interface ConflictRecord<T = unknown> {
  entityId: string;
  entityName: string;
  localVersion: T;
  remoteVersion: T;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}
```

### 2. Reconciliation Engine Algorithm (`cloud-sync-reconciler.ts`)

When remote records are received after an offline period:
1. **Partition Local Entities**:
   - **Offline Created**: Items with `id.startsWith("offline-")`.
   - **Existing Items**: Items with matching remote IDs.
   - **Deleted Offline**: Tracked in an optional lightweight tombstone set or inferred.
2. **Auto-Replay Creations**:
   - For each `offline-*` entity, execute the domain's remote create call (`POST`).
   - Replace the `offline-*` temporary ID in `localStorage` and active entity selector with the returned server UUID.
3. **Conflict Detection for Existing Items**:
   - If `remote.updatedAt > lastSyncedAt` AND `local.updatedAt > lastSyncedAt` AND `hash(local) !== hash(remote)`:
     - Mark entity as conflicting.
     - Do NOT overwrite local cache with remote.
     - Transition status to `"conflict"` and populate `ConflictRecord`.
4. **Clean Merge / LWW for Non-Conflicted Items**:
   - If only remote was modified: update local cache with remote.
   - If only local was modified: auto-upload local to remote (`PATCH`).
   - If identical: mark clean.

*Alternative considered: Blind Last-Write-Wins (LWW) without conflict dialog.*
*Rejected because clock skew across devices or forgotten offline tabs could silently destroy hours of mortgage/runway scenario tuning.*

### 3. Reusable UI Components

* `<CloudSyncBadge status={status} onResolveConflict={...} />`:
  - `synced`: Emerald Cloud icon, text "Cloud Synced", tooltip "Synchronized with Supabase Cloud".
  - `syncing`: Blue spinning RotateCw icon, text "Syncing...".
  - `offline`: Muted CloudOff icon, text "Local Cache", tooltip "Operating offline. Edits are saved locally.".
  - `conflict`: Amber AlertTriangle icon, text "Conflict (N)", opens `<CloudConflictDialog />`.
* `<CloudConflictDialog />`:
  - Displays side-by-side or stacked diff summary of the conflicting scenario/configuration.
  - Action buttons:
    - `Keep Local Changes`: pushes browser state to Supabase, resolving conflict.
    - `Accept Cloud Version`: pulls Supabase state to browser, discarding local changes.

### 4. Domain Integration Points

| Domain | UI Placement | Repository Binding |
|---|---|---|
| **Mortgage Simulator** | `MortgageScenarioToolbar` | `MortgageRepository` |
| **Runway Simulator** | `RunwayScenarioToolbar` | `RunwayRepository` |
| **Offer Comparator** | Header toolbar / `GlobalAssumptionsBar` | `LocalStorageOfferRepository` |
| **Time-Value Motivator** | Header tabs / reflection header | `TimeValueRepository` |
| **Budget Exclusion Presets** | `PresetDialog` header | `useExclusionPresets` |

## Risks / Trade-offs

- **[Risk] Multiple offline scenarios created concurrently**:
  - *Mitigation*: Reconciler replays creations sequentially via `Promise.all` or sequential batch, cleanly updating local ID references.
- **[Risk] Deep object equality performance**:
  - *Mitigation*: Scenario configs are compact (< 10 KB). Fast stable JSON serialization (`fast-json-stable-stringify` or deterministic key sorting) provides fast O(N) equality checks without CPU strain.
- **[Risk] Dialog disruption**:
  - *Mitigation*: Conflicts are non-blocking modal dialogs or popovers triggered directly from the amber badge; the user can continue viewing their current data without jarring page blocks.
