# Spec Delta

## Purpose

Provides unified client-side synchronization status indicators, non-destructive auto-replay of offline-created entities, and user-prompted conflict resolution across all family budget persistence stores.

## ADDED Requirements

### Requirement: Standardized cloud sync status presentation
The system SHALL provide a uniform visual `<CloudSyncBadge />` status indicator across all simulator toolbars and configuration dialogs (Mortgage, Runway, Offer Comparator, Time-Value Motivator, and Budget Exclusion Presets). The badge SHALL indicate one of four mutually exclusive states:
1. **Cloud Synced**: Rendered in emerald styling with a cloud icon indicating the local view matches the Supabase database.
2. **Syncing...**: Rendered with an animated spinner indicating an active remote fetch, mutation, or reconciliation replay is in flight.
3. **Local Cache**: Rendered in muted styling with an offline cloud icon indicating the screen is operating with local cache due to network unavailability or remote error.
4. **Conflict Detected**: Rendered in amber warning styling with an alert icon when divergent concurrent changes exist between local browser storage and the Supabase database.

#### Scenario: Displaying cloud synced status
- **WHEN** all local data is synchronized with Supabase without pending mutations or conflicts
- **THEN** the screen displays the "Cloud Synced" badge with an explanatory tooltip

#### Scenario: Displaying offline local cache status
- **WHEN** the browser is offline or remote API requests fail
- **THEN** the screen displays the "Local Cache" badge alerting the user that edits remain on this device

#### Scenario: Displaying syncing state
- **WHEN** a background synchronization, scenario creation, or reconciliation operation is actively executing
- **THEN** the badge transitions to "Syncing..." with an animated spinner

#### Scenario: Displaying conflict state
- **WHEN** a concurrent conflict is detected between local offline modifications and remote database records
- **THEN** the badge transitions to amber "Conflict Detected" and provides an interactive trigger for conflict resolution

### Requirement: Non-destructive auto-replay of offline entities
Upon establishing or regaining network connectivity, the system SHALL automatically detect any entity created offline with an offline temporary identifier (such as `offline-*`). The system SHALL replay the creation to the corresponding Supabase backend endpoint, obtain the server-assigned UUID, update the local cache and active entity pointers with the canonical UUID, and persist the synchronized state without clobbering or overwriting concurrent data.

#### Scenario: Auto-replaying offline created scenario on reconnect
- **WHEN** the user creates a new scenario while offline resulting in an `offline-*` ID, and the application subsequently connects to the network
- **THEN** the system automatically posts the scenario to Supabase, replaces the `offline-*` ID with the server UUID in local cache, and marks the state as Cloud Synced

### Requirement: User-prompted conflict resolution
When an existing entity is modified offline and the remote database is also concurrently updated with divergent values since the last synchronization timestamp, the system SHALL preserve both the local draft and remote state without silent overwriting. The system SHALL display an interactive conflict resolution modal or popover allowing the user to inspect the conflicting items and choose between:
1. **Keep Local (Push to Cloud)**: Overwrite the remote record with the browser's local state.
2. **Use Cloud (Discard Local)**: Overwrite the browser's local cache with the remote database state.

#### Scenario: Preserving local offline edits during remote conflict
- **WHEN** a user modifies a scenario offline, but a remote fetch reveals the cloud version was also updated by another device
- **THEN** the system halts silent local cache overwriting, displays the amber "Conflict Detected" badge, and presents the conflict resolution modal

#### Scenario: Resolving conflict by keeping local edits
- **WHEN** the user chooses "Keep Local (Push to Cloud)" in the conflict modal
- **THEN** the system writes the local changes to Supabase, updates the sync timestamp, and sets the badge to Cloud Synced

#### Scenario: Resolving conflict by accepting cloud version
- **WHEN** the user chooses "Use Cloud (Discard Local)" in the conflict modal
- **THEN** the system replaces the local cache with the remote database records, clears the conflict flag, and sets the badge to Cloud Synced
