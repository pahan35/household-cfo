# Technical Design: Supabase Relational Time-Value Profiles & Weekly Logs

## Context

See `proposal.md` for motivation. Currently, `TimeValueRepository` in `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository.ts` stores a `TimeValueStoragePayload` JSON blob in `window.localStorage` under key `family-budget:time-value-motivator:v1`. The payload contains profiles for `me` and `wife`, pet projects, personal goals, and an array of `weeklyLogs`.

## Goals / Non-Goals

**Goals:**
- Create normalized PostgreSQL tables `time_value_profiles`, `time_value_goals`, and `time_value_weekly_logs` in Supabase.
- Treat `time_value_weekly_logs` as an append-friendly time series with structured columns for drift, joy, reclaimed hours, partner care hours, and bounties.
- Build a server-side data access layer in `src/server/lifestyle/time-value-db.ts` and Server Actions for CRUD operations.
- Update `TimeValueRepository` to sync with Supabase while caching locally.
- Automatically seed Supabase with legacy `localStorage` data if the database is initially empty.

**Non-Goals:**
- Rewriting calculation engines in `time-value-engine.ts`.
- Replacing the client-side interactive sliders with server-rendered forms.

## Database Schema Design

```sql
CREATE TABLE IF NOT EXISTS time_value_profiles (
  player TEXT PRIMARY KEY, -- 'me' | 'wife'
  target_hourly_rate_pln NUMERIC(10, 2) NOT NULL DEFAULT 150.0,
  daily_drift_target_hours NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  raw_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  learning_rate_growth_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_value_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  target_amount_pln NUMERIC(12, 2) NOT NULL,
  saved_amount_pln NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  owner_scope TEXT NOT NULL DEFAULT 'shared', -- 'me' | 'wife' | 'shared'
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_value_weekly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  player TEXT NOT NULL, -- 'me' | 'wife'
  
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
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_time_value_weekly_log UNIQUE (player, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_time_value_weekly_logs_date ON time_value_weekly_logs (week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_value_weekly_logs_player ON time_value_weekly_logs (player);
```

## Risks / Trade-offs

- **[Risk] Concurrent edits from both partners on Sunday**  
  *Mitigation*: The unique constraint on `(player, week_start_date)` allows `me` and `wife` to log entries for the same week independently without collision, using `ON CONFLICT (player, week_start_date) DO UPDATE`.
- **[Risk] Offline mobile log entry**  
  *Mitigation*: `TimeValueRepository` writes to `localStorage` immediately, then syncs to Supabase.
