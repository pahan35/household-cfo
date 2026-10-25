# Tasks: Fix Travel Bookends and Episode Detection

## 1. Multi-Currency Resolution & Presentation Fixes

- [x] 1.1 In `external-provider-money.ts`, update `resolveCategoryCurrency` so explicit non-default currency suffixes in category names take precedence when database `currencyId` matches default currency (`PLN`), and update `resolveTransactionMoney` to preserve foreign transfer amounts; verify with unit tests in `external-provider-money.test.ts`.
- [x] 1.2 In `travel-bookend-assistant.tsx`, update candidate monetary display to utilize `getConvertedTransactionAmount` and `<MoneyValue mode="ledger" />` ensuring foreign operations (such as `Kantor USD` and `Subscriptions UAH`) render their native currency primary alongside converted PLN secondary; verify with unit tests in `travel-bookend-assistant.test.ts`.

## 2. Interactive Month & Year Navigation

- [x] 2.1 In `travel-bookend-assistant.tsx`, replace the static month-year label with an interactive Popover trigger containing a Year stepper, a 3x4 grid of 12 month buttons for instant multi-year jumping, and a "Jump to Today" shortcut; verify month state updates correctly and popover closes on selection.

## 3. Travel Episode Detection & Pre-Booking Attribution

- [x] 3.1 In `lifestyle-transforms.ts` (`detectTravelEpisodes`), implement strict explicit bookend precedence so clusters sharing a destination tag within 300 days prior to an upcoming `#travel` bookend are designated as pre-bookings rather than promoted to independent un-bookended stay anchors; verify with a regression test reproducing the Madeira October pre-booking and November trip.

## 4. Verification & Validation

- [x] 4.1 Run `npx vitest run src/app/\(main\)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts src/app/\(main\)/dashboard/family-budget/_components/external-provider-money.test.ts src/app/\(main\)/dashboard/family-budget/lifestyle/trips-concerts/__tests__/travel-bookend-assistant.test.ts` to confirm all lifestyle, money, and assistant tests pass.
- [x] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify formatting, linting, and strict TypeScript compilation.
