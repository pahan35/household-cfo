# transaction-tag-editor Specification

## Purpose

Enables full tag visualization, date-range navigation, and interactive multi-tag editing directly within the primary transaction ledger, with real-time upstream synchronization.

## Requirements

### Requirement: Transaction ledger date-range filtering and navigation

The transaction ledger on the Accounts & Transactions dashboard (`/dashboard/family-budget`) SHALL provide controls to filter transactions by arbitrary date ranges (`from` and `to` calendar dates), quick time presets (e.g. Current Month, Last Month, Specific Year), and direct date navigation, passing the period parameters to the underlying transaction query.

#### Scenario: User filters transactions by custom date range
- **WHEN** the user selects a start date of `2024-07-01` and an end date of `2024-07-31`
- **THEN** the ledger reloads transactions matching that interval and indicates the active date range in the header

#### Scenario: User clears date range filter
- **WHEN** the user clears the active date filter
- **THEN** the ledger resets to the default all-time/recent transaction stream

### Requirement: Interactive multi-tag visualization and editing

The transaction ledger SHALL display all existing tags for each transaction as distinct visual badges. Clicking on a transaction's tags or an add-tag button SHALL open an interactive multi-tag editor popover that allows adding, removing, and autocompleting tags.

#### Scenario: Adding a tag with autocomplete
- **WHEN** the user opens the tag editor popover on a transaction, types a tag name, and confirms or selects an existing tag from the suggestions
- **THEN** the tag is appended to the transaction's tags array and persisted upstream via `updateTransactionTags`

#### Scenario: Removing an existing tag
- **WHEN** the user clicks the remove icon on a tag chip in the tag editor
- **THEN** the tag is removed from the transaction and the updated tags list is persisted upstream via `updateTransactionTags`

#### Scenario: Normalizing tag format on entry
- **WHEN** a user enters a tag with or without a leading `#` (e.g. `travel` or `#travel`)
- **THEN** the tag editor normalizes the tag format consistently before saving
