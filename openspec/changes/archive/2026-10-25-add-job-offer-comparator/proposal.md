# Proposal

## Why

Recruiters frequently request salary expectations before disclosing contract structure, paid time off (PTO), tax regime, or benefit coverage, while comparing multiple job offers—or evaluating a compensation/benefit restructure at a current company or progression at a past employer—requires normalizing wildly different mechanisms (Hourly vs. Monthly vs. Annual, PLN/USD/EUR, B2B vs. UoP, PFRON ZUS rebates, and Individual vs. Family benefit tiers) against our real ExternalProvider family budget. Without a dedicated normalization, tax, and benefit valuation engine integrated with ExternalProvider expense categories and historical CPI/FX data, it is difficult to know the true Net Monthly Cashflow, Effective Net Hourly Rate, or required gross rate to quote a recruiter.

## What Changes

- **New Offer Comparator Route (`/dashboard/family-budget/offer-comparator`)**: Adds a dedicated "Offer Comparator" screen under the "Family Budget" navigation group in `sidebarItems`, directly below "Income & Taxes".
- **Offer Tracks, Restructure Revisions & Historical Career Archive**:
  - Models employer/role tracks (`current`, `negotiating`, `past_accepted`, `past_declined`) containing chronological revisions (e.g., `Rev 1: PLN Baseline + Family Health` -> `Rev 2: USD Raise + Individual Health`, or Year 1 -> Year 2 hourly rate raises at past companies).
  - Computes a **Restructure / Revision Impact Diff** isolating base rate gains, FX spread/buffer drag, and benefit tier downgrade penalties (such as losing spouse health coverage).
  - Normalizes past offers with historical `effectiveDate` to today's purchasing power using cumulative Polish CPI and historical NBP USD/PLN rates (`macro-transforms.ts`).
- **Compensation & Time-Off Normalization Engine**:
  - Normalizes Hourly, Monthly, and Annual rates across `PLN`, `USD`, and `EUR` using live ExternalProvider FX rates (`ExchangeKey.Currency`) with per-currency pessimistic buffer sliders and manual rate overrides.
  - Supports three Time-Off Models based on ~252 working days/year and ~13 Polish weekday state holidays: Model A (Separate vacation + sick + holiday pools), Model B (Combined PTO pool with holiday inclusion/deduction toggle), and Model C (Unpaid / Pure Hourly B2B with optional PTO markup formula).
- **Pluggable Polish Tax, Multi-Year ZUS & PFRON Engine**:
  - Supports **B2B Ryczałt** (configurable 8.5%/12%/15% with 3-tier Składka Zdrowotna at `<60k`, `60k–300k`, `>300k PLN`, 50% health deduction, and accounting cost), **B2B Liniowy** (19% + 4.9% Zdrowotna), **B2B Skala** (12%/32% + 9% Zdrowotna), **UoP** (13.71% employee ZUS with 30x cap, 9% NFZ, 12%/32% PIT with 30k tax-free allowance, PPK, and 50% AKUP author's copyright deduction up to 120k PLN cap), and a **Custom Fallback Formula** (`% Gross + Static Monthly Cost`).
  - Projects a **1–3 Year Horizon** accounting for ZUS stage transitions (`Ulga na start` -> `Preferencyjny ZUS` -> `Duży ZUS`) and annual ZUS base inflation.
  - Models **PFRON & Disability Rules across B2B vs. UoP**: accounts for direct PFRON ZUS Społeczny cash rebates (`"Cashback taxes"`) on B2B (scaling with ZUS base inflation) versus UoP transition effects (0 direct PFRON cash rebate, optional statutory 35h/week norm and +10 extra paid vacation days).
- **Two-Layer Benefit & Equity Valuation with ExternalProvider Category/Tag Intelligence**:
  - Evaluates modular benefits (Learning, Health/Medical Individual vs. Family tier, Sport/Wellness, Lunch cards, Gift cards, Equipment stipends, Sabbatical, Bonuses) across two layers: **Layer 1: Hard Budget Offset** (replaces actual ExternalProvider category/tag spend) and **Layer 2: Subjective Utility Weight (0–100%)** (separating "Hard Monthly Cashflow" from "Total Perceived Comp").
  - Models **Spouse / Family Benefit Downgrade Cost** (either an explicit monthly spouse add-on co-pay or uncovered `#wife` medical spend from ExternalProvider).
  - Models **Equity Grants**: Liquid public RSUs (vesting schedule, cliff, volatility discount %, 19% Belka tax) vs. illiquid ESOP/Stock Options (excluded from monthly budget cashflow).
- **Enhanced Wellness & Medical Tag Taxonomy**:
  - Extends ExternalProvider lifestyle/wellness category and tag analysis to distinguish person/scope tags (`#wife`, `#partner`, `#family`, `#me`) and coverage-specific sub-tags (`#dentist`, `#pharmacy`, `#consult`, `#exams`, `#gym`, `#multisport`, `#pilates`) so the benefit matcher can separate corporate-package-covered spend from out-of-pocket spend.
- **Part-Time / Side-Gig Capacity Simulator**:
  - Simulates adding a fractional B2B/consulting gig alongside a primary offer based on real weekly hour load, non-compete/exclusivity flags, shared fixed ZUS (already covered by primary B2B/UoP), and tax/health threshold spillover (`>60k`/`>300k PLN` Ryczałt health tiers or `>120k PLN` Skala/UoP bracket).
- **Reverse Recruiter Quick-Quote Calculator & LocalStorage Repository**:
  - Solves backwards from a Target Net Monthly Cashflow (ExternalProvider controllable/total expenses + monthly savings goal) to display a simultaneous cheat-sheet of required gross rates across B2B Hourly (0 PTO vs. Paid PTO), B2B Monthly, and UoP (0% vs. 50% AKUP) in `PLN`, `USD`, and `EUR`.
  - Persists all offer tracks, revisions, and global comparator settings in `localStorage` behind a clean Repository/Adapter interface with JSON Export/Import.

## Capabilities

### New Capabilities
- `job-offer-comparator`: End-to-end job offer & compensation normalization, multi-revision employer tracks and historical CPI-adjusted career archive, Polish B2B/UoP/PFRON multi-year tax engine, two-layer ExternalProvider benefit & equity valuation, fractional side-gig capacity simulator, reverse recruiter quick-quote solver, and localStorage repository with JSON export/import.

### Modified Capabilities
- `wellness-and-learning-cadence`: Extend wellness, medical, and sport tag classification and inline audit suggestions with person/scope tags (`#wife`, `#partner`, `#family`) and coverage sub-tags (`#dentist`, `#pharmacy`, `#consult`, `#gym`, `#multisport`) to compute corporate benefit offset ceilings and spouse coverage deltas.

## Impact

- **Navigation & Routes**:
  - `src/navigation/sidebar/sidebar-items.ts`: Add "Offer Comparator" (`/dashboard/family-budget/offer-comparator`).
  - `src/app/(main)/dashboard/family-budget/offer-comparator/page.tsx`: New Server Component route shell.
- **Feature Components & Domain Modules**:
  - `src/app/(main)/dashboard/family-budget/offer-comparator/_components/`: Pure calculation engines (`compensation-engine.ts`, `polish-tax-engine.ts`, `reverse-recruiter-solver.ts`, `benefit-matcher.ts`), persistence adapter (`offer-repository.ts`), and interactive dashboard views.
  - `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`: Enhanced tag taxonomy and benefit-coverage stream breakdown for medical/sport categories.
- **Dependencies & Storage**:
  - Zero new external npm dependencies; uses existing shadcn/ui primitives, Recharts, Lucide icons, ExternalProvider client caches, and browser `localStorage`.
