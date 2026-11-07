# Spec Delta

## MODIFIED Requirements

### Requirement: LocalStorage offer repository with JSON export and import
The system SHALL persist all offer tracks, revisions, benefit templates, and global comparator settings in dedicated Supabase PostgreSQL relational tables (`offer_tracks`, `offer_revisions`, and `offer_comparator_assumptions`) for authenticated family users, with graceful client-side fallback and caching in browser `localStorage`. The system SHALL display the standardized `<CloudSyncBadge />` status indicator in the comparator header, automatically replay offline-created tracks on reconnect, and prevent silent local cache overwriting during concurrent conflicts. The system SHALL continue to provide one-click **Export JSON** and **Import JSON** actions with schema validation to back up or restore comparator state.

#### Scenario: Exporting and importing offer comparator state
- **WHEN** the user clicks "Export JSON" and later imports the downloaded JSON file via "Import JSON"
- **THEN** all offer tracks, historical revisions, tax profiles, benefit mappings, and global settings are validated and restored without data loss

#### Scenario: Restoring offer tracks from Supabase
- **WHEN** the user navigates to `/dashboard/family-budget/offer-comparator` while connected
- **THEN** the comparator loads all active, negotiating, and historical offer tracks and revisions from Supabase, synchronizes the local cache, and displays the Cloud Synced badge

#### Scenario: Relational revision saving and multi-device access
- **WHEN** the user adds a new revision or updates tax/PTO parameters on an offer track
- **THEN** the change is saved relationally in Supabase under `offer_revisions` and immediately reflects when opened on other family devices

#### Scenario: Offline and unauthenticated fallback
- **WHEN** the user navigates to `/dashboard/family-budget/offer-comparator` without an active network connection or database access
- **THEN** the comparator falls back to the locally cached state in browser `localStorage` and displays the Local Cache badge alerting the user that edits remain local
