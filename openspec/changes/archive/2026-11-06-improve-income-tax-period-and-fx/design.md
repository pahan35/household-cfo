# Design

## Context

See `proposal.md` for motivation. Currently, `IncomeDashboard` (`src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`) fetches 1,500 transactions via `getTransactionPage` and passes the entire multi-month array unfiltered to `computeIncomeTaxMetrics` and `aggregateTaxesByTag`, while computing `controllableExpenses` from a single month (`currentMonthStart`) of `/stat/ping`. Additionally:
1. `IncomeSourcesCard` puts two action buttons (`Normalize Categories`, `Show archived`) and the `Total Inflow` summary inside `SectionShell`'s `CardAction` slot (`grid-cols-[1fr_auto]`), starving the left `1fr` title/description column in the 5/12 layout.
2. `resolveCategoryCurrency` (`external-provider-money.ts`) treats `category.currencyId === "PLN"` as a placeholder and overrides it with name regexes, whereas each ExternalProvider category already carries its authoritative `currencyId` in category metadata (only grouped Smart Categories lack a single `currencyId`).
3. `computeIncomeTaxMetrics` (`tax-transforms.ts`) sums raw client inflows (which include 23% output VAT) into `grossIncome` without subtracting `#VAT-7` pass-through remittances, inflating `True Gross Inflow (Excl. PFRON & VAT)` and `Net Disposable Cash` by the entire VAT amount. Meanwhile, `TaxBreakdownCard` calculates `Personal Taxes (PPE / PIT)` as `totalTaxesConverted - resolvedNetZus`, where `totalTaxesConverted` uses gross ZUS—causing `pfronCashback` to be added to PPE/PIT.
4. `computeFxFriction` only computes `vatDragLossPln` when `input.vatInvoicedNbpRate` is explicitly passed (which `IncomeDashboard` never passes), and `TaxBreakdownCard` always renders `#VAT-7` as a static `"Neutral Pass-Through"` badge without displaying the FX loss when a client pays 23% Polish VAT in USD and the user sells USD at a rate below the NBP rate.

## Goals / Non-Goals

**Goals:**
- Provide a unified **Month Mode** (`yyyy-MM`) and **Year Mode** (`yyyy`) period selector on `/dashboard/family-budget/income` with YoY comparison statistics (`vs M-12` in Month Mode, `vs Y-1` in Year Mode) and interactive chart selection.
- Synchronize **Cash Basis** vs. **Accrual Basis (`M - 1`)** across the Timeline chart, KPI strip, and Tax Breakdown card so monthly or annual tax and VAT-7 outflows align with the user's chosen basis.
- Read category currency directly from `category.currencyId` on ExternalProvider category objects, and suppress redundant `≈ PLN 0.00` sublines when a foreign category has `0` activity in the period.
- Fix the `IncomeSourcesCard` header layout and the `TaxBreakdownCard` waterfall/distribution math (deducting `#VAT-7` from gross bank inflows and fixing the PFRON offset calculation).
- Automatically compute and display **VAT-7 FX Loss** and **USD Exchange Spread** both inside the `VAT-7 Remittance` callout card and as a first-class **FX & VAT-7 Drag** income reduction factor across the KPI strip, Waterfall, and Deduction Distribution cards.

**Non-Goals:**
- Modifying upstream ExternalProvider category or transaction records for currency resolution or VAT calculation.
- Changing Smart Category grouping heuristics used on the Budget Overview expense donut/summary screens.

## Decisions

### 1. Unified Period State (`Month Mode` vs. `Year Mode`) & Accrual Alignment
- **Decision**: Introduce an `IncomePeriodState` in `IncomeDashboard`:
  - `periodMode: "month" | "year"` (default `"month"`).
  - `activeMonthKey: string` (`"yyyy-MM"`, defaulting to the latest month with income/tax activity or current month).
  - `activeYear: number` (defaulting to the year of `activeMonthKey`).
  - `timingMode: "cash" | "accrual"` lifted to `IncomeDashboard` so the Timeline chart, KPI strip, and Tax Breakdown card share the same basis.
- **How period filtering works**:
  - In **Month Mode** (`activeMonthKey = "2026-10"`):
    - Income transactions and FX transfers are filtered to `getTransactionMonthKey(tx) === "2026-10"`.
    - Tax transactions (`taxCategoryIds`) and PFRON rebates are filtered to `"2026-10"` in Cash Basis, or `"2026-11"` (shifted back `M - 1` to `"2026-10"`) in Accrual Basis.
    - Target adherence on `IncomeSourcesCard` compares native monthly receipts against `1 × category.limitAmount`.
    - YoY comparison metrics are computed for `"2025-10"` (`M - 12`).
  - In **Year Mode** (`activeYear = 2026`):
    - Transactions are filtered to `monthKey.startsWith("2026-")` (with `M - 1` tax shifting applied per month when in Accrual Basis).
    - Target adherence scales `category.limitAmount` by the number of active months in `activeYear` (`activeMonthsCount × category.limitAmount`, up to 12) so `% of target` reflects annual pacing rather than `1200%`.
    - YoY comparison metrics are computed against `activeYear - 1` (`2025`), and `IncomeTaxTimelineCard` provides a **Timeline | YoY Comparison** view switch that plots Jan–Dec monthly bars/lines for `activeYear` vs. `activeYear - 1`.
- **Rationale**: Reusing the already-loaded 1,500 transactions and 40-month `/stat/ping` series in memory allows instant switching between months, years, Cash/Accrual basis, and YoY views with zero extra network round-trips.

### 2. Direct `category.currencyId` Resolution & `<MoneyValue />` Zero-Subline Suppression
- **Decision**:
  - In `resolveCategoryCurrency` (`external-provider-money.ts`), when a `ExternalProviderCategory` object is passed and `category.currencyId` is a non-empty string, return `category.currencyId.trim().toUpperCase()` immediately as Priority 1. Only fall back to trailing currency code regexes or Cyrillic heuristics when `category.currencyId` is missing/empty or when a plain string name is passed (such as a virtual Smart Category slice).
  - In `<MoneyValue />` (`money-value.tsx`), only render the secondary conversion line (`≈ PLN ...` in `ledger` mode or `orig. ...` in `rollup` mode) when `isCrossCurrency && Math.abs(amount) >= 0.005`.
- **Rationale**: Every ExternalProvider category has its exact currency stored in `category.currencyId`. Reading it directly eliminates false overrides while hiding `≈ PLN 0.00` removes visual clutter on inactive foreign-currency rows.

### 3. Waterfall Accounting: Deducting Pass-Through `#VAT-7` & Fixing PFRON Offset
- **Decision**:
  - Track `rawGrossInflow` (all non-rebate client inflows) and `passThroughVat` (`#VAT-7` remittances).
  - When `passThroughVat > 0`, `grossIncome` (`True Gross Inflow (Excl. PFRON & VAT)`) is computed as `Math.max(0, rawGrossInflow - passThroughVat)` (with `rawGrossInflow` still available for tooltip/subline context when VAT is present).
  - In `TaxBreakdownCard`, compute `Personal Taxes (PPE / PIT & Health)` directly from the non-ZUS personal tax buckets (`totalPersonalTaxesConverted - grossZus`) rather than `totalTaxesConverted - resolvedNetZus`, and display `Net ZUS` (`resolvedNetZus`) in the ZUS distribution card and bar so all personal tax components sum cleanly to `totalTaxes` (`Net Personal Taxes`).

### 4. Modeling & Displaying VAT-7 Remittance Loss on USD Income
- **Decision**:
  - When a client pays 23% Polish VAT in USD and the user sells USD for PLN (`USD -> PLN` transfer transactions) to pay `#VAT-7` in PLN:
    - Realized USD/PLN sell rate: $R_{\text{sell}} = \frac{\sum \text{destinationAmountPln}}{\sum \text{sourceAmountUsd}}$ for the period's `USD -> PLN` transfers.
    - NBP reference rate: $R_{\text{NBP}} = \text{vatInvoicedNbpRate} ?? \text{getMacroData(monthKey).usdPlnRate}$ (or ExternalProvider USD/PLN rate if macro data is unavailable for a future month).
    - **VAT-7 FX Loss**:
      $$\text{vatDragLossPln} = \max\left(0,\ \text{vatPln} \times \left(1 - \frac{R_{\text{sell}}}{R_{\text{NBP}}}\right)\right), \quad \text{vatDragLossUsd} = \max\left(0,\ \frac{\text{vatPln}}{R_{\text{sell}}} - \frac{\text{vatPln}}{R_{\text{NBP}}}\right)$$
    - **Net Revenue Exchange Spread Loss** (to avoid double-counting the USD sold specifically for VAT-7):
      - USD expended for VAT-7 is $U_{\text{vat}} = \min(\text{totalUsdTransferred},\ \text{vatPln} / R_{\text{sell}})$.
      - Remaining USD sold for net earnings / personal taxes is $U_{\text{net}} = \max(0,\ \text{totalUsdTransferred} - U_{\text{vat}})$.
      - $\text{tradeSpreadLossPln} = \max(0,\ U_{\text{net}} \times (R_{\text{NBP}} - R_{\text{sell}}))$.
      - $\text{totalFxFrictionPln} = \text{vatDragLossPln} + \text{tradeSpreadLossPln}$.
  - **Dual UI Presentation**:
    1. **`VAT-7 Remittance` Callout Card**: Displays the PLN VAT remitted, the original USD VAT collected at $R_{\text{NBP}}$ (`$vatPln / R_nbp`), the actual USD expended at $R_{\text{sell}}$ (`$vatPln / R_sell`), and a prominent loss badge (`-PLN X / -$Y FX Loss`) when `vatDragLossPln > 0`.
    2. **Income Reduction Factor**: `FX & VAT-7 Drag` (`totalFxFrictionPln`, broken down into `VAT-7 FX Loss` + `USD Exchange Spread`) is displayed in the KPI strip, the `Revenue-to-Net Disposable Cash Flow` waterfall, and as a card/segment in the `Personal Tax & Deduction Distribution` section (`lg:grid-cols-3`), reducing `Net Disposable Cash`.

### 5. `IncomeSourcesCard` Header Layout Refactor
- **Decision**: Keep only the `Total Inflow` summary in `SectionShell`'s `action` prop so `CardHeader` has a clean `[Title/Description | Total Inflow]` two-column balance. Render the management controls (`Normalize Categories`, `Show archived (N)`, and optional period target hint) in a compact secondary action bar at the top of `CardContent`.

## Risks / Trade-offs

- **[Risk] Future-dated transactions (e.g., 2026) may exceed static `MACRO_DATA_BY_MONTH` table entries** → **Mitigation**: `getMacroData(monthKey)` already falls back to the latest entry, and we will also support falling back to the live ExternalProvider `USD -> PLN` rate when computing NBP reference rates if no explicit `vatInvoicedNbpRate` is supplied.
- **[Risk] Month with zero USD->PLN transfer transactions but USD income and PLN VAT-7 payment** → **Mitigation**: If USD income exists in the period (or `M - 1`) alongside `#VAT-7` payments, allow fallback estimation or display the realized spread from the nearest USD->PLN transfer in the window.
