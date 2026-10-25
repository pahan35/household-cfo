# Tasks

## 1. Core Timestamp Parsing & Lifestyle Transforms Fix

- [x] 1.1 Update `getTransactionDate` in `lifestyle-transforms.ts` to decode .NET ticks using `parseExternalProviderTimestamp`, prioritize valid ISO strings, and ensure returned values are valid Date instances. Verify via `npm test src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts`.
- [x] 1.2 Add defensive date fallbacks for `effectiveStartDate` and `effectiveEndDate` in `detectTravelEpisodes` and `detectConcertEvents` in `lifestyle-transforms.ts`. Verify by running `npm run check`.

## 2. Dashboard UI Alignment

- [x] 2.1 Replace raw `new Date(tx.dateTimestamp ?? 0)` with `getTransactionDate(tx)` in `trips-concerts-dashboard.tsx` (candidate transactions list, pre-booking list, on-site list). Verify by running `npm run verify`.

## 3. Unit Test Coverage & Verification

- [x] 3.1 Add unit tests in `lifestyle-transforms.test.ts` covering `getTransactionDate` with .NET ticks, Unix ms, Unix seconds, ISO strings, and malformed inputs. Verify with `npm test`.
- [x] 3.2 Add a unit test in `lifestyle-transforms.test.ts` for `detectTravelEpisodes` simulating upstream transactions with `.NET` ticks in `dateTimestamp` to verify no `RangeError: Invalid time value` is thrown. Verify with `npm test`.
- [x] 3.3 Run `npm run verify` to ensure linting, formatting, and type checks pass across the repository.
