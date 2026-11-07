-- Migration: 0005_time_value_weekly_logs.sql
-- Description: Relational persistence for Time & Opportunity Motivator dual-player profiles, personal goals, and weekly logs

CREATE TABLE IF NOT EXISTS time_value_profiles (
  player TEXT PRIMARY KEY CHECK (player IN ('me', 'wife')),
  target_hourly_rate_pln NUMERIC(10, 2) NOT NULL DEFAULT 150.0,
  daily_drift_target_hours NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  learning_rate_growth_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.0,
  raw_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pet_projects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_value_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  target_amount_pln NUMERIC(12, 2) NOT NULL,
  saved_amount_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  owner_scope TEXT NOT NULL DEFAULT 'shared' CHECK (owner_scope IN ('me', 'wife', 'shared')),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  target_date DATE,
  raw_goal_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_value_weekly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  player TEXT NOT NULL CHECK (player IN ('me', 'wife')),

  -- Screen Time Breakdown
  total_screen_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  joyful_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  drift_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,

  -- Reallocation & Investments
  reclaimed_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  side_hustle_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  learning_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  proper_relax_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  partner_care_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.0,

  -- Monikers & Value
  spouse_bounties_earned_pln NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  monetized_value_pln NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  reflections TEXT,

  -- Full snapshot of weekly reflections & celebration notes
  raw_entry_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_time_value_weekly_log UNIQUE (player, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_time_value_weekly_logs_date ON time_value_weekly_logs (week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_value_weekly_logs_player ON time_value_weekly_logs (player);
CREATE INDEX IF NOT EXISTS idx_time_value_goals_owner ON time_value_goals (owner_scope);
CREATE INDEX IF NOT EXISTS idx_time_value_goals_completed ON time_value_goals (is_completed);
