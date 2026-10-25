# Tasks

## 1. Category Normalization & Denylist Filtering

- [x] 1.1 Add `Software & Tools` aliases to `normalizeUnifiedCategory` in `lifestyle-transforms.ts` and verify with existing category normalizer tests.
- [x] 1.2 Add `EXCLUDED_LIFESTYLE_DESTINATION_TAGS` and `EXCLUDED_DESTINATION_CATEGORY_REGEX` to `lifestyle-transforms.ts` and filter candidate transactions before building `destinationTxMap`. Verify exclusion by checking `#subscription`, `#tax`, `#zus`, `#vat-7`, `#youtube`, `#evernote` are discarded.
- [x] 1.3 Update `getConvertedTransactionAmount` in `lifestyle-transforms.ts` to accept `categoryMap` and resolve currency hierarchically from destination category or source account when `tx.destinationCurrencyId` / `tx.sourceCurrencyId` are absent, converting accurately to `defaultCurrency`.

## 2. Two-Phase Anchor & Lookback Travel Detection

- [x] 2.1 Refactor `detectTravelEpisodes` in `lifestyle-transforms.ts` to identify on-site stay anchors (either bookended by `#travel` / `#end-travel` or un-bookended multi-day contiguous spending clusters), rejecting single-day isolated transactions.
- [x] 2.2 Implement the 300-day pre-booking lookback in `detectTravelEpisodes` to gather prior payments in travel/transit categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`) into the upcoming on-site anchor, bridging multi-month gaps without fragmenting into 1-day ghost episodes.
- [x] 2.3 Guard `findUntaggedTripCandidates` invocation in `detectTravelEpisodes` so untagged candidate discovery executes only for valid on-site stays ($\ge 2$ days or explicit bookends).

## 3. Test Coverage & Full Verification

- [x] 3.1 Add comprehensive unit tests in `lifestyle-transforms.test.ts` simulating the Maldives scenario (May downpayment, August balance, September on-site stay) to verify single-episode unification.
- [x] 3.2 Add unit tests in `lifestyle-transforms.test.ts` verifying that recurring tax and subscription tags (`#zus`, `#vat-7`, `#ppe`, `#youtube`, `#storytel`, `#evernote`) produce zero detected episodes.
- [x] 3.3 Add unit tests in `lifestyle-transforms.test.ts` verifying that foreign-currency transactions lacking transaction-level currency identifiers (e.g. 149 UAH from a UAH category) convert to default reporting currency using exchange rates rather than evaluating 1:1.
- [x] 3.4 Run `npm run verify` (`biome check && tsc --noEmit`) and ensure all checks and TypeScript strict typing pass cleanly.
