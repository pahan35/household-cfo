# Proposal

## Why

Multiple features across Family Budget repeatedly exhibit currency presentation bugs where foreign monetary amounts (such as `EUR`, `USD`, and `UAH`) are displayed with the default `PLN` symbol or silently mispaired with destination currencies. This happens because upstream `/api/transaction/get` omits transaction-level currency fields, category currencies are split across `.currencyId`, suffix tags (`"Hotel EUR"`), and legacy Ukrainian Cyrillic names, and components ad-hoc fall back to `defaultCurrency` (`PLN`) or split numbers from their currencies.

A recent manifestation in Travel Bookend Assistant formats foreign candidate charges as `PLN` numbers and fails to score foreign card payments into default categories. Furthermore, in Income & Taxes, converted PLN numbers are formatted with dollar signs (`+$20,000.00`), and throughout various cards, foreign category limits and last-transaction badges show unconverted amounts mislabeled as `PLN`.

Unifying multi-currency handling under an atomic money domain model and standardizing presentation rules will permanently eliminate this class of bugs across all Family Budget features.

## What Changes

- **Travel Bookend Assistant & Boundary Candidate Scoring**:
  - Format candidate transactions with native currency as primary and converted `PLN` as secondary (e.g., `€120.00` with `≈ PLN 516.00`).
  - Update `scoreBoundaryCandidate` to inspect foreign card/account source currencies prior to destination category currencies, and recognize category name currency suffixes (`"Hotel EUR"`, `"Medicine UAH"`) so the `+40` Foreign Currency boundary signal scores reliably.
- **Dual-Currency Presentation Standards**:
  - **Ledger & Assistant Lists** (`TravelBookendAssistant`, `RecentTransactionsCard`, `TaxAuditCard`): Display **native currency as primary** and converted `PLN` as secondary whenever a transaction crosses currencies or is foreign.
  - **Analytical Rollup Breakdowns** (`TripsConcertsDashboard`, `LearningDashboard`, `CategoryExpenseTraceSheet`): Display **converted `PLN` as primary** and native currency as secondary (`PLN 516.00` with `orig. €120.00`) so individual breakdown rows visibly sum to card header totals.
- **Income Sources Card & Last Transaction Badges**:
  - In `IncomeSourcesCard`, display **native `USD` as primary** and converted `PLN` as secondary, comparing native receipts against native target limits to ensure `% of target` calculations are mathematically sound.
  - Pass `defaultCurrency` and `currencies` into `buildLastTransactionMap` on `IncomeDashboard` and `FamilyBudgetDashboard` so foreign accounts and sources do not show unconverted amounts mislabeled as `PLN`.
- **Debt Clearing & Category Limits**:
  - In `DebtClearingPanel`, label settlement target inputs with the target category's true resolved currency, recompute converted amounts dynamically upon target selection, and ensure fee expenses use the target fee category's currency.
  - In `PresetDialog`, format category limit amounts in the category's native currency rather than stripping suffixes and labeling them as `PLN`.
- **Offer Comparator & Chart Axes Integrity**:
  - Pass `categoryMap` into `computeBenefitSpendCeilings` so foreign medical, sport, or learning outlays are not summed 1:1 as `PLN`.
  - Add explicit currency labels (`PLN`) to the 3-Year Horizon cashflow cells in `OfferComparisonMatrix`.
- **Atomic Money & Category Currency Resolver**:
  - Introduce a shared `external-provider-money.ts` helper and `<MoneyValue />` UI component that couples numbers and currency codes atomically and makes `categoryMap`, `currencies`, and `reportingCurrency` non-optional in currency-resolving functions.

## Capabilities

### New Capabilities
- `multi-currency-presentation`: System-wide atomic money contract and dual-currency rendering rules distinguishing ledger views (native primary) from analytical rollups (converted primary).

### Modified Capabilities
- `trip-and-concert-costing`: Update Travel Bookend Assistant candidate formatting to native primary + converted secondary, and update boundary candidate scoring to inspect foreign source account currencies and category currency suffixes.
- `income-and-tax-management`: Update Income Sources list to display native currency primary + converted secondary, ensure last transaction badges resolve FX rates, and pair tax transaction amounts with true category currencies.
- `throwaway-debt-accounts`: Ensure Debt Clearing panel settlement and fee inputs accurately resolve target category currencies and update on selection changes.

## Impact

- Affected features:
  - `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/travel-bookend-assistant.tsx`
  - `src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/trips-concerts-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/lifestyle/learning/learning-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/debt-clearing-panel.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts`
  - `src/app/(main)/dashboard/family-budget/offer-comparator/_components/benefit-matcher.ts`
  - `src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-comparison-matrix.tsx`
  - Shared helpers in `external-provider-data.ts`, `lifestyle-transforms.ts`, and a new `external-provider-money.ts` / `money-value.tsx`.
- APIs & Backend: None (pure frontend presentation and client transform normalization; no backend changes).
- Upstream compatibility: Fully backward compatible with existing ExternalProvider sync.
