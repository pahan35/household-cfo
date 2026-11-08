# Spec Delta

## ADDED Requirements

### Requirement: Service-layer cloud sync reconciliation
The system SHALL execute entity reconciliation and auto-replay logic within domain services accessible by both Web Server Actions and REST API synchronization endpoints. Client state updates and remote database writes during conflict resolution SHALL invoke the shared reconciliation service rather than coupling directly to specific HTTP route handlers.

#### Scenario: Reconciling conflicts through Server Actions or REST
- **WHEN** a conflict is resolved from either the web UI or an external synchronization sync call
- **THEN** the reconciliation service processes the choice (`keep_local` or `keep_remote`), updates the persistent store, and returns the reconciled state
