# Technical Design: Supabase Relational Budget Exclusion Presets

## Context

See `proposal.md` for motivation. Currently, `use-exclusion-presets.ts` in `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts` stores custom presets and the active preset key in `window.localStorage` under keys `family-budget:presets:v1` and `family-budget:active-preset:v1`.

## Goals / Non-Goals

**Goals:**
- Create a relational PostgreSQL table `budget_exclusion_presets` in Supabase.
- Store preset definitions with native PostgreSQL `TEXT[]` arrays for `income_deductions` and `expense_exclusions`.
- Support marking an active preset via an `is_active BOOLEAN` flag or household active preset pointer.
- Build server-side repository in `src/server/presets/db.ts` and Server Actions for preset CRUD.
- Adapt `use-exclusion-presets.ts` to sync with Supabase while caching locally.
- Automatically seed default presets and migrate existing custom `localStorage` presets into Supabase on first run.

**Non-Goals:**
- Changing the calculation logic in `expense-transforms.ts`.
- Redesigning the Preset Dialog UI components.

## Database Schema Design

```sql
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
```

## Risks / Trade-offs

- **[Risk] Tax & Rent category auto-detection on first run**  
  *Mitigation*: Default built-in presets dynamically detect Tax and Rent IDs from live ExternalProvider categories when seeded into Supabase.
- **[Risk] Offline load latency**  
  *Mitigation*: `use-exclusion-presets.ts` initializes synchronously from `localStorage` on client mount and reconciles with Supabase in the background.
