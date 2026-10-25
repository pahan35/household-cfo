# Spec Delta

## MODIFIED Requirements

### Requirement: Travel episode detection and reused destination tag splitting

The Trips & Concerts analyzer (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL group travel transactions into distinct trip episodes using `#travel` and `#end-travel` bookend tags on transactions sharing a destination tag, or by splitting reused destination tags (e.g. `#Austria`, `#Malediwy`) into separate episodes when consecutive on-site clusters are separated by more than 60 days. Pre-trip bookings (flights, hotels, tickets tagged with the destination tag prior to `#travel`) SHALL be attributed to the upcoming episode for that destination.

All transaction date calculations, cluster sorting, and episode formatting SHALL reliably decode upstream timestamps in .NET ticks, Unix milliseconds, Unix seconds, or ISO 8601 strings into valid dates and SHALL NOT throw runtime invalid time value errors.

#### Scenario: Reused destination tag split into separate trip episodes

- **WHEN** a destination tag such as `#Austria` appears on transactions across multiple years or separated by more than 60 days (or bounded by `#travel` and `#end-travel`)
- **THEN** the analyzer creates distinct chronological trip episodes (e.g. `Austria (Jul 2025)` and `Austria (Feb 2026)`) and attaches pre-trip bookings to their corresponding episode

#### Scenario: Upstream transactions with .NET ticks formatted without errors

- **WHEN** travel transactions provide timestamps as .NET ticks (values exceeding $10^{16}$)
- **THEN** the analyzer decodes them to valid calendar dates and formats episode names (e.g. `Rome (Oct 2024)`) and episode ranges without runtime errors
