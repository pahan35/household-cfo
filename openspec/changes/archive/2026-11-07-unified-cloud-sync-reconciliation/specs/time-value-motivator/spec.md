# Spec Delta

## MODIFIED Requirements

### Requirement: LocalStorage persistence with JSON export and import
The system SHALL persist all dual-player profile configurations, opportunity presets, custom personal goals, and weekly check-in logs in dedicated Supabase PostgreSQL relational tables (`time_value_profiles`, `time_value_goals`, and `time_value_weekly_logs`) for authenticated family users, with graceful client-side fallback/caching in browser `localStorage`. The system SHALL display the standardized `<CloudSyncBadge />` status indicator on the dashboard header, automatically replay offline-created weekly check-ins on reconnect, and prevent silent local cache overwriting during concurrent conflicts. The system SHALL continue to provide **Export JSON** and **Import JSON** actions with schema validation for portable offline backups.

#### Scenario: Exporting and restoring Time & Opportunity Motivator state
- **WHEN** the user logs weekly check-in entries, customizes pet-project parameters, exports the state to JSON, and later imports that JSON file
- **THEN** all dual-player settings, weekly reflection logs, and personal goals are restored accurately without data loss

#### Scenario: Restoring dual-player profiles and weekly logs from Supabase
- **WHEN** either partner opens `/dashboard/family-budget/lifestyle/time-value` while connected
- **THEN** the system retrieves both `me` and `wife` player profiles, active personal goals, and chronological weekly check-in history from Supabase, synchronizes the local cache, and displays the Cloud Synced badge

#### Scenario: Logging a collaborative weekly check-in across devices
- **WHEN** the spouse logs a Sunday check-in on her phone recording joy vs. drift hours, care celebration, and earned project bounties
- **THEN** the entry is saved to `time_value_weekly_logs` in Supabase and immediately appears on the desktop dashboard and goal progress bars

#### Scenario: Offline and unauthenticated localStorage fallback
- **WHEN** a user opens the Time & Opportunity Motivator without network access
- **THEN** the screen falls back to the locally cached state in browser `localStorage` and displays the Local Cache badge alerting the user that changes are saved locally
