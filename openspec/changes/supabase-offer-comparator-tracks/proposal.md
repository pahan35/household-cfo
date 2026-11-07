# Proposal: Supabase Relational Offer Comparator Tracks

## Why

The Job Offer & Compensation Comparator (`/dashboard/family-budget/offer-comparator`) models complex employment negotiations, B2B versus UoP tax calculations, time-off policies, two-layer benefit offsets, and equity grants. Currently, all tracks, revisions, and global assumptions are stored exclusively in browser `localStorage` (`family-budget:offer-comparator:v1`).

Because career compensation and negotiation restructures are critical family financial decisions, storing them in local browser storage creates high data vulnerability (loss upon browser cache clear or Safari ITP expiration) and isolates models to a single device. Moving offer tracks and revisions to relational tables in Supabase PostgreSQL enables cloud persistence across family devices, structured querying of compensation progressions, and clean relational foreign key links from downstream tools like the JDG Runway Simulator.

## What Changes

- Create PostgreSQL relational tables in Supabase:
  - `offer_tracks`: Employer / role tracks (`company`, `role`, `status: current | negotiating | past_accepted | past_declined`).
  - `offer_revisions`: Detailed compensation revisions per track with structured tax parameters (B2B ryczałt/liniowy/skala, UoP, PFRON, ZUS stage, time-off model, benefits, equity, side-gigs).
  - `offer_comparator_assumptions`: Global comparison assumptions (pessimistic FX buffers, manual FX overrides, target expenses/savings, projection horizon).
- Provide a server-side repository (`src/server/offers/db.ts`) and authenticated Server Actions / API routes for track and revision CRUD.
- Adapt `OfferRepository` to synchronize with Supabase while maintaining `localStorage` as an immediate offline cache.
- Automatically import/seed existing `localStorage` data into Supabase when an authenticated user opens the comparator with an empty database.

## Capabilities

### New Capabilities
<!-- None: This enhances the existing job-offer-comparator capability -->

### Modified Capabilities
- `job-offer-comparator`: Replace single-browser `localStorage` persistence with Supabase relational tables (`offer_tracks`, `offer_revisions`, and `offer_comparator_assumptions`), supporting multi-device synchronization and structured querying while preserving offline export/import and local caching.

## Impact

- **Database**: Adds migration `0003_offer_comparator_tracks.sql` with foreign keys from `offer_revisions` to `offer_tracks` and cascading deletes.
- **Backend / APIs**: Adds `src/server/offers/db.ts` and route handlers at `/api/family-budget/offers`.
- **Frontend**: Adapts `OfferRepository` (`src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository.ts`) to sync with Supabase and auto-migrate legacy browser state.
- **Dependencies**: Uses existing Supabase REST / database client infrastructure; zero new dependencies.
