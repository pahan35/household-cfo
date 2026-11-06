# Tasks

## 1. Category Currency Resolution & Zero-Amount Presentation

- [x] 1.1 Update `resolveCategoryCurrency` in `src/app/(main)/dashboard/family-budget/_components/external-provider-money.ts` so `category.currencyId` is returned directly as Priority 1 whenever present on a `ExternalProviderCategory` entity, reserving trailing code and Cyrillic regex heuristics strictly for missing `currencyId` or string-only Smart Category slices; verify with unit tests in `external-provider-money.test.ts`.
- [x] 1.2 Update `<MoneyValue />` in `src/app/(main)/dashboard/family-budget/_components/money-value.tsx` to omit the secondary `≈ PLN 0.00` (or `orig.`) conversion subline when `Math.abs(amount) < 0.005`; verify with unit tests in `money-value.test.tsx`.

## 2. Period Scoping, Waterfall Accounting & USD VAT-7 FX Loss Engine

- [x] 2.1 Update `computeIncomeTaxMetrics` and `aggregateTaxesByTag` in `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts` to support filtering by Month (`yyyy-MM`) or Year (`yyyy`) and Cash vs. Accrual (`M - 1`) timing basis, plus compute YoY comparison deltas (`vs M - 12` or `vs Y - 1`); verify with unit tests in `__tests__/tax-transforms.test.ts`.
- [x] 2.2 Fix `computeIncomeTaxMetrics` in `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts` so `#VAT-7` pass-through remittances are subtracted from raw gross bank inflows when computing `True Gross Inflow (Excl. PFRON & VAT)` and `Net Disposable Cash`; verify with unit tests in `__tests__/tax-transforms.test.ts`.
- [x] 2.3 Update `computeFxFriction` in `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts` to automatically derive the NBP reference rate ($R_{\text{NBP}}$) and realized USD/PLN sell rate ($R_{\text{sell}}$), compute `vatDragLossPln` and `vatDragLossUsd` on 23% VAT paid in USD alongside non-overlapping `tradeSpreadLossPln` on remaining USD conversions, and expose detailed VAT-7 FX metrics (`invoicedUsdVat`, `expendedUsdForVat`, `realizedSellRate`, `nbpRate`); verify with unit tests in `__tests__/tax-transforms.test.ts`.

## 3. UI Layout, Period Controls & VAT-7 FX Loss Display

- [x] 3.1 Refactor `IncomeSourcesCard` in `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx` to keep only `Total Inflow` in the `SectionShell` header `action` slot and move `Normalize Categories` and `Show archived` into a compact toolbar row inside the card content, and support scaled annualized targets (`activeMonthsCount × limitAmount`) in Year Mode; verify layout and target percentage calculation via `npm run verify`.
- [x] 3.2 Update `TaxBreakdownCard` and `IncomeMetricsStrip` (`tax-breakdown-card.tsx`, `income-metrics-strip.tsx`) to fix the PFRON subtraction bug on `Personal Taxes (PPE / PIT)`, display the detailed USD VAT-7 FX loss breakdown inside the `VAT-7 Remittance` callout card, and render `FX & VAT-7 Drag` as a deduction factor in the Waterfall and 3-column Deduction Distribution grid; verify with `npm run verify`.
- [x] 3.3 Update `IncomeTaxTimelineCard` and `IncomeDashboard` (`income-tax-timeline-card.tsx`, `income-dashboard.tsx`) to add the Month / Year period control bar with YoY delta badges, interactive month bar selection on the Timeline chart, and a Timeline vs. YoY Comparison chart toggle in Year Mode; verify end-to-end type safety and linting with `npm run verify`.
