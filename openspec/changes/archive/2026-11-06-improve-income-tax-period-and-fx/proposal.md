# Proposal

## Why

On the Income & Taxes screen (`/dashboard/family-budget/income`), income sources (`+x` received and `% of target`), tax breakdowns, and waterfall metrics currently aggregate the entire 1,500-transaction multi-month fetch without scoping to a budget period—causing 12-month inflows to be compared against 1-month targets (`1205% of target`) while colliding header actions crush the `Income Sources` card title into a narrow vertical column. Furthermore, category currency resolution overrides `category.currencyId` with name heuristics, `#VAT-7` pass-through remittances are not deducted from gross bank inflows in `True Gross Inflow` / `Net Disposable Cash` (and PFRON rebates are accidentally added to PPE in the waterfall), and upcoming USD B2B invoices with 23% Polish VAT paid in USD need first-class tracking and display of the FX loss between NBP mid-market rates and actual USD/PLN sell rates.

## What Changes

- **Month & Year Period Scoping with YoY Statistics**:
  - Add a unified period control bar to `/dashboard/family-budget/income` supporting **Month Mode** (selecting a specific month with `< Month >` steppers and YoY/MoM comparison deltas) and **Year Mode** (selecting a calendar year with annualized targets and YoY statistics vs. the prior year).
  - Connect the `Income & Taxation Timeline` chart to period selection (clicking a month bar selects that month in Month Mode; switching to Year Mode enables a **Timeline vs. YoY** comparison view).
  - Scope `IncomeMetricsStrip`, `IncomeSourcesCard` (`+x` received and `% of target` against `1×` monthly or annualized `limitAmount`), `TaxBreakdownCard`, and `RecentTransactionsCard` to the active Month or Year period.
- **Direct Category Currency Resolution & Zero-Amount Dual-Currency Cleanup**:
  - Update `resolveCategoryCurrency` to read `category.currencyId` directly from ExternalProvider category metadata as the primary source of truth, reserving name-suffix and Cyrillic heuristics strictly for categories missing `currencyId` or virtual Smart Category spend rollups.
  - Omit redundant secondary `≈ PLN 0.00` approximation sublines on `<MoneyValue mode="ledger" />` when the native amount is zero.
- **Income Sources Header Layout & Waterfall Math Fixes**:
  - Refactor the `IncomeSourcesCard` header so `Total Inflow` remains in the card header action slot while management buttons (`Normalize Categories`, `Show archived`) move to a secondary compact toolbar row, preventing title and description squishing.
  - Deduct `#VAT-7` pass-through remittances from gross bank inflows when computing `True Gross Inflow (Excl. PFRON & VAT)` and `Net Disposable Cash`, and fix `TaxBreakdownCard` so `pfronCashback` is not added into the `Personal Taxes (PPE / PIT)` waterfall cell.
- **VAT-7 Remittance USD FX Loss & Income Reduction Factor**:
  - Model the FX loss when a client pays 23% Polish VAT in USD and the user sells USD at an actual realized rate ($R_{\text{sell}}$) below the NBP rate ($R_{\text{NBP}}$) required for PLN VAT-7 settlement ($\text{VAT}_{\text{PLN}} \times (1 - R_{\text{sell}} / R_{\text{NBP}})$), alongside USD conversion spread on net earnings.
  - Display the loss in **both** places: inside the `VAT-7 Remittance` callout card (showing PLN remitted, original USD VAT collected, actual USD expended at sell rate, and net FX loss) and as a dedicated **FX & VAT-7 Drag** income reduction factor across the KPI strip, Waterfall, and Deduction Distribution bar/cards.

## Capabilities

### New Capabilities

### Modified Capabilities
- `income-and-tax-management`: Add Month and Year period scoping with YoY statistics, fix `IncomeSourcesCard` header layout, fix `#VAT-7` and PFRON waterfall math, and display USD VAT-7 FX loss both inside the `VAT-7 Remittance` callout and as an income reduction factor alongside personal taxes.
- `multi-currency-presentation`: Prioritize `category.currencyId` directly from ExternalProvider category metadata in `resolveCategoryCurrency` (reserving name heuristics for missing metadata or Smart Categories) and suppress redundant `≈ PLN 0.00` secondary lines when the amount is zero.

## Impact

- **Income & Tax Components**:
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-metrics-strip.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/tax-breakdown-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-tax-timeline-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts`
- **Multi-Currency Utilities**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-money.ts`
  - `src/app/(main)/dashboard/family-budget/_components/money-value.tsx`
- **Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/tax-transforms.test.ts`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-money.test.ts`
  - `src/app/(main)/dashboard/family-budget/_components/money-value.test.tsx`
