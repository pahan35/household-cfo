# Proposal

## Why

In the current Income & Taxes screen (`/dashboard/family-budget/income`), the "Missing Tax Tag Audit" expects `#pit` and `#vat`, whereas in Polish sole proprietorship (JDG) on flat-rate taxation (*ryczałt od przychodów ewidencjonowanych*), income tax is paid via micro-tax account under form symbol `#PPE` and VAT remittances are paid under `#VAT-7`. Consequently, correctly tagged real-world transactions are falsely flagged as untagged.

Furthermore, the Income & Taxes screen lacks historical timeline visualization. Users cannot analyze how total income and specific income sources were taxed across past months, how realized tax burdens relate to earnings over time, or how PFRON ZUS contra-rebates (*"Cashback taxes"*) offset social security contributions across periods.

## What Changes

- **Update Tax Tag Canonical Expectations**:
  - Replace `#pit` with `#PPE` as the primary canonical tag and UI default for personal flat-rate income tax, retaining `#pit` and related terms as backward-compatible aliases.
  - Replace `#vat` with `#VAT-7` as the primary canonical tag and UI default for VAT pass-through remittances, retaining `#vat` as an alias.
  - Update `TaxAuditCard` and `tax-transforms` audit descriptions and selector options to explicitly reflect `#PPE` and `#VAT-7`.
- **Introduce Income & Tax Timeline Chart**:
  - Add an interactive historical timeline chart on `/dashboard/family-budget/income` showing monthly gross income alongside the stacked tax breakdown (`#PPE`, `#health`, net `#zus`).
  - Provide an interactive multi-select income source filter allowing users to select specific income sources and observe their aggregate earnings and taxation over time.
  - Integrate PFRON ZUS contra-rebates (*"Cashback taxes"*) as a direct deduction reducing gross ZUS social security down to net ZUS.
  - Overlay an Effective Tax Rate trendline ($\text{Net Personal Taxes} / \text{Selected Gross}$) on a secondary axis.
  - Provide a toggle for **Cash Basis** (taxes displayed in month paid) vs. **Accrual / Incurred Basis** (taxes shifted $M-1$ to match invoice generation).

## Capabilities

### Modified Capabilities
- `income-and-tax-management`: Update tax tag canonical definitions (`#PPE` and `#VAT-7`) and audit expectations; add requirements for historical income and tax timeline analytics with source filtering and PFRON deduction netting.

## Impact

- **Modified files**:
  - `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts`: Update `KNOWN_TAX_BUCKETS` canonical tags and aliases; add historical timeline transformation functions.
  - `src/app/(main)/dashboard/family-budget/_components/tax-audit-card.tsx`: Update audit label, description, and select options for `#PPE` and `#VAT-7`.
  - `src/app/(main)/dashboard/family-budget/_components/tax-breakdown-card.tsx`: Reflect updated tag badges and descriptions.
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`: Integrate the new timeline chart component and state management.
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/tax-transforms.test.ts`: Update tests for `#PPE` / `#VAT-7` and add tests for timeline transforms.
- **New files**:
  - `src/app/(main)/dashboard/family-budget/_components/income-tax-timeline-card.tsx`: Recharts-based timeline visualization with source selection chips, PFRON deduction display, and cash/accrual toggles.
- **Dependencies**: Uses existing Recharts components via `@/components/ui/chart`. No new dependencies.
