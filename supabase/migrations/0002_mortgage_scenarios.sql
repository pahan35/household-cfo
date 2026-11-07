-- Migration: 0002_mortgage_scenarios.sql
-- Description: Schema for multi-scenario mortgage and property acquisition simulator

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
