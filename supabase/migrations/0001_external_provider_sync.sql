-- Migration: 0001_external_provider_sync.sql
-- Description: Schema for ExternalProvider persistent sync engine (config, categories, transactions, stat points)

-- 1. Household Sync Configuration & Watermark State
CREATE TABLE IF NOT EXISTS ext_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sync_version BIGINT NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'syncing' | 'reconciling' | 'error'
  last_synced_at TIMESTAMPTZ,
  last_warm_reconcile_at TIMESTAMPTZ,
  last_full_reconcile_at TIMESTAMPTZ,
  last_cron_run_at TIMESTAMPTZ,
  last_error TEXT,
  watermark_tx_ticks BIGINT NOT NULL DEFAULT 0,
  hot_pull_months INT NOT NULL DEFAULT 3,           -- Configurable: 1, 3, 6, 12
  auto_poll_interval_minutes INT NOT NULL DEFAULT 0, -- Configurable: 0 (Off), 5, 15, 60
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  currencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categories & Accounts (ExchangeKey.Category = 2)
CREATE TABLE IF NOT EXISTS ext_categories (
  id TEXT PRIMARY KEY,
  category_type INT NOT NULL,
  name TEXT NOT NULL,
  currency_id TEXT,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Transactions Ledger
CREATE TABLE IF NOT EXISTS ext_transactions (
  id TEXT PRIMARY KEY,
  date_timestamp BIGINT NOT NULL,
  date_iso TEXT,
  updated_ticks BIGINT NOT NULL DEFAULT 0,
  source_id TEXT,
  destination_id TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ext_transactions_date_ts ON ext_transactions (date_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ext_transactions_updated_ticks ON ext_transactions (updated_ticks DESC);

-- 4. Monthly Budget Statistics Points (/stat/ping)
CREATE TABLE IF NOT EXISTS ext_stat_points (
  month_key TEXT PRIMARY KEY, -- Canonical 'YYYY-MM-01'
  period_params_json JSONB,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
