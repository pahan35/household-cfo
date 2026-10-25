# Design: Unify Multi-Currency Handling

## Context

The Family Budget dashboard integrates with ExternalProvider data where transactions, categories, and accounts carry financial amounts across multiple currencies (primarily `PLN`, `USD`, `EUR`, and legacy `UAH`). 

As detailed in `proposal.md`, several recurring multi-currency display bugs have surfaced across features (most recently in the Travel Bookend Assistant and Income Sources Card). Upstream ExternalProvider transactions omit transaction-level currency identifiers (`tx.sourceCurrencyId` and `tx.destinationCurrencyId`), and category currencies are inconsistently stored (partially in `category.currencyId`, partially as uppercase 3-letter suffixes like `"Hotel EUR"`, and partially as pre-2022 Cyrillic Ukrainian account names). Furthermore, ExternalProvider currency exchange rates store units per 1 USD (`c.rate`), not PLN per unit.

When downstream components lack atomic money handling or make independent fallbacks for amount and currency, raw foreign figures get displayed with `PLN` symbols, foreign transactions lose boundary scoring, and target adherence calculations break.

See `proposal.md` for full motivation and problem analysis.

## Goals / Non-Goals

**Goals:**
- **Single Source of Truth**: Create a unified domain money module (`external-provider-money.ts`) providing atomic `MoneyAmount` types, hierarchical category/account currency resolution, atomic transaction money resolution, and mathematically sound cross-currency conversion.
- **Universal Dual-Currency Presentation**: Create a reusable `<MoneyValue />` component with strict presentation contracts for ledger contexts (native primary + converted reporting secondary) and analytical rollups (converted reporting primary + native secondary).
- **Zero Raw Foreign Mislabeling**: Ensure every displayed monetary value across Family Budget (Travel Bookend Assistant, Income Sources, Trips & Concerts, Learning, Debt Clearing, Preset Dialog, Offer Comparator) is accompanied by its authentic currency symbol or unit.
- **Root Cause Remediation**: Fix candidate formatting and foreign boundary scoring in `travel-bookend-assistant.tsx`, target adherence and dual-currency display in `income-sources-card.tsx`, and spend ceiling conversion in `benefit-matcher.ts`.

**Non-Goals:**
- **Dynamic NBP / Kantor FX Engine**: Integrating real-time National Bank of Poland (NBP) or web kantor APIs is deferred per user decision. Currency conversion relies on ExternalProvider exchange rates.
- **Upstream Schema Modification**: No changes to upstream ExternalProvider database models or external API contracts.
- **Non-Budget Screens**: Screens outside `src/app/(main)/dashboard/family-budget/` (e.g., CRM, Infrastructure) remain outside this change.

## Decisions

### Decision 1: Canonical Domain Money Module (`external-provider-money.ts`)
**Approach**: Introduce `external-provider-money.ts` in `src/app/(main)/dashboard/family-budget/_components/` exporting:
- `MoneyAmount`: `{ amount: number; currency: string }`
- `resolveCategoryCurrency(category, defaultCurrency = "PLN"): string`: Resolves currency hierarchically via:
  1. `category.currencyId` (if non-empty)
  2. Trailing uppercase 3-letter ISO code bounded by word boundary or parentheses (e.g., `"Hotels EUR"` -> `"EUR"`, `"Freelance (USD)"` -> `"USD"`), matching against known ISO currencies (`EUR`, `USD`, `PLN`, `UAH`, `GBP`, `CZK`, `CHF`, `SEK`, `NOK`, `DKK`, `CAD`, `AUD`, `JPY`, `HUF`) to avoid false positives (e.g., "AutoCAD" is NOT Canadian dollars)
  3. Cyrillic legacy heuristics (`Грн`, `Гривна`, `Приват`, `Моно` -> `UAH`)
  4. Fallback to `defaultCurrency` (`PLN`)
- `resolveTransactionMoney(tx, categoryMap, accountMap, defaultCurrency = "PLN")`: Returns `{ source: MoneyAmount, destination: MoneyAmount, primary: MoneyAmount }` atomically.
- `toFxRateToTarget(fromCurrency, toCurrency, currencies): number`: Uses ExternalProvider's base-USD rate convention:
  $$\text{rate} = \frac{\text{rate}_{\text{target}}}{\text{rate}_{\text{source}}}$$
- `convertMoney(money: MoneyAmount, targetCurrency: string, currencies): MoneyAmount`

**Rationale**: Consolidates 6 divergent regexes and ad-hoc resolution routines into one well-tested module.

**Alternatives Considered**:
- *Keeping regexes in caller components*: Rejected because bug fixes in one feature fail to propagate to other features, creating recurring regressions.
- *Modifying raw ExternalProvider types*: Rejected because upstream DTOs come from API responses and should remain typed as received from the proxy.

### Decision 2: Dual-Currency Presentation Component (`<MoneyValue />`)
**Approach**: Introduce `<MoneyValue />` in `src/app/(main)/dashboard/family-budget/_components/money-value.tsx`:
```tsx
interface MoneyValueProps {
  amount: number;
  currency: string;
  convertedAmount?: number;
  reportingCurrency?: string;
  mode?: "ledger" | "rollup";
  size?: "sm" | "md" | "lg";
  className?: string;
  showApproximationSign?: boolean;
}
```
- **Ledger Mode (`mode="ledger"`, default)**:
  - Line 1 (primary, bold/regular): Native currency formatting (`€120.00`, `$2,500.00`).
  - Line 2 (secondary, muted text-xs): Converted reporting amount (`≈ PLN 516.00`).
  - Omitted if native currency matches reporting currency.
- **Rollup Mode (`mode="rollup"`)**:
  - Line 1 (primary): Converted reporting amount (`PLN 516.00`).
  - Line 2 (secondary, muted text-xs): Native original amount (`orig. €120.00`).
  - Omitted if native currency matches reporting currency.

**Rationale**: Aligns directly with user confirmation: ledgers (assistant, recent transactions, tax audit) show native primary, while rollups (trips & concerts, learning, category trace) show reporting currency primary to match container totals.

**Alternatives Considered**:
- *Single-line inline string formatting*: Rejected because secondary conversion details require styled typography (`text-xs text-muted-foreground`) to avoid cluttering primary figures.

### Decision 3: Assistant Boundary Scoring Fix in `travel-bookend-assistant.tsx`
**Approach**:
1. Replace lines 389-392 in `travel-bookend-assistant.tsx` with `resolveTransactionMoney` and `<MoneyValue mode="ledger" />`.
2. In `scoreBoundaryCandidate`:
   - Use `resolveCategoryCurrency` for destination category.
   - Use account currency for source account.
   - Trigger the `+40 Foreign Currency` signal if EITHER source currency OR destination currency differs from `defaultCurrency` (`PLN`).

**Rationale**: When paying with a EUR card abroad for a taxi, the destination category is often domestic `Taxi (PLN)` while the source account is `EUR Card`. Looking only at destination category missed the foreign signal entirely.

### Decision 4: Target Adherence and Last Transaction Badge Fix in `income-sources-card.tsx`
**Approach**:
1. Calculate target adherence as:
   $$\text{adherencePercentage} = \frac{\text{nativeReceivedAmount}}{\text{nativeLimitAmount}} \times 100$$
2. Render native received and limit amounts with `<MoneyValue mode="ledger" amount={nativeReceived} currency={sourceCurrency} convertedAmount={convertedPln} />`.
3. In `LastTransactionBadge`, resolve counterpart category/account currency rather than defaulting to PLN.

**Rationale**: Prevents comparing converted 20,250 PLN against 5,000 USD (which resulted in 405% fake adherence) and eliminates rendering 20,250 PLN with a `$` sign.

### Decision 5: Spending Ceilings and Comparison Matrix in Offer Comparator
**Approach**:
1. In `benefit-matcher.ts`, pass `categoryMap` and `currencies` into `computeBenefitSpendCeilings` so category expenditures are properly converted to PLN before capping benefit offsets.
2. In `offer-comparison-matrix.tsx`, ensure all 3-year cumulative cashflow metrics render with explicit `PLN` currency labels.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Category name suffix false positives (e.g., word ending in "CAD" or "RUB") | Match against an explicit whitelist of supported ISO currencies (`EUR`, `USD`, `PLN`, `UAH`, `GBP`, `CZK`, `CHF`, etc.) with strict word-boundary checks (`/\b(EUR\|USD\|PLN\|UAH\|GBP\|CZK\|CHF)\b/i`). |
| Incomplete upstream currency rates array in some API responses | If a foreign currency rate is missing, fallback gracefully to 1:1 conversion while logging a development warning and preserving the native currency label on the primary amount. |
| Performance overhead across large transaction lists | Currency resolution relies on $O(1)$ Map lookups and cached regex matching. No async operations or heavy layout computations are introduced. |

## Migration Plan

1. **Phase 1: Foundation**: Create `external-provider-money.ts` unit tests and implementation. Verify rate conversions and currency extractions.
2. **Phase 2: UI Component**: Create `<MoneyValue />` component with Storybook/unit tests covering ledger and rollup modes.
3. **Phase 3: Screen Updates**:
   - Update `travel-bookend-assistant.tsx` and lifestyle dashboards (`trips-concerts`, `learning`, `tag-category-explorer`).
   - Update `income-sources-card.tsx` and tax components (`tax-audit-card`, `last-transaction-badge`).
   - Update `debt-clearing-panel.tsx`, `preset-dialog.tsx`, and `category-expense-trace-sheet.tsx`.
   - Update `benefit-matcher.ts` and `offer-comparison-matrix.tsx`.
4. **Phase 4: Verification**: Run `npm run verify` (`biome check && tsc --noEmit`) to ensure strict typing and code style compliance.
