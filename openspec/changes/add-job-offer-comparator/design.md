# Design

## Context

The Family Budget application (`src/app/(main)/dashboard/family-budget/`) already ingests live ExternalProvider categories, multi-currency exchange rates (`ExchangeKey.Currency`), 40-month category spend series (`stat/ping`), and full transaction histories (`api/transaction/get`). It also includes pure analytical engines for tax tag auditing and PFRON `"Cashback taxes"` ZUS contra-rebates (`tax-transforms.ts`), GUS CPI inflation deflation and NBP USD/PLN sensitivity (`macro-data.ts`, `macro-transforms.ts`), and wellness/learning tag cadence (`lifestyle-transforms.ts`).

To support comparing disparate job offers, evaluating current-company compensation/benefit restructures (e.g., PLN-to-USD switch with a rate raise but losing spouse health coverage), benchmarking past offers with annual raises in CPI-adjusted terms, and quoting recruiters on the spot, we need a pure, testable domain engine paired with a `localStorage` repository and an interactive comparator UI at `/dashboard/family-budget/offer-comparator`.

## Goals / Non-Goals

**Goals:**
- Provide a pure, zero-React-dependency calculation layer (`compensation-engine.ts`, `polish-tax-engine.ts`, `reverse-recruiter-solver.ts`, `benefit-matcher.ts`) with full unit test coverage.
- Model **Offer Tracks & Chronological Revisions** (`OfferTrack` -> `OfferRevision[]`) so users can compare both distinct employers (Baseline vs. Offer A vs. Offer B) and internal company amendments (`Rev 1: PLN + Family Health` -> `Rev 2: USD + Individual Health`) or historical career progressions (`Year 1` -> `Year 2` raise, CPI-adjusted to today).
- Accurately model Polish B2B (`Ryczałt`, `Liniowy`, `Skala`), `UoP` (`50% AKUP`, `PPK`, `30x` ZUS cap, progressive PIT), and `Custom` tax regimes across a 1–3 year horizon, including **PFRON B2B ZUS cash rebates vs. UoP statutory disability rights** (`35h/week` norm, `+10` paid vacation days).
- Connect benefits to live ExternalProvider category & tag streams (`#wife`, `#dentist`, `#pharmacy`, `#consult`, `#exams`, `#gym`, `#multisport`, `#pilates`) for two-layer valuation (Hard Budget Offset vs. Subjective Utility Weight).
- Solve backwards from Target Net Monthly Cashflow to Required Gross Rate across all contract types and currencies (`PLN`, `USD`, `EUR`) in `< 1 ms` using a monotone binary search solver.

**Non-Goals:**
- Mutating upstream ExternalProvider categories or transactions from the Offer Comparator (all ExternalProvider reads in the Offer Comparator are read-only; tag remediation continues to live in the Health & Sport and Income & Taxes audit queues).
- Adding an external database or backend API route for storing offers in this phase (all persistence uses `OfferRepository` backed by `localStorage` + JSON import/export).

## Decisions

### 1. Track + Revision Data Model (`OfferTrack` & `OfferRevision`)
- **Decision**: Structure saved compensation data as `OfferTrack` entities (representing a company/role with status `current`, `negotiating`, `past_accepted`, `past_declined`), each holding an ordered array of `OfferRevision` snapshots (with `effectiveDate`, `rateSpec`, `timeOff`, `taxProfile`, `benefits`, `equityGrants`, `sideGig`).
- **Rationale**: A flat `Offer` list makes it awkward to represent *"My current company moved me from PLN to USD and dropped my wife from Health Insurance"* or *"At my previous company I got an hourly raise after 12 months."* With `OfferTrack` -> `OfferRevision[]`:
  - The **Comparison Matrix** can compare the active revision of multiple tracks OR compare `Rev 1` vs. `Rev 2` within the same track (**Restructure / Amendment Diff Mode**).
  - Past tracks with historical `effectiveDate` values (e.g., `"2023-03"`, `"2024-03"`) automatically pipe their historical nominal net PLN through `calculateRealValue(nominalPln, effectiveMonthKey, latestMonthKey)` from `macro-transforms.ts` to show **Real Today Purchasing Power**.
- **Alternatives Considered**: Storing every revision as an unrelated top-level offer card. Rejected because it loses the parent-child relationship needed to compute automatic Restructure Impact Diffs (`+Base Rate Delta`, `-FX Buffer Drag`, `-Benefit Tier Downgrade Loss`).

### 2. Polish Tax, Multi-Year ZUS & PFRON B2B-vs-UoP Engine
- **Decision**: Implement `computePolishTaxProjection(revision, globalConfig, yearIndex)` as a deterministic annual-to-monthly pipeline supporting `yearIndex: 1 | 2 | 3`:
  - **B2B Ryczałt**:
    - Annual revenue $R$ in PLN (after FX conversion & pessimistic buffer).
    - ZUS Społeczny determined by stage for that year (`ulga_na_start` = `0`, `preferencyjny` = reduced base, `duzy_zus` = standard base, inflated by `(1 + annualStaticCostGrowthPct)^(year - 1)`).
    - **PFRON ZUS Rebate**: Credits `pfronRebatePct` (`0%`, `30%`, `60%`, `100%`) or explicit monthly PLN against mandatory pension/disability ZUS Społeczny. Because PFRON refunds a percentage of ZUS Społeczny, the rebate automatically scales up in Years 2–3 when ZUS bases inflate.
    - **Składka Zdrowotna**: Tiered by annual revenue (`<= 60,000 PLN`, `60,000–300,000 PLN`, `> 300,000 PLN`), inflated by the annual ZUS/average-wage growth slider.
    - **PIT (Ryczałt)**: `ryczaltRatePct` applied to `(Revenue - ZUS_Spoleczny - 0.5 * Zdrowotna)`.
  - **UoP (Umowa o Pracę)**:
    - Month-by-month cumulative simulation (12 months) so the **30x ZUS Emerytalno-Rentowy cap**, the **120,000 PLN 50% AKUP deduction cap**, and the **120,000 PLN 12% -> 32% PIT bracket threshold** trigger at the exact month they are crossed.
    - **PFRON / Disability on UoP**: Sets direct employee PFRON ZUS cashback to `0 PLN` (highlighting the lost B2B rebate if comparing against a B2B baseline), and when `uopDisabilityRightsEnabled` is active, sets statutory fulltime norm to `7h/day` (`35h/week`) and adds `+10` paid vacation days/year.
- **Rationale**: Month-by-month simulation for UoP is only 12 loop iterations per year, runs in microseconds, and avoids inaccurate annual averaging around the 30x ZUS cap, 50% AKUP cap, and 32% PIT threshold.

### 3. Reverse Recruiter Solver via Monotone Binary Search
- **Decision**: Implement `solveRequiredGrossForTargetNet(targetNetMonthlyPln, contractScenario, globalConfig)` using a 28-step binary search over `annualGrossPln` in `[0, 5_000_000]` calling the forward `computePolishTaxProjection` engine.
- **Rationale**: Because B2B Ryczałt has step-function discontinuities at `60k PLN` and `300k PLN` revenue (where crossing `300k PLN` causes a lump-sum annual retroactive jump in Składka Zdrowotna) and UoP has piecewise kinks at the 30x ZUS cap, 120k AKUP cap, and 120k PIT bracket, closed-form algebraic inversion is brittle. Binary search uses the exact same forward tax engine (single source of truth) and converges to `< 0.01 PLN` precision in 28 iterations (`< 0.1 ms`).

### 4. Two-Layer ExternalProvider Benefit Matcher & Lifestyle Tag Taxonomy
- **Decision**:
  1. Extend `lifestyle-transforms.ts` tag recognition with:
     - **Person / Scope tags**: `#wife`, `#partner`, `#family`, `#me`
     - **Medical coverage tags**: `#consult`, `#exams`, `#vaccine`, `#insurance` (corporate-plan-eligible) vs. `#dentist`, `#pharmacy`, `#physio` (typically out-of-pocket)
     - **Sport coverage tags**: `#gym`, `#multisport` (MultiSport-eligible) vs. `#pilates` (out-of-pocket `10x` passes)
  2. In `benefit-matcher.ts`, compute trailing monthly spend per unified category (`Medicine`, `Sport`, `Mental Health`, `Massage`, `Learning`) split into `coveredPrimaryPln`, `coveredSpousePln`, and `outOfPocketPln`.
  3. Model each `BenefitItem` with:
     - `monthlyBudgetOffsetPln` (Layer 1: hard reduction in household cash outflow, capped or guided by ExternalProvider covered spend, minus any `spouseCopayMonthlyPln` or lost `#wife` coverage when downgraded to `individual` tier).
     - `subjectiveUtilityWeightPct` (`0–100%`, Layer 2: applied to non-offset nominal benefit value).

### 5. Storage Architecture (`OfferRepository`)
- **Decision**: Define an asynchronous-ready `OfferRepository` interface with a concrete `LocalStorageOfferRepository` implementation keyed at `"family-budget:offer-comparator:v1"`, seeded on first load with sensible templates (Current B2B Baseline template, UoP with AKUP template, Foreign USD Hourly B2B template) and equipped with JSON Export/Import and Zod/structural validation.

## Risks / Trade-offs

- **[Risk] B2B Ryczałt 60k / 300k PLN Health Insurance Cliff** → Crossing `300,000 PLN` annual revenue by `100 PLN` increases annual Składka Zdrowotna by several thousand PLN (a brief non-monotonic notch in net income). **Mitigation**: The comparator and Side-Gig Simulator will explicitly badge when an offer or side-gig sits within `5%` of or just above the `60k` / `300k PLN` Ryczałt health tier cliff and show the exact cost of crossing the threshold.
- **[Risk] Untagged Historical Medical/Sport Transactions in ExternalProvider** → Not all historical `Medicine` transactions will have `#wife` or `#dentist` tags initially. **Mitigation**: Provide a fallback slider/percentage in the benefit card (e.g., *"Estimate covered medical share %"* and *"Explicit spouse add-on co-pay PLN/mo"*) alongside the live tag-derived breakdown, and surface the new tags in the Health & Sport inline audit queue.
