-- Migration: 0003_offer_comparator_tracks.sql
-- Description: Relational persistence for Offer Comparator tracks, revisions, and global assumptions

CREATE TABLE IF NOT EXISTS offer_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'negotiating', -- 'current' | 'negotiating' | 'past_accepted' | 'past_declined'
  sort_order INT NOT NULL DEFAULT 0,
  active_revision_id UUID,
  notes TEXT,
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
  tax_profile_json JSONB,

  -- Time-Off Policy
  time_off_model TEXT NOT NULL DEFAULT 'model_b_combined',
  paid_vacation_days INT NOT NULL DEFAULT 26,
  paid_sick_days INT NOT NULL DEFAULT 5,
  sick_pay_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.0,
  paid_state_holidays INT NOT NULL DEFAULT 13,
  combined_pto_days INT NOT NULL DEFAULT 26,
  state_holidays_deducted_from_pool BOOLEAN NOT NULL DEFAULT FALSE,
  pto_rate_markup_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  time_off_json JSONB,

  -- Workload & Side-Gigs
  real_expected_weekly_hours INT NOT NULL DEFAULT 40,
  allows_side_gig BOOLEAN NOT NULL DEFAULT TRUE,

  -- Nested JSONB Payloads (benefits, equity, side-gigs)
  benefits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  equity_grants_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  side_gigs_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  notes TEXT,
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
  default_working_days_per_year INT NOT NULL DEFAULT 252,
  default_state_holidays_count INT NOT NULL DEFAULT 13,
  working_hours_per_day INT NOT NULL DEFAULT 8,
  annual_static_cost_growth_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.07,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_revisions_track_id ON offer_revisions (track_id);
CREATE INDEX IF NOT EXISTS idx_offer_tracks_updated_at ON offer_tracks (updated_at DESC);
