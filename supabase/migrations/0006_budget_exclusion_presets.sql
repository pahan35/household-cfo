-- Migration: 0006_budget_exclusion_presets.sql
-- Description: Relational persistence for budget exclusion presets and active preset selection

CREATE TABLE IF NOT EXISTS budget_exclusion_presets (
  id TEXT PRIMARY KEY, -- 'all-activity' | 'net-living' | 'controllable-expenses' | custom UUID
  name TEXT NOT NULL,
  income_deductions TEXT[] NOT NULL DEFAULT '{}',
  expense_exclusions TEXT[] NOT NULL DEFAULT '{}',
  is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_exclusion_presets_active ON budget_exclusion_presets (is_active);
CREATE INDEX IF NOT EXISTS idx_budget_exclusion_presets_sort_order ON budget_exclusion_presets (sort_order ASC);
