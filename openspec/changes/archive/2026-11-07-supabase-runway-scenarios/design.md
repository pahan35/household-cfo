# Technical Design: Supabase Relational Runway Scenarios

## Context

See `proposal.md` for motivation. Currently, `RunwayRepository` in `src/app/(main)/dashboard/family-budget/runway/_components/runway-repository.ts` stores a `RunwaySimulatorStoragePayload` JSON blob in `window.localStorage` under key `family-budget:runway-simulator:v1`. It also cross-reads the Offer Comparator's `localStorage` key to retrieve active baseline income.

## Goals / Non-Goals

**Goals:**
- Create normalized PostgreSQL tables `runway_scenarios` and `runway_category_cuts` in Supabase.
- Link `runway_scenarios.baseline_offer_revision_id` directly to `offer_revisions.id` (created in Change 2), establishing a true relational connection between career earnings and emergency runway projections.
- Store structured columns for statutory JDG postures (`active`, `suspended`, `wakacje_skladkowe`), tax regimes, ZUS stages, Month-1 tax tails, and capital pool safety floors.
- Build server-side repository in `src/server/runway/db.ts` and Server Actions for scenario CRUD.
- Adapt `RunwayRepository` to sync with Supabase while caching locally.
- Add a scenario selector toolbar in the runway dashboard.

**Non-Goals:**
- Altering the mathematical logic in `runway-engine.ts`.
- Rewriting ExternalProvider `/stat/ping` spending history extraction.

## Database Schema Design

```sql
CREATE TABLE IF NOT EXISTS runway_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Baseline Austerity',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- JDG Statutory Obligations
  posture TEXT NOT NULL DEFAULT 'active', -- 'active' | 'wakacje_skladkowe' | 'suspended'
  regime TEXT NOT NULL DEFAULT 'b2b_ryczalt',
  zus_stage TEXT NOT NULL DEFAULT 'pelny_zus',
  voluntary_sickness BOOLEAN NOT NULL DEFAULT FALSE,
  ryczalt_ytd_health_tier TEXT NOT NULL DEFAULT 'tier2',
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
  
  -- Relational link to active compensation
  baseline_offer_revision_id UUID REFERENCES offer_revisions(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runway_category_cuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES runway_scenarios(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  retention_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
  is_included BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runway_scenarios_primary ON runway_scenarios (is_primary);
CREATE INDEX IF NOT EXISTS idx_runway_category_cuts_scenario_id ON runway_category_cuts (scenario_id);
```

## Risks / Trade-offs

- **[Risk] Offer revisions table might not be present if migrations run out of order**  
  *Mitigation*: The foreign key `baseline_offer_revision_id` uses `REFERENCES offer_revisions(id) ON DELETE SET NULL`, and migration order is strictly enforced via numbered SQL migrations.
- **[Risk] Offline editing**  
  *Mitigation*: `RunwayRepository` keeps `localStorage` in sync as a local cache.
