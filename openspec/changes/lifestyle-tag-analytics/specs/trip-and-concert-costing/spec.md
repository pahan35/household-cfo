# Spec Delta

## Purpose

Analyzes true total cost of ownership (TCO) for travels and concerts by detecting trip episodes via `#travel` / `#end-travel` bookends and time-gap clustering, attributing pre-trip bookings, surfacing untagged transactions inside a trip's date window for explicit user confirmation and upstream tag persistence, and distinguishing local concerts from out-of-town concert trips and concerts occurring inside a larger travel episode.

## ADDED Requirements

### Requirement: Travel episode detection and reused destination tag splitting
The Trips & Concerts analyzer (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL group travel transactions into distinct trip episodes using `#travel` and `#end-travel` bookend tags on transactions sharing a destination tag, or by splitting reused destination tags (e.g. `#Austria`, `#Malediwy`) into separate episodes when consecutive on-site clusters are separated by more than 60 days. Pre-trip bookings (flights, hotels, tickets tagged with the destination tag prior to `#travel`) SHALL be attributed to the upcoming episode for that destination.

#### Scenario: Reused destination tag split into separate trip episodes
- **WHEN** a destination tag such as `#Austria` appears on transactions across multiple years or separated by more than 60 days (or bounded by `#travel` and `#end-travel`)
- **THEN** the analyzer creates distinct chronological trip episodes (e.g. `Austria (Jul 2025)` and `Austria (Feb 2026)`) and attaches pre-trip bookings to their corresponding episode

### Requirement: Untagged window candidate discovery and explicit tag linking
For each detected trip episode with a `[startDate, endDate]` window, the analyzer SHALL scan for untagged expense transactions occurring within that date window, prioritize foreign-currency and travel-relevant category charges, and present them in an explicit confirmation checklist. The system SHALL NOT silently include untagged candidate transactions in the confirmed trip total until the user selects and confirms them, which SHALL persist the destination tag upstream via `updateTransactionTags`.

#### Scenario: Confirming and linking untagged transactions within a trip window
- **WHEN** an untagged transaction occurs between a trip's `#travel` start date and `#end-travel` end date and the user selects it in the "Untagged in Trip Window" review checklist and clicks "Link to Trip"
- **THEN** `updateTransactionTags` persists the trip's destination tag onto the transaction upstream and the transaction moves into the confirmed trip TCO breakdown

### Requirement: Concert event costing and trip-overlap attribution
The analyzer SHALL identify concert events via `#concert` paired with an artist/event tag, aggregate separate ticket purchases (e.g. 2 tickets bought on the same day or across pre-booking dates) into a single concert event, classify each concert as **Local (In-Town)**, **Out-of-Town Concert Trip**, or **Concert inside a Travel**, and provide a toggle between **Direct Concert Cost** (tickets + concert-day spend) and **With Allocated Trip Overhead** when a concert overlaps a broader travel episode without double-counting in grand totals.

#### Scenario: Viewing a concert occurring inside a broader travel episode
- **WHEN** a concert event (`#concert` + event tag) falls within the date window of a multi-day trip episode
- **THEN** the concert card displays both its Direct Concert Cost and its Trip-Overlap badge, and the overall Trips & Concerts summary avoids double-counting the shared travel transactions
