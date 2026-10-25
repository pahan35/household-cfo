# Spec Delta: trip-and-concert-costing

## ADDED Requirements

### Requirement: Interactive travel bookend and episode discovery assistant

The Trips & Concerts dashboard (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL provide an interactive travel bookending assistant to locate past vacation dates, inspect transactions in candidate timeframes, and designate `#travel` and `#end-travel` bookends along with a destination tag.

#### Scenario: Navigating to a past vacation date window
- **WHEN** the user selects a target month or date range in the travel bookending assistant
- **THEN** the assistant filters transactions within that window and highlights potential boundary expenses (such as flights, lodging, transit, and foreign currency transactions)

#### Scenario: Designating trip start bookend
- **WHEN** the user clicks "Mark as Trip Start" on a transaction within the assistant with destination tag `#austria` specified
- **THEN** `updateTransactionTags` appends `#travel` and `#austria` to that transaction and the episode detector recalculates to display the trip start

#### Scenario: Designating trip end bookend
- **WHEN** the user clicks "Mark as Trip End" on a transaction within the assistant with destination tag `#austria` specified
- **THEN** `updateTransactionTags` appends `#end-travel` and `#austria` to that transaction and the episode detector recalculates to establish the completed episode window
