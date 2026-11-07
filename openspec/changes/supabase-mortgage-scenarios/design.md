# Technical Design: Supabase Relational Mortgage Scenarios

## Context

See `proposal.md` for motivation. Currently, the Mortgage & Home Goal Simulator (`/dashboard/family-budget/mortgage`) manages state through `MortgageRepository` in `src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-repository.ts`, which persists a single serialized JSON payload to `window.localStorage` under key `family-budget:mortgage-simulator:v1`. All financial and timeline math is performed purely client-side via pure calculation functions in `mortgage-engine.ts`.

Supabase is already connected via `DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_SECRET_KEY` with an existing sync migration (`supabase/migrations/0001_external_provider_sync.sql`).

## Goals / Non-Goals

**Goals:**
- Create a relational PostgreSQL table `mortgage_scenarios` in Supabase with explicit typed columns for property parameters, financing terms, overlap timeline, and milestone configurations.
- Support storing and managing multiple distinct property purchase scenarios (e.g. "Primary Option", "Plan B Wola", "Suburban House") with one designated as `is_primary`.
- Build a server-side data access layer in `src/server/mortgage/db.ts` and Next.js Server Actions for scenario CRUD.
- Upgrade `MortgageRepository` on the client to persist to Supabase asynchronously while maintaining `localStorage` as a fast offline read cache.
- Automatically import/seed existing `localStorage` settings into the initial primary scenario so existing user settings are never lost.
- Provide a scenario switcher bar and side-by-side scenario comparison matrix in the mortgage dashboard.

**Non-Goals:**
- Migrating other simulators (Offer Comparator, Runway, Time-Value) in this change; they will follow their own dedicated OpenSpec changes in sequence.
- Modifying the core financial calculation logic in `mortgage-engine.ts` (the mathematical formulas remain unchanged).

## Decisions

### 1. Relational Schema with Structured Columns vs. Opaque JSONB
- **Decision**: Use explicit relational columns for core queryable parameters (`area_sqm`, `price_per_sqm_pln`, `total_property_price_pln`, `down_payment_pct`, `loan_term_years`, `reference_rate_pct`, `bank_margin_pct`, `is_primary`, `installment_type`) rather than a single opaque JSON blob.
- **Rationale**: Enables analytical SQL queries, indexing, and future reporting without parsing JSON. Complex array configurations (like `linked_goal_category_ids`) are stored as PostgreSQL native `TEXT[]`.
- **Alternatives considered**:
  - *Opaque JSONB table*: Easier initial write, but defeats future analytical querying and validation.

### 2. Client Repository Synchronization & Offline Graceful Fallback
- **Decision**: Update `MortgageRepository` to load from Supabase via Server Actions / REST, while keeping `localStorage` updated as an immediate local read cache.
- **Rationale**: Eliminates page loading layout shifts (FOUC) and ensures that if a user opens the dashboard in an airplane/offline mode, their last active scenario remains immediately accessible.

### 3. Automatic Migration of Existing Browser Data
- **Decision**: When an authenticated user opens the simulator and the database returns zero scenarios for the household, the client automatically creates the first scenario in Supabase initialized with their existing `localStorage` data (or default config if empty) and marks it `is_primary = true`.
- **Rationale**: Seamless transition without losing customized numbers already configured by the user.

### 4. Side-by-Side Comparison UI
- **Decision**: Build a `MortgageScenarioComparisonDialog` component that loads multiple scenarios, feeds each through `computeMortgageAcquisition()`, `computeLoanFinancing()`, and `computeOverlapTimeline()`, and renders a side-by-side comparison table highlighting cost and timeline deltas.
- **Rationale**: Reuses the thoroughly tested pure functions in `mortgage-engine.ts` without duplicating calculation logic.

## Database Schema Design

```sql
CREATE TABLE IF NOT EXISTS mortgage_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Primary Plan',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Property Acquisition
  pricing_mode TEXT NOT NULL DEFAULT 'area_and_price_per_sqm', -- 'area_and_price_per_sqm' | 'total_price'
  area_sqm NUMERIC(8, 2) NOT NULL DEFAULT 65.0,
  price_per_sqm_pln NUMERIC(12, 2) NOT NULL DEFAULT 16000.0,
  custom_total_price_pln NUMERIC(14, 2) NOT NULL DEFAULT 1040000.0,
  include_parking BOOLEAN NOT NULL DEFAULT TRUE,
  parking_price_pln NUMERIC(12, 2) NOT NULL DEFAULT 45000.0,
  include_storage BOOLEAN NOT NULL DEFAULT TRUE,
  storage_price_pln NUMERIC(12, 2) NOT NULL DEFAULT 15000.0,
  renovation_budget_pln NUMERIC(12, 2) NOT NULL DEFAULT 150000.0,
  renovation_contingency_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.0,
  renovation_funding_mode TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'mortgage'
  bank_valuation_fee_pln NUMERIC(10, 2) NOT NULL DEFAULT 500.0,
  custom_notary_fee_pln NUMERIC(10, 2),

  -- Financing Terms
  down_payment_pct NUMERIC(5, 2) NOT NULL DEFAULT 20.0,
  loan_term_years INT NOT NULL DEFAULT 25,
  reference_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.15,
  bank_margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.85,
  rate_stress_delta_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  installment_type TEXT NOT NULL DEFAULT 'equal', -- 'equal' | 'decreasing'

  -- Construction & Overlap Timeline
  months_to_signing INT NOT NULL DEFAULT 6,
  construction_wait_months INT NOT NULL DEFAULT 18,
  finishing_overlap_months INT NOT NULL DEFAULT 3,
  current_monthly_rent_pln NUMERIC(12, 2) NOT NULL DEFAULT 3500.0,
  new_community_admin_fee_pln NUMERIC(12, 2) NOT NULL DEFAULT 900.0,
  avg_tranche_drawn_pct INT NOT NULL DEFAULT 50,

  -- Goal Tracking & Cashflow
  linked_goal_category_ids TEXT[] NOT NULL DEFAULT '{}',
  custom_monthly_net_income_fallback_pln NUMERIC(12, 2),
  lookback_window TEXT NOT NULL DEFAULT '6m',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mortgage_scenarios_primary ON mortgage_scenarios (is_primary);
CREATE INDEX IF NOT EXISTS idx_mortgage_scenarios_updated_at ON mortgage_scenarios (updated_at DESC);
```

## Risks / Trade-offs

- **[Risk] Multiple tabs or devices updating simultaneously**  
  *Mitigation*: Database updates use `updated_at = NOW()` and standard optimistic concurrency or re-fetch on scenario change.
- **[Risk] Network failure or unauthenticated access**  
  *Mitigation*: `MortgageRepository` wraps all remote calls with try/catch and maintains `localStorage` as a synchronized local cache so the dashboard never crashes.
