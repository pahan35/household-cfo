# trip-and-concert-costing Specification

## Purpose

Analyzes true total cost of ownership (TCO) for travels and concerts by detecting trip episodes via `#travel` / `#end-travel` bookends and time-gap clustering, attributing pre-trip bookings, surfacing untagged transactions inside a trip's date window for explicit user confirmation and upstream tag persistence, and distinguishing local concerts from out-of-town concert trips and concerts occurring inside a larger travel episode.

## Requirements

### Requirement: Travel episode detection and reused destination tag splitting

The Trips & Concerts analyzer (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL detect travel episodes by identifying valid travel destination tags and grouping their transactions into distinct chronological trips. The analyzer SHALL:

1. Exclude reserved non-travel tags (including `subscription`, `sub`, `tax`, `zus`, `vat-7`, `vat`, `ppe`, `salary`, `transfer`, `cash`, `refund`, `wc`) and non-travel categories (`Tax`, `Utility`, `Housing`, `Insurance`, `Salary`, `Debt`, `Software & Tools`) from initiating destination tag discovery.
2. Identify an on-site stay anchor for each destination tag, either bounded by `#travel` and `#end-travel` bookends OR detected via an un-bookended heuristic requiring a dense multi-day cluster of travel/dining/local transit expenses or foreign currency spending over multiple days. The analyzer SHALL NOT treat isolated single-day single transactions in non-travel categories as on-site travel episodes.
3. Look back up to 300 days prior to the on-site stay anchor start date and attribute any transactions sharing that destination tag in travel or transit categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`, etc.) as pre-trip bookings of that upcoming episode, regardless of gaps exceeding 60 days between pre-trip payments.
4. Split reused destination tags (e.g. `#Austria`, `#Malediwy`) into separate episodes when separate on-site stay anchors occur across different years or periods.
5. Reliably decode upstream timestamps in .NET ticks, Unix milliseconds, Unix seconds, or ISO 8601 strings into valid calendar dates without throwing runtime invalid time value errors.
6. Resolve transaction native currency hierarchically from `tx.destinationCurrencyId`, `tx.sourceCurrencyId`, destination category `currencyId`, or source account `currencyId`, and convert foreign-currency amounts (such as UAH, USD, EUR) to the default reporting currency using exchange rates.

#### Scenario: Foreign-currency transaction amounts converted accurately to default reporting currency

- **WHEN** a transaction is recorded in a foreign currency such as UAH (e.g. 149 UAH) or USD via its category or account without explicit transaction-level currency id
- **THEN** the analyzer resolves the native currency from the category or account and converts the amount to the default reporting currency (e.g. PLN) via exchange rates rather than displaying the native foreign amount 1:1 in default currency

#### Scenario: Reused destination tag split into separate trip episodes

- **WHEN** a destination tag such as `#Austria` appears on transactions across multiple years or separated by more than 60 days between on-site stays (or bounded by `#travel` and `#end-travel`)
- **THEN** the analyzer creates distinct chronological trip episodes (e.g. `Austria (Jul 2025)` and `Austria (Feb 2026)`) and attaches pre-trip bookings to their corresponding episode

#### Scenario: Long-gap pre-trip booking lookback without bookends

- **WHEN** a destination tag such as `#malediwy` has a flight down payment in May 2025, a hotel balance payment in August 2025, and an on-site stay from late September to October 2025 without `#travel` bookends
- **THEN** the analyzer identifies the September on-site stay anchor, looks back across the 90+ day gaps, and attributes both the May and August payments as pre-trip bookings of the single `Malediwy (Sep 2025)` episode instead of creating multiple 1-day ghost episodes

#### Scenario: Recurring subscription and tax tags excluded from travel episodes

- **WHEN** transactions are tagged with `#zus`, `#vat-7`, `#ppe`, `#youtube`, `#storytel`, `#evernote`, or `#subscription` appearing 3 or more times across history
- **THEN** the analyzer excludes them from destination tags and creates zero travel episodes for those tags

#### Scenario: Upstream transactions with .NET ticks formatted without errors

- **WHEN** travel transactions provide timestamps as .NET ticks (values exceeding $10^{16}$)
- **THEN** the analyzer decodes them to valid calendar dates and formats episode names (e.g. `Rome (Oct 2024)`) and episode ranges without runtime errors

### Requirement: Untagged window candidate discovery and explicit tag linking

For each detected trip episode with a verified multi-day or bookend-confirmed `[startDate, endDate]` window, the analyzer SHALL scan for untagged expense transactions occurring within that date window, prioritize foreign-currency and travel-relevant category charges, and present them in an explicit confirmation checklist.

The analyzer SHALL NOT run untagged candidate discovery on single-day isolated non-travel clusters. The system SHALL NOT silently include untagged candidate transactions in the confirmed trip total until the user selects and confirms them, which SHALL persist the destination tag upstream via `updateTransactionTags`.

#### Scenario: Confirming and linking untagged transactions within a trip window

- **WHEN** an untagged transaction occurs between a trip's `#travel` start date and `#end-travel` end date (or verified multi-day on-site anchor) and the user selects it in the "Untagged in Trip Window" review checklist and clicks "Link to Trip"
- **THEN** `updateTransactionTags` persists the trip's destination tag onto the transaction upstream and the transaction moves into the confirmed trip TCO breakdown

#### Scenario: Disallow untagged review generation on non-travel single-day events

- **WHEN** an unconfirmed or single-day transaction cluster does not meet on-site travel criteria
- **THEN** the untagged candidate scanner does not execute for that date, preventing domestic non-travel expenses from appearing as trip review candidates

### Requirement: Concert event costing and trip-overlap attribution

The analyzer SHALL identify concert events via `#concert` paired with an artist/event tag, aggregate separate ticket purchases (e.g. 2 tickets bought on the same day or across pre-booking dates) into a single concert event, classify each concert as **Local (In-Town)**, **Out-of-Town Concert Trip**, or **Concert inside a Travel**, and provide a toggle between **Direct Concert Cost** (tickets + concert-day spend) and **With Allocated Trip Overhead** when a concert overlaps a broader travel episode without double-counting in grand totals.

#### Scenario: Viewing a concert occurring inside a broader travel episode

- **WHEN** a concert event (`#concert` + event tag) falls within the date window of a multi-day trip episode
- **THEN** the concert card displays both its Direct Concert Cost and its Trip-Overlap badge, and the overall Trips & Concerts summary avoids double-counting the shared travel transactions
