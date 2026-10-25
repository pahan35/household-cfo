# Tasks

## 1. Category Normalization & Denylist Filtering

- [ ] 1.1 Add `Software & Tools` aliases to `normalizeUnifiedCategory` in `lifestyle-transforms.ts` and verify with existing category normalizer tests.
- [ ] 1.2 Add `EXCLUDED_LIFESTYLE_DESTINATION_TAGS` and `EXCLUDED_DESTINATION_CATEGORY_REGEX` to `lifestyle-transforms.ts` and filter candidate transactions before building `destinationTxMap`. Verify exclusion by checking `#subscription`, `#tax`, `#zus`, `#vat-7`, `#youtube`, `#evernote` are discarded.

## 2. Two-Phase Anchor & Lookback Travel Detection

- [ ] 2.1 Refactor `detectTravelEpisodes` in `lifestyle-transforms.ts` to identify on-site stay anchors (either bookended by `#travel` / `#end-travel` or un-bookended multi-day contiguous spending clusters), rejecting single-day isolated transactions.
- [ ] 2.2 Implement the 300-day pre-booking lookback in `detectTravelEpisodes` to gather prior payments in travel/transit categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`) into the upcoming on-site anchor, bridging multi-month gaps without fragmenting into 1-day ghost episodes.
- [ ] 2.3 Guard `findUntaggedTripCandidates` invocation in `detectTravelEpisodes` so untagged candidate discovery executes only for valid on-site stays ($\ge 2$ days or explicit bookends).

## 3. Test Coverage & Full Verification

- [ ] 3.1 Add comprehensive unit tests in `lifestyle-transforms.test.ts` simulating the Maldives scenario (May downpayment, August balance, September on-site stay) to verify single-episode unification.
- [ ] 3.2 Add unit tests in `lifestyle-transforms.test.ts` verifying that recurring tax and subscription tags (`#zus`, `#vat-7`, `#ppe`, `#youtube`, `#storytel`, `#evernote`) produce zero detected episodes.
- [ ] 3.3 Run `npm run verify` (`biome check && tsc --noEmit`) and ensure all checks and TypeScript strict typing pass cleanly.
