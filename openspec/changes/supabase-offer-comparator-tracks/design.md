# Technical Design: Supabase Relational Offer Comparator Tracks

## Context

See `proposal.md` for motivation. Currently, `LocalStorageOfferRepository` in `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository.ts` stores an entire `OfferComparatorStoragePayload` JSON blob in `window.localStorage` under key `family-budget:offer-comparator:v1`. The payload holds all offer tracks, revisions, benefit matrices, equity allocations, and global comparator assumptions.

## Goals / Non-Goals

**Goals:**
- Create normalized PostgreSQL tables `offer_tracks`, `offer_revisions`, and `offer_comparator_assumptions` in Supabase.
- Store structured columns for core compensation fields (`rate_amount`, `currency`, `period`, `contract_type`, `b2b_tax_regime`, `ryczalt_rate_pct`, `zus_stage`, `pfron_rebate_pct`) while storing complex nested arrays (`benefits`, `equity_grants`, `side_gigs`) in typed `JSONB` columns within the revision row.
- Add server-side data access in `src/server/offers/db.ts` and Server Actions for track and revision operations.
- Update `OfferRepository` to read/write from Supabase while maintaining `localStorage` as an offline cache.
- Automatically seed Supabase with legacy `localStorage` data if the database is unpopulated.

**Non-Goals:**
- Rewriting calculation engines in `offer-calculator.ts` or `tax-engine.ts`.
- Altering the Runway Simulator in this change (Runway linkage will happen in `supabase-runway-scenarios`).

## Database Schema Design

```sql
CREATE TABLE IF NOT EXISTS offer_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'negotiating', -- 'current' | 'negotiating' | 'past_accepted' | 'past_declined'
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES offer_tracks(id) ON DELETE CASCADE,
  revision_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Initial Offer',
  effective_date TEXT, -- 'YYYY-MM'
  
  -- Rate Specification
  rate_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rate_currency TEXT NOT NULL DEFAULT 'PLN',
  rate_period TEXT NOT NULL DEFAULT 'monthly', -- 'hourly' | 'monthly' | 'annual'
  
  -- Contract & Tax
  contract_type TEXT NOT NULL DEFAULT 'b2b', -- 'b2b' | 'uop' | 'uz' | 'uod'
  b2b_tax_regime TEXT NOT NULL DEFAULT 'ryczalt', -- 'ryczalt' | 'liniowy' | 'skala'
  ryczalt_tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 12.0,
  zus_stage TEXT NOT NULL DEFAULT 'pelny_zus',
  voluntary_sickness_insurance BOOLEAN NOT NULL DEFAULT FALSE,
  pfron_has_certificate BOOLEAN NOT NULL DEFAULT FALSE,
  pfron_rebate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  monthly_accounting_cost_pln NUMERIC(10, 2) NOT NULL DEFAULT 300.0,
  
  -- Time-Off Policy
  time_off_model TEXT NOT NULL DEFAULT 'model_b_combined',
  paid_vacation_days INT NOT NULL DEFAULT 26,
  paid_sick_days INT NOT NULL DEFAULT 5,
  sick_pay_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.0,
  paid_state_holidays INT NOT NULL DEFAULT 13,
  combined_pto_days INT NOT NULL DEFAULT 26,
  state_holidays_deducted_from_pool BOOLEAN NOT NULL DEFAULT FALSE,
  pto_rate_markup_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  
  -- Workload & Side-Gigs
  real_expected_weekly_hours INT NOT NULL DEFAULT 40,
  allows_side_gig BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Nested JSONB Payloads (benefits, equity, side-gigs)
  benefits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  equity_grants_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  side_gigs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_comparator_assumptions (
  id TEXT PRIMARY KEY DEFAULT 'default',
  fx_pessimistic_buffer_pct JSONB NOT NULL DEFAULT '{"USD": 0.05, "EUR": 0.03}'::jsonb,
  manual_fx_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_monthly_expense_pln NUMERIC(12, 2) NOT NULL DEFAULT 12000.0,
  target_monthly_savings_pln NUMERIC(12, 2) NOT NULL DEFAULT 5000.0,
  active_year_projection INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_revisions_track_id ON offer_revisions (track_id);
```

## Risks / Trade-offs

- **[Risk] Complex nested structures in revisions**  
  *Mitigation*: Benefits, equity grants, and side-gigs are persisted in typed JSONB columns inside each revision row, preserving full flexibility while exposing core compensation and tax rates as relational columns for analytical SQL querying.
- **[Risk] Data loss on initial migration**  
  *Mitigation*: The client auto-migrates existing `localStorage` state on first launch if Supabase has zero tracks.
