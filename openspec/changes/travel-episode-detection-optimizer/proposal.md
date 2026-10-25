# Proposal: Travel Episode Detection Optimizer

## Why

The Trips & Concerts analyzer (`/dashboard/family-budget/lifestyle/trips-concerts`) suffers from severe false positives in travel episode detection:
1. Any tag appearing $\ge 3$ times across transaction history is treated as a travel destination. Consequently, recurring subscriptions (`#youtube`, `#storytel`, `#evernote`, `#googledrive`), business taxes (`#zus`, `#vat-7`, `#ppe`), mobile games (`#polytopia`), and contractor fees (`#nizhelskyi`) spawn spurious "trip episodes" (e.g. `Zus (Oct 2026)`, `Youtube (Jul 2026)`).
2. The current 60-day gap splitting logic fragments genuine trips into multiple 1-day episodes when pre-trip payments (e.g. initial down payment in May 2025, resort balance in August 2025 for a September 2025 Maldives vacation) occur months in advance without `#travel` bookends.
3. Spurious single-day episodes trigger the untagged candidate scanner on ordinary domestic spending days, presenting dozens of non-travel transactions for review.
4. Professional software tools and subscriptions (`JetBrains`, `Evernote`, `Google AI Pro`) lack a dedicated category home, leading to distorted `Utility` or `Learning` metrics.

Optimizing this detection engine now eliminates dashboard noise, correctly links long-lead pre-trip bookings to their upcoming journeys, and establishes clean category normalization for software tools.

## What Changes

- **Tag & Category Exclusion Denylist**:
  - Exclude reserved non-travel tags from becoming destination tags: `subscription`, `sub`, `tax`, `zus`, `vat-7`, `vat`, `ppe`, `salary`, `transfer`, `cash`, `refund`, `wc`.
  - Exclude transactions in non-travel categories (`Tax`, `Utility`, `Housing`, `Insurance`, `Salary`, `Debt`, `Software & Tools`) from initiating destination tag discovery.
- **Two-Phase Anchor & Lookback Travel Detection Engine**:
  - **Phase 1: On-Site Stay Anchor Identification**:
    - Identify on-site stay windows anchored either by explicit `#travel` / `#end-travel` bookends OR by heuristic multi-day contiguous spending clusters in foreign currency or on-site lifestyle categories (dining, local transport, activities).
    - Reject isolated single-day, single-transaction events as on-site trips.
  - **Phase 2: 300-Day Pre-Booking Lookback**:
    - For any detected on-site stay anchor with a destination tag (e.g. `#malediwy`), look back up to 300 days prior to the anchor start date.
    - Attribute transactions with that destination tag in travel/transit categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`, etc.) as pre-trip bookings of that upcoming episode, even if separated by $>60$-day gaps.
- **Safe Untagged Review Discovery**:
  - Restrict untagged candidate discovery exclusively to validated multi-day or bookended travel episodes, preventing spurious domestic reviews.
- **`Software & Tools` Category Support**:
  - Add `Software & Tools` (and `Software`) to unified category normalization in `lifestyle-transforms.ts`, facilitating migration of subscriptions like JetBrains, Evernote, and Google AI Pro.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `trip-and-concert-costing`: Update travel episode detection requirements to mandate tag/category denylisting, heuristic on-site stay anchor identification, 300-day pre-booking lookback without gap-fragmentation, and guard untagged candidate review discovery against single-day non-travel clusters.

## Impact

- **Algorithms & Transforms**:
  - `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`: Update `detectTravelEpisodes`, add exclusion denylist, implement two-phase anchor + 300-day lookback clustering, and update `normalizeUnifiedCategory` to support `Software & Tools`.
- **Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts`: Add comprehensive test cases for un-bookended long-gap pre-bookings (e.g. May/August/September `#malediwy`), denylisted recurring tags (`#zus`, `#youtube`, `#evernote`), and software category normalization.
