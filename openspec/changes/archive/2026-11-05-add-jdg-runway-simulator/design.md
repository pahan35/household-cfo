# Design

## Context

See `proposal.md` for motivation and scope. The Family Budget dashboard currently separates its concerns across four primary domains:
- `/dashboard/family-budget` (`external-provider-data.ts`): Live account balances (`Account`, `BankAccount`, `DebtAccount`, `exceptFromBalance` savings accounts) and multi-currency conversion (`ExchangeKey.Currency`).
- `/dashboard/family-budget/budget-overview` (`expense-transforms.ts`, `use-exclusion-presets.ts`): 40-month `/stat/ping` category spending history, smart multi-currency and Transport/Taxi rollups (`groupSmartSlices`), and exclusion presets (`Controllable Expenses`).
- `/dashboard/family-budget/income` (`tax-transforms.ts`): Tag-based tax classification (`#PPE`, `#VAT-7`, `#zus`, `#health`) and PFRON `"Cashback taxes"` contra-rebates.
- `/dashboard/family-budget/offer-comparator` (`polish-tax-engine.ts`, `offer-repository.ts`): Statutory Polish B2B Ryczałt/Liniowy/Skala ZUS stages (`STATUTORY_DEFAULTS`), 3-tier annual Ryczałt `Składka Zdrowotna`, PFRON rebate calculations, and saved employer compensation tracks in `localStorage`.

Because an income-loss runway calculation synthesizes all four domains simultaneously, co-locating it under a dedicated route `/dashboard/family-budget/runway` keeps existing reporting screens uncluttered while reusing the shared client cache (`external-provider-client.ts`) and statutory tax constants.

## Goals / Non-Goals

**Goals:**
- Provide a pure, deterministic monthly cashflow projection engine (`runway-engine.ts`) that models up to 60 months (5 years) of post-income-loss depletion with calendar-month awareness (specifically handling Month-1 `#VAT-7`/`#PPE` lag and the January 1 Ryczałt `Składka Zdrowotna` Tier 2/3 -> Tier 1 step-down).
- Seed statutory JDG settings from the user's active `"current"` track in `OfferRepository` (`localStorage`) when present, with zero-config fallbacks (`Duży ZUS`, Ryczałt `Tier 2`, voluntary sickness).
- Prevent double-counting of taxes by stripping dedicated tax categories (`findTaxCategories` / `getTaxCategoryIds` from `tax-transforms.ts` and `activePreset.incomeDeductions`) from the historical category burn matrix and replacing them with the explicit statutory JDG zero-revenue engine.
- Provide responsive, accessible category-level austerity controls (checkbox + `0%–150%` slider per smart-grouped category) with `localStorage` persistence for multiple named austerity presets.

**Non-Goals:**
- Mutating upstream ExternalProvider categories, account balances, or transactions from the Runway Simulator (this screen is strictly read-only against `/api/external-provider/...` and persists simulation state only in `localStorage`).
- Full Polish tax-return (PIT-28 / PIT-36L) annual reconciliation or overpayment refund modeling beyond the monthly cashflow obligations and Month-1 `#VAT-7`/`#PPE` settlement tail.

## Decisions

### 1. Dedicated Route Co-location (`/dashboard/family-budget/runway`)
- **Choice**: Create `src/app/(main)/dashboard/family-budget/runway/page.tsx` (Server Component shell) and `src/app/(main)/dashboard/family-budget/runway/_components/*` (Client Components, pure engine, and unit tests).
- **Rationale**: Follows the co-location architecture of `offer-comparator` and `fx-inflation`. Avoids overloading `income` or `budget-overview` with 20+ category sliders and multi-year depletion charts.
- **Alternatives considered**: Embedding as a tab inside `/dashboard/family-budget/income` (rejected because `income` focuses on historical tax auditing and lacks category spending presets and account pool selectors).

### 2. Calendar-Aware Month-by-Month Statutory JDG Projection Engine
- **Choice**: Build a pure `projectRunwayScenario()` function that steps month-by-month (`m = 1..60`) starting from a reference `startYearMonth` (`YYYY-MM`):
  - **Month 1 (`m === 1`)**: Deducts `month1TaxTailPln` (`month1Vat7Pln + month1PpePln`, auto-seeded from the latest active month's `#VAT-7` and `#PPE` totals via `aggregateTaxesByTag`) when `includeMonth1TaxTail` is enabled.
  - **Every Month (`m >= 1`)**:
    - If posture is `suspended`: `netZusPln = 0`, `healthPln = voluntaryNfzWhenSuspended ? statutoryVoluntaryNfz : 0`, `accountingPln = suspendedAccountingCostPln`.
    - If posture is `active` or `wakacje_skladkowe`:
      - Computes `getMonthlyZusSpoleczny(zusStage, voluntarySickness, inflationMultiplier)` and `computeMonthlyPfronRebate(pfronRebate, pensionDisability)` from `polish-tax-engine.ts`.
      - If `wakacje_skladkowe` is enabled and the projected calendar month matches the designated holiday month (1 month per calendar year, default December/November), sets `grossZusPln = 0` and `pfronRebatePln = 0` for that month.
      - Computes `Składka Zdrowotna`: for `b2b_ryczalt`, uses the user's configured current-year YTD tier (`tier1`, `tier2`, or `tier3`) for all remaining months of the starting calendar year (`month <= 12`), and automatically switches to `STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY` starting in January of the following calendar year (since zero JDG revenue in the new year keeps annual revenue `<= 60,000 PLN`).
- **Rationale**: Directly reuses `STATUTORY_DEFAULTS`, `getMonthlyZusSpoleczny`, and `computeMonthlyPfronRebate` from `polish-tax-engine.ts` so statutory numbers stay single-sourced across the app.

### 3. Category Burn Aggregation & Smart-Group Rollup Without Tax Double-Counting
- **Choice**: Compute historical category averages over the chosen lookback window (`3m`, `6m`, `12m`, or `1m`) from `/stat/ping` points:
  1. Filter out `CategoryType.Income`, account categories, and all tax category IDs (`getTaxCategoryIds(categories)` unioned with `activePreset.incomeDeductions`).
  2. Average each expense category's monthly spend across the lookback window (dividing total window spend by the number of evaluated months so lumpy categories like quarterly insurance or trips are amortized fairly).
  3. Pass the resulting slices through `groupSmartSlices` (`expense-transforms.ts` with `thresholdPercent = 0` so no categories are hidden inside `"Other Categories"`) to unite multi-currency pairs (e.g., `Medicine` + `Medicine UAH`) and `Transport (incl. Taxi)`.
  4. Tag each row as `fixed` (if its category ID or any child ID is in `activePreset.expenseExclusions`) or `controllable`, and apply the user's per-row retention weight (`0%` when unchecked, or `0%–150%` slider value).
- **Rationale**: Dividing by the full lookback window count (`N` months) rather than only non-zero months captures the true monthly run-rate of periodic expenses, while `thresholdPercent = 0` ensures every active category is individually controllable via its own slider.

### 4. LocalStorage Scenario & Preset Repository (`runway-repository.ts`)
- **Choice**: Persist a versioned payload under `family-budget:runway-simulator:v1` containing:
  - Capital pool selection (`excludedAccountIds`, `includeOffBalanceAccounts`, `includeGoals`, `safetyFloorPln`, `fxHaircutPct`).
  - Statutory JDG configuration (`posture`, `regime`, `zusStage`, `voluntarySickness`, `ryczaltYtdHealthTier`, `pfronRebate`, `monthlyAccountingCostPln`, `includeMonth1TaxTail`, `month1Vat7OverridePln`, `month1PpeOverridePln`, `benefitLossReplacementPln`, `residualMonthlyIncomePln`).
  - Category austerity presets (e.g., `"Baseline (100%)"`, `"Moderate Cut"`, `"Survival Mode"`) storing `Record<categoryGroupId, { enabled: boolean; retentionPct: number }>`.
- **Rationale**: Mirrors `offer-repository.ts` and `use-exclusion-presets.ts` so user customizations survive reloads and work offline after initial ExternalProvider fetch.

## Risks / Trade-offs

- **[Risk] Double-counting taxes if a user's tax category has a non-standard name** → **Mitigation**: Union regex-detected tax categories (`getTaxCategoryIds`) with the active preset's `incomeDeductions` list, and badge any excluded tax categories in a small info footer so the user can verify what was stripped before statutory JDG obligations were added.
- **[Risk] Multi-currency category averages drifting if `/stat/ping` reports native currency values for foreign categories** → **Mitigation**: Use the same `detectSliceCurrency` + `convertCurrencyAmount` normalization pipeline already proven in `groupSmartSlices` (`expense-transforms.ts`).
- **[Risk] Infinite or very long runway when residual secondary income exceeds austerity burn** → **Mitigation**: Cap month-by-month simulation at `60` months (`5 years`) and display `"60+ Months (Cashflow Positive / Sustainable)"` in the KPI card when ending balance does not deplete within the 60-month horizon.
