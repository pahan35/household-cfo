-- Migration: 0004_runway_scenarios.sql
-- Description: Relational persistence for Runway & Income Loss Simulator scenarios and category austerity cuts

CREATE TABLE IF NOT EXISTS runway_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Baseline Austerity',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- JDG Statutory Obligations
  posture TEXT NOT NULL DEFAULT 'active', -- 'active' | 'wakacje_skladkowe' | 'suspended'
  regime TEXT NOT NULL DEFAULT 'b2b_ryczalt', -- 'b2b_ryczalt' | 'b2b_liniowy' | 'b2b_skala'
  zus_stage TEXT NOT NULL DEFAULT 'pelny_zus',
  voluntary_sickness BOOLEAN NOT NULL DEFAULT FALSE,
  ryczalt_ytd_health_tier TEXT NOT NULL DEFAULT 'tier2', -- 'tier1' | 'tier2' | 'tier3'
  pfron_rebate_json JSONB NOT NULL DEFAULT '{"hasDisabilityCertificate": false, "rebatePct": 0}'::jsonb,
  monthly_accounting_cost_pln NUMERIC(10, 2) NOT NULL DEFAULT 300.0,
  suspended_accounting_cost_pln NUMERIC(10, 2) NOT NULL DEFAULT 100.0,
  voluntary_nfz_when_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  statutory_voluntary_nfz_pln NUMERIC(10, 2) NOT NULL DEFAULT 700.0,
  wakacje_month_index INT NOT NULL DEFAULT 12,

  -- Month-1 Tax Tail
  include_month1_tax_tail BOOLEAN NOT NULL DEFAULT TRUE,
  month1_vat7_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  month1_ppe_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,

  -- Replacements & Secondary Income
  benefit_loss_replacement_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  residual_monthly_income_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,

  -- Capital Pool Configuration
  capital_pool_config_json JSONB NOT NULL DEFAULT '{"excludedItemIds": [], "includeOffBalanceAccounts": false, "includeGoals": true, "safetyFloorPln": 20000.0, "fxHaircutPct": 0}'::jsonb,

  -- Relational link to active compensation in offer_revisions
  baseline_offer_revision_id UUID REFERENCES offer_revisions(id) ON DELETE SET NULL,

  -- Analysis & Preset Options
  lookback_window TEXT NOT NULL DEFAULT '3m',
  active_preset_id TEXT NOT NULL DEFAULT 'preset-normal',
  custom_presets_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runway_category_cuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES runway_scenarios(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  retention_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
  is_included BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_runway_category_cuts_scenario_category UNIQUE (scenario_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_runway_scenarios_primary ON runway_scenarios (is_primary);
CREATE INDEX IF NOT EXISTS idx_runway_scenarios_updated_at ON runway_scenarios (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runway_scenarios_baseline_offer ON runway_scenarios (baseline_offer_revision_id);
CREATE INDEX IF NOT EXISTS idx_runway_category_cuts_scenario_id ON runway_category_cuts (scenario_id);
