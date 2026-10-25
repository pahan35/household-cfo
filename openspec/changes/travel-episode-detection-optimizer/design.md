# Design: Travel Episode Detection Optimizer

## Context

See `proposal.md` for background and motivation.

`detectTravelEpisodes` in `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts` groups expenses by tags and identifies travel clusters. The current code relies on two flawed assumptions:
1. Any tag with $\ge 3$ transactions in history is treated as a valid destination tag.
2. Any time gap $>60$ days between transactions with that tag splits them into independent on-site clusters, treating long-lead pre-payments as isolated trips unless bookended by `#travel`.

## Goals / Non-Goals

**Goals:**
- Eliminate false-positive travel episodes generated from recurring subscriptions, business taxes, mobile games, and contractors.
- Correctly unify multi-stage pre-trip payments (e.g. flight down payment 4–9 months prior, hotel reservation 1–2 months prior) into their upcoming on-site travel episode.
- Safeguard the untagged candidate scanner so it only executes for valid multi-day or bookended travel windows.
- Provide unified category support for `Software & Tools` to enable clean classification of tools like JetBrains, Evernote, and Google AI Pro.

**Non-Goals:**
- Automatic reassignment of historical transaction categories upstream (category reorganization is performed by the user in ExternalProvider or via the category lifecycle optimizer).
- Splitting `Tickets and Entertainment` into offline/online entertainment (deferred to a future subscription efficiency iteration per user decision).
- Modifying concert detection algorithms (`detectConcertEvents`), which already function independently via `#concert`.

## Decisions

### Decision 1: Denylist of Reserved Tags and Non-Travel Categories

* **Choice**: Filter candidate destination tags against a strict exclusion denylist before building the destination transaction map:
  - **Tag Denylist**: `subscription`, `sub`, `tax`, `zus`, `vat-7`, `vat`, `ppe`, `salary`, `transfer`, `cash`, `refund`, `wc`.
  - **Category Denylist Regex**: `/(?:\btax(?:es)?\b|podat|rent|czynsz|flat|apartment|utilit|prąd|gaz|mieszkanie|salary|wynagrodz|insurance|ubezpiecz|software|tools)/i`.
* **Rationale**: Immediate rejection at Phase 0 prevents recurring operations from ever populating `destinationTxMap`, completely halting the creation of episodes like `Zus (Oct 2026)` or `Youtube (Jul 2026)`.
* **Alternatives Considered**: Whitelist of known cities/countries. Rejected because users travel to diverse locations, and maintaining an exhaustive city/country dictionary would fail for niche regions, resorts, or personal naming conventions (`#malediwy`).

### Decision 2: Two-Phase Anchor & Lookback Clustering Engine

* **Choice**: Rebuild cluster formation into two distinct phases:
  1. **Phase 1: On-Site Stay Anchor Identification**:
     - *Bookended Anchor*: Transactions bounded by `#travel` (start) and `#end-travel` (end).
     - *Heuristic Anchor (Un-bookended)*: Transactions spanning multiple days ($\ge 2$ days between first and last date) containing travel-specific spending (foreign currency charges OR categories matching `/(transport|flight|airline|hotel|hostel|restaurant|cafe|dining|uber|taxi|rail|tour|rent)/i`).
     - Any single-day, 1-transaction occurrence without bookends is disqualified from becoming an on-site anchor.
  2. **Phase 2: 300-Day Pre-Booking Lookback**:
     - For each identified on-site stay anchor starting at `clusterStartDate`, search all earlier transactions with that destination tag within `[clusterStartDate - 300 days, clusterStartDate)`.
     - Attribute transactions in transit, lodging, or booking categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`, etc.) or with pre-booking tags as `preBookingTransactions` for that upcoming episode.
* **Rationale**: Solves the Maldives case (`#malediwy`) where a flight deposit in May 2025 and hotel payment in August 2025 precede a late-September stay. Instead of splitting on $>60$-day gaps, the payments are gathered into the September 2025 anchor.
* **Alternatives Considered**: Increasing the gap threshold from 60 days to 120 days. Rejected because increasing the gap would cause separate annual trips (e.g. annual winter trips to Austria) to merge into a single massive trip.

### Decision 3: Guarding Untagged Review Discovery

* **Choice**: In `detectTravelEpisodes`, call `findUntaggedTripCandidates` only when the episode has an on-site stay spanning $\ge 2$ days or has explicit `#travel` / `#end-travel` bookends.
* **Rationale**: Eliminates the "41 untagged to review" problem on single-day spikes, ensuring users are only prompted to link expenses that occurred while actually traveling.

### Decision 4: Unified Category Normalization for `Software & Tools`

* **Choice**: In `normalizeUnifiedCategory`, add recognition for `Software & Tools`, `Software`, `Tools & Software`, and `Dev Tools` to return the canonical unified name `"Software & Tools"`.
* **Rationale**: Allows the user to introduce this category in ExternalProvider and ensures dashboard filters, lifestyle drill-downs, and category tracers handle it consistently.

### Decision 5: Hierarchical Currency Resolution & Accurate FX Conversion

* **Choice**: Update `getConvertedTransactionAmount` to accept an optional `categoryMap: Map<string, ExternalProviderCategory>`:
  - If `tx.destinationCurrencyId` or `tx.sourceCurrencyId` is present, use it.
  - Otherwise, inspect the destination category (`categoryMap.get(tx.destinationId)?.currencyId`) and source account (`categoryMap.get(tx.sourceId)?.currencyId`).
  - Convert `nativeAmount` from the resolved currency to `defaultCurrency` using `convertCurrencyAmount(nativeAmount, resolvedCurrency, defaultCurrency, currencies)`.
* **Rationale**: In ExternalProvider, transactions often omit inline currency fields, inheriting their currency from the account or category (e.g. "Subscriptions UAH" or Monobank UAH). Without this lookup, 149 UAH is treated as 149 PLN (a ~10x overstatement).
* **Alternatives Considered**: Assuming default currency whenever transaction-level fields are absent. Rejected because it produces false PLN amounts for foreign-currency categories and trips.

## Risks / Trade-offs

- **[Risk] Single-day travel trips (e.g. 1-day day-trip to a nearby city) without `#travel` bookends might be ignored.**
  - *Mitigation*: If a 1-day trip has an explicit `#travel` tag, it is always accepted as a bookended episode. The multi-day requirement applies only to un-bookended heuristic detection.
- **[Risk] Pre-booking booked more than 300 days in advance (e.g. 11 months prior).**
  - *Mitigation*: 300 days covers nearly 10 months, accommodating all standard airline schedule releases (which open ~330 days out). Can be expanded if needed.

## Migration Plan

1. Implement transform updates and comprehensive tests in `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`.
2. Verify existing test suite passes (`npm run verify`).
3. User creates/renames category in ExternalProvider to `Software & Tools` and assigns JetBrains, Evernote, and Google AI Pro with tag `#subscription`.
