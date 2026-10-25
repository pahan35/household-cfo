# Proposal: Transaction Multi-Tagging and Travel Bookending

## Why

ExternalProvider's native interface has significant friction for entering multiple tags on transactions, yet key downstream analytics—particularly Travel & Concert TCO, Lifestyle Tag statistics, and Tax audits—rely directly on multi-tagged transactions. Users need an efficient way to navigate across transactions within specific historical date ranges and quickly assign tags, especially identifying vacation boundaries to mark `#travel` (start) and `#end-travel` (end) bookends alongside destination tags.

## What Changes

- **Universal Multi-Tag Editor**: Introduce an interactive, keyboard- and click-friendly tag editor component (`MultiTagEditorPopover`) supporting tag autocomplete, chip removal, freeform tag creation, and instant synchronization with ExternalProvider via `updateTransactionTags`.
- **Date-Range Navigation in Transaction Ledger**: Enhance `RecentTransactionsCard` on `/dashboard/family-budget` with date range filtering (`from`/`to` inputs, quick month/year presets, jump-to-date), category/account filtering, and inline tag chips on all transaction rows.
- **Travel Bookend & Episode Discovery Assistant**: Add a dedicated travel episode bookending assistant in `/dashboard/family-budget/lifestyle/trips-concerts` that allows users to pick target dates/months, highlights candidate boundary transactions (airlines, lodging, transit, foreign currency), and provides one-click actions to mark trip start (`#travel` + destination) and trip end (`#end-travel` + destination), instantly triggering episode detection.

## Capabilities

### New Capabilities
- `transaction-tag-editor`: Date-range navigation, full tag visualization, and interactive multi-tag editing for household transactions in the primary ledger.

### Modified Capabilities
- `trip-and-concert-costing`: Extends episode detection with an interactive Travel Bookending Assistant for navigating candidate date ranges, identifying boundary transactions, and establishing `#travel` / `#end-travel` bookends directly from the Trips & Concerts view.

## Impact

- **Frontend components**:
  - `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/multi-tag-editor-popover.tsx` (new)
  - `src/app/(main)/dashboard/family-budget/_components/transaction-date-range-filter.tsx` (new)
  - `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/trips-concerts-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/travel-bookend-assistant.tsx` (new)
- **API and Client**:
  - Leverages existing `updateTransactionTags` and `getTransactionPage({ period: { from, to } })` in `external-provider-client.ts`. No new proxy endpoints or third-party secrets required.
