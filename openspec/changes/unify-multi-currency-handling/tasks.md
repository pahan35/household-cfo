# Tasks

## 1. Domain Money Module

- [ ] 1.1 Implement `external-provider-money.ts` in `src/app/(main)/dashboard/family-budget/_components/` providing `MoneyAmount`, `resolveCategoryCurrency` (supporting suffixes, Cyrillic legacy, and fallback), `resolveTransactionMoney`, `toFxRateToTarget`, `convertMoney`, and `formatMoney`; verify module compiles with `npm run verify`
- [ ] 1.2 Create unit tests in `src/app/(main)/dashboard/family-budget/_components/external-provider-money.test.ts` covering suffix extraction, legacy Cyrillic handling, cross-currency USD-base conversions, and transaction resolution; verify all test cases pass

## 2. Reusable Dual-Currency UI Component

- [ ] 2.1 Implement `money-value.tsx` in `src/app/(main)/dashboard/family-budget/_components/` supporting `ledger` mode (native primary + converted reporting secondary) and `rollup` mode (converted reporting primary + native secondary) with proper typographic hierarchy; verify export and types with `npm run verify`
- [ ] 2.2 Create unit tests in `src/app/(main)/dashboard/family-budget/_components/money-value.test.tsx` verifying ledger vs rollup DOM rendering, approximation prefixes, and same-currency subline omission; verify tests pass

## 3. Travel Bookend Assistant & Lifestyle Dashboards

- [ ] 3.1 Update `travel-bookend-assistant.tsx` candidate list to use `resolveTransactionMoney` and `<MoneyValue mode="ledger" />`, and fix `scoreBoundaryCandidate` to inspect both destination category currency and source account currency for foreign signals; verify candidate amounts render with authentic currencies (e.g., `€120.00`) and foreign score triggers reliably
- [ ] 3.2 Update `trips-concerts-dashboard.tsx`, `learning-dashboard.tsx`, and `category-expense-trace-sheet.tsx` to use `<MoneyValue mode="rollup" />` for expense items with foreign subtotals; verify rollup items show converted reporting currency primary and original foreign secondary
- [ ] 3.3 Update `tag-category-explorer.tsx` and `use-lifestyle-data.tsx` to ensure category currencies are resolved hierarchically and pass `categoryMap` and `currencies` to downstream transforms; verify with `npm run verify`

## 4. Income Sources & Tax Management

- [ ] 4.1 Update `income-sources-card.tsx` to display native received and limit amounts primary with `<MoneyValue mode="ledger" />`, show converted PLN secondary, and calculate target adherence percentage against native `limitAmount`; verify USD contracts render `$5,000 / $5,000 (100%)` and never format converted PLN with `$`
- [ ] 4.2 Update `last-transaction-badge.tsx` and `tax-audit-card.tsx` to resolve counterpart currencies dynamically with `resolveCategoryCurrency` and render dual-currency amounts where applicable; verify with `npm run verify`

## 5. Debt Accounts, Presets & Dialogs

- [ ] 5.1 Update `debt-clearing-panel.tsx` to resolve fee category currency via `resolveCategoryCurrency` instead of hardcoding PLN, and display settlement conversions using `<MoneyValue />`; verify fee recording and settlement inputs reflect authentic currencies
- [ ] 5.2 Update `preset-dialog.tsx` and `recent-transactions-card.tsx` to render category limit amounts and transaction figures with explicit currency codes; verify with `npm run verify`

## 6. Offer Comparator Ceilings & Matrices

- [ ] 6.1 Update `benefit-matcher.ts` to pass `categoryMap` and `currencies` into `computeBenefitSpendCeilings` so foreign category expenditures convert to PLN before capping benefit offsets; verify ceiling computations via unit tests
- [ ] 6.2 Update `offer-comparison-matrix.tsx` to ensure 3-year cumulative cashflow metrics, signing bonuses, and benefit cells display explicit `PLN` currency labels; verify with `npm run verify`

## 7. Verification & Quality Gates

- [ ] 7.1 Run full project verification via `npm run verify` (`biome check && tsc --noEmit`) to verify zero type errors and clean formatting across all modified files
