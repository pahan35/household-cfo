# Design

## Context

ExternalProvider stores transactions with a single expense/income category (`destinationId` / `sourceId`) and an optional flat `tags: string[]` list. Because ExternalProvider categories are tied to a single currency (`Medicine PLN`, `Medical services UAH`, `Menthal Health EUR`, `Sport PLN`), multi-currency spending fragments categories, and cross-category events (trips, concerts) or multi-visit wellness passes (`10x` Pilates, `10x` Mental Health packages) cannot be analyzed in the existing macro Budget Overview. Additionally, ExternalProvider Mobile's **Category -> Tag drill-down donut** and Web's **filtered tag/category trend line** are not yet available in our web dashboard.

## Goals / Non-Goals

**Goals:**
- Provide a 4-tab **Lifestyle & Tags** suite under `/dashboard/family-budget/lifestyle`:
  1. **Tag & Category Explorer** (`/lifestyle`): ExternalProvider Mobile-style `Expenses | Income` donut + ranked list with `By Category (with > Tag drill-down)`, `Unified Category`, and `By Tag` modes, plus a filtered historical trend chart.
  2. **Trips & Concerts** (`/lifestyle/trips-concerts`): Episode detector (`#travel` / `#end-travel` bookends + >60-day gap splitting + pre-trip booking attribution), untagged date-window candidate linker (`updateTransactionTags`), and Concert Local vs. Trip / Overlap analyzer.
  3. **Health & Sport** (`/lifestyle/health-sport`): Currency-unified streams (`Massage`, `Physiotherapy`, `Mental Health`, `Pilates`, `General Medical & Sport`), session multiplier engine (`10x` Pilates default, `#10x`/`#5x`/`#1x` overrides), cadence metrics, and inline tag/pass audit queue.
  4. **Learning** (`/lifestyle/learning`): Foundational learning stream & tag breakdown (`#platform`, `#cert`, `#course`, `#tutor`, `#books`) with recurring subscription run-rate metrics.
- Reuse a single shared data loader (`useLifestyleData`) that fetches categories, currencies, settings, and all-time transactions via `external-provider-client.ts` (leveraging the 5-hour client & server cache).

**Non-Goals:**
- Macro account `Balance` and `Net Worth` historical curves on `/dashboard/family-budget/budget-overview` (tracked separately in `net-worth-and-balance-trends`).
- Adding new upstream proxy endpoints or third-party dependencies.

## Decisions

1. **Shared `useLifestyleData` hook + pure transform modules (`lifestyle-transforms.ts`)**:
   - *Rationale*: All four views under `/dashboard/family-budget/lifestyle` operate on the same normalized transaction history, category dictionary, and currency exchange rates. A shared hook avoids redundant paging when switching between `Tag Explorer`, `Trips & Concerts`, `Health & Sport`, and `Learning`, while keeping all domain logic in pure, unit-testable functions in `lifestyle-transforms.ts`.
   - *Alternatives considered*: Fetching per-category subsets separately on each sub-route—rejected because trips, concerts, and global tag exploration span all expense categories.

2. **Hybrid Travel Episode Detection (`#travel` / `#end-travel` bookends + 60-day gap clustering + pre-booking lookback)**:
   - *Rationale*: Users tag the start and end of a trip with `#travel` and `#end-travel` alongside the destination tag (e.g. `#Austria`), while flights/hotels booked months earlier carry `#Austria` without `#travel`. Grouping on-site clusters first (bounded by `#travel`/`#end-travel` or split when gaps exceed 60 days) and attaching earlier `#Austria` bookings within 270 days prior to the trip start accurately reconstructs repeated trips to the same destination.
   - *Alternatives considered*: Grouping purely by tag string (`#Austria`)—rejected because reused destination tags across years merge distinct vacations into one giant bucket.

3. **Explicit Confirmation UI for Untagged Trip-Window Transactions**:
   - *Rationale*: Not every transaction during a trip's date range is a travel cost (e.g. automatic utility bills or rent paid while abroad). Candidate transactions inside `[startDate, endDate]` are scored (highlighting foreign currency and travel-related categories like transport, restaurants, hotels) and presented in a review checklist; confirming selected items calls `updateTransactionTags` so ExternalProvider itself becomes the single source of truth.

4. **Currency-Suffix-Tolerant Semantic Category Matchers + Tag Multipliers for Wellness**:
   - *Rationale*: Stripping trailing 3-letter ISO currency codes (`PLN`, `UAH`, `EUR`, `USD`) and normalizing known variants (`Menthal Health` -> `Mental Health`, `Medical services` -> `Medicine`) unifies multi-currency categories automatically. Applying default session multipliers (`10` for `#pilates`, `1` for others) with `#<N>x` tag overrides and outlier package detection (`>= 4x` median single-session cost) computes realistic session cadence without requiring custom database tables.

## Risks / Trade-offs

- **[Risk] Paging all-time transactions on initial Lifestyle load** -> **Mitigation**: Page transactions in batches (`take: 500`) via `getTransactionPage` with `cachedClientFetch` (5-hour TTL) so subsequent route switches and HMR reloads are instantaneous.
- **[Risk] Ambiguous untagged transactions during a trip window** -> **Mitigation**: Exclude known fixed-bill categories (Rent, Taxes) from high-confidence travel candidates by default and require explicit user checkbox confirmation before persisting tags.
