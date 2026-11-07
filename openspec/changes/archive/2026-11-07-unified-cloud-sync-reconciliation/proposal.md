# Proposal

## Why

Since commit `c36f0a47`, user-entered simulator plans and configuration presets (Mortgage, Runway, Job Offer Comparator, Time-Value Motivator, and Budget Exclusion Presets) are persisted in Supabase relational tables with client-side `localStorage` caching. However, the UI presentation of cloud sync status is inconsistent—only Mortgage and Runway show status badges, while the other three silently omit them.

More critically, when a user edits data offline or opens a browser containing local-only data while the remote database is already populated, the next successful remote fetch unconditionally overwrites `localStorage` with remote rows. This causes silent data loss of offline scenarios and edits without any conflict warning or opportunity to merge.

## What Changes

- Introduce a standardized `<CloudSyncBadge />` status indicator across all 5 user-data domains (Mortgage, Runway, Offer Comparator, Time-Value Motivator, and Budget Presets) displaying `Cloud Synced` (emerald), `Syncing...` (animated), `Local Cache` (muted), and `Conflict Detected` (amber).
- Implement a shared client-side synchronization and reconciliation engine (`useCloudSyncState` and reconciliation helper).
- **Auto-Replay / Non-destructive Merge (Default)**: On reconnection, automatically detect locally created records (e.g. `offline-*` scenario IDs) and non-conflicting local updates, push them to Supabase, update local cache with server IDs, and transition to `Cloud Synced`.
- **User-Prompted Sync (Fallback on Conflict)**: When concurrent, conflicting modifications are detected (both remote and local modified with divergent values), flag the conflict via the amber badge and present an interactive resolution popover/dialog allowing the user to choose `[Keep Local (Push to Cloud)]` or `[Use Cloud (Discard Local)]`.
- Refactor all 5 domain repositories and UI dashboards to adopt the unified sync contract.

## Capabilities

### New Capabilities
- `cloud-sync-reconciliation`: Cross-cutting client-side synchronization, auto-replay merge for offline-created data, conflict detection, and uniform UI cloud sync status presentation across family budget simulators and configuration stores.

### Modified Capabilities
- `mortgage-home-goal-simulator`: Update persistence requirement to mandate non-destructive auto-replay of offline scenarios and user-prompted conflict handling.
- `jdg-runway-simulator`: Update persistence requirement to mandate non-destructive auto-replay of offline scenarios and user-prompted conflict handling.
- `job-offer-comparator`: Add explicit cloud sync status badge and non-destructive reconciliation to offer comparator persistence.
- `time-value-motivator`: Add explicit cloud sync status badge and non-destructive reconciliation to time-value persistence.
- `expense-customization`: Add explicit cloud sync status badge and non-destructive reconciliation to exclusion presets dialog.

## Impact

- Shared components: `src/components/cloud-sync-badge.tsx`, `src/hooks/use-cloud-sync-state.ts`, `src/lib/cloud-sync-reconciler.ts`.
- Domain repositories & dashboards:
  - Mortgage: `src/app/(main)/dashboard/family-budget/mortgage/_components/`
  - Runway: `src/app/(main)/dashboard/family-budget/runway/_components/`
  - Offer Comparator: `src/app/(main)/dashboard/family-budget/offer-comparator/_components/`
  - Time-Value: `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/`
  - Presets: `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts`, `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx`
- Unit tests: comprehensive test suites verifying auto-replay, conflict detection, and user resolution.
