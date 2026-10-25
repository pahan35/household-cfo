# Proposal: Fix Travel Bookends and Episode Detection

## Why

In the Trips & Concerts dashboard and the Travel Bookend Assistant, three usability and accuracy issues degrade the user experience:
1. Operations in foreign currencies (e.g. Kantor USD, YouTube Subscriptions UAH) are mislabeled as `PLN` because transfers pick destination currency by default, category name suffixes are overridden by placeholder database `currencyId`s, and single-line displays lack dual-currency conversion context.
2. Navigating historical trips in the Travel Bookend Assistant requires clicking month chevrons 12 times per year, making multi-year lookups tedious.
3. Travel episode detection splits pre-trip booking clusters (such as flight/hotel bookings 2-3 weeks prior to departure) into separate fake trip episodes (e.g. creating duplicate Madeira trips: `Madeira (Oct 2023)` and `Madeira (Nov 2023)`), leaving the genuine `#travel`-bookended trip with PLN 0.00 in pre-bookings.

## What Changes

- **Foreign Currency Display in Travel Bookend Assistant**:
  - Update candidate transaction presentation in `travel-bookend-assistant.tsx` to leverage `getConvertedTransactionAmount` so that foreign source currencies, account currencies, and name-suffix currencies (e.g., USD, UAH, EUR) render with their authentic symbols and amounts in ledger mode (native primary + converted `≈ PLN ...` secondary).
  - Enhance `resolveCategoryCurrency` and `resolveTransactionMoney` so explicit 3-letter currency suffixes (e.g. `Subscriptions UAH`, `Kantor USD`) take precedence when `category.currencyId` matches the default reporting currency (`PLN`), and ensure transfers preserve foreign counter-currency rather than discarding it.
- **Month/Year Picker Popover for Assistant**:
  - Replace the month-stepper text in `travel-bookend-assistant.tsx` with a clickable trigger opening a popover.
  - Implement a dedicated Year selector and 12-month grid allowing 1-click jumps to any historical month and year across past years.
- **Strict Precedence for Explicit Travel Bookends**:
  - In `detectTravelEpisodes` in `lifestyle-transforms.ts`, when a destination tag has explicit `#travel` / `#end-travel` bookends, all prior transactions for that destination within the 300-day lookback window SHALL be attributed as pre-trip bookings of the bookended episode.
  - Suppress un-bookended heuristic anchor creation for clusters occurring prior to an explicit `#travel` bookend, preventing pre-booking clusters from being classified as independent trips.

## Capabilities

### Modified Capabilities
- `trip-and-concert-costing`:
  - Strengthen episode detection so explicit `#travel` and `#end-travel` bookends take precedence over un-bookended heuristic clusters, ensuring pre-trip bookings fold into the bookended episode rather than creating duplicate trips.
  - Update the Travel Bookend Assistant specification to require authentic foreign currency ledger presentation and an interactive month/year picker popover for jumping across years.
- `multi-currency-presentation`:
  - Update `resolveCategoryCurrency` hierarchy to prioritize explicit foreign currency suffixes when `currencyId` matches the system default currency, and preserve foreign amounts in transfer transactions.

## Impact

- `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/travel-bookend-assistant.tsx`: Month/year navigation popover, candidate money presentation using `<MoneyValue mode="ledger" />`.
- `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`: `detectTravelEpisodes` anchor clustering and pre-booking attribution logic.
- `src/app/(main)/dashboard/family-budget/_components/external-provider-money.ts`: Category currency suffix priority and transfer foreign currency preservation.
- Associated unit tests in `lifestyle-transforms.test.ts`, `travel-bookend-assistant.test.ts`, and `external-provider-money.test.ts`.
