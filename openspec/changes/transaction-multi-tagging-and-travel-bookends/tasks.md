# Tasks: Transaction Multi-Tagging and Travel Bookending

## 1. Reusable Tagging & Date Navigation Primitives

- [ ] 1.1 Implement `MultiTagEditorPopover` (`src/app/(main)/dashboard/family-budget/_components/multi-tag-editor-popover.tsx`) with tag chip list, autocomplete from known tags, quick removal, freeform creation, and optimistic persistence via `updateTransactionTags`. Verify with unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/multi-tag-editor-popover.test.tsx`.
- [ ] 1.2 Implement `TransactionDateRangeFilter` (`src/app/(main)/dashboard/family-budget/_components/transaction-date-range-filter.tsx`) supporting custom start/end date inputs, preset quick buttons ("This Month", "Last Month", "This Year", "All Time"), and active filter badge indicators. Verify with unit test in `src/app/(main)/dashboard/family-budget/_components/__tests__/transaction-date-range-filter.test.tsx`.

## 2. Primary Transaction Ledger Integration

- [ ] 2.1 Integrate `TransactionDateRangeFilter` and tag badges with `MultiTagEditorPopover` into `RecentTransactionsCard` (`src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx`), wiring period queries into `getTransactionPage`. Verify that date filtering reloads paginated rows and tag updates persist.
- [ ] 2.2 Ensure optimistic transaction state updates and cache invalidation handle tag additions and removals cleanly without layout shift in `RecentTransactionsCard`. Verify with `npm run verify`.

## 3. Travel Bookending & Episode Discovery Assistant

- [ ] 3.1 Implement `TravelBookendAssistant` (`src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/travel-bookend-assistant.tsx`) providing target date/month filtering, boundary candidate scoring (foreign currency, transit, lodging), destination tag input, and 1-click "Mark as Trip Start (#travel)" / "Mark as Trip End (#end-travel)" actions. Verify with unit tests.
- [ ] 3.2 Embed `TravelBookendAssistant` into `TripsConcertsDashboard` (`src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/trips-concerts-dashboard.tsx`) with an expandable drawer or action card, verifying that newly marked bookends immediately trigger `detectTravelEpisodes` and surface the untagged candidate review checklist.

## 4. Verification

- [ ] 4.1 Run `npm run verify` (`biome check && tsc --noEmit`) to validate strict typing, formatting, and linting across all modified and newly created files.
