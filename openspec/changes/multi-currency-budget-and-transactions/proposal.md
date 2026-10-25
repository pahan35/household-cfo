# Proposal

## Why

In the Family Budget dashboard, expense transactions recorded in foreign currencies (specifically Ukrainian Hryvnia, UAH) from foreign accounts or in foreign-tier categories are currently formatted as Polish Złoty (PLN) without currency conversion. This occurs in the "Last transaction" hover badge, the "Inspect Transactions" slide-over sheet, and the "Budget Spent vs Limit" section, causing misleading figures (e.g. 500 ₴ displayed as 500,00 zł) and corrupting arithmetic sums across mixed currencies.

Users need foreign-currency transactions and limits to normalize into the primary reporting currency (defaulting to PLN) for consistent totals and comparisons, while preserving and surfacing the original native amount and currency in secondary displays, tooltips, and hover breakdowns.

## What Changes

- **Inspect Transactions Sheet Currency Normalization**:
  - Resolve true transaction currency and endpoints using counterpart category definitions (`currencyId`) and exchange rates (`currencies`).
  - Convert transaction spend to the dashboard reporting currency (`defaultCurrency`, e.g. PLN) for list amounts, account chip subtotals, tab totals, and header metrics.
  - Display the normalized amount as primary (`-48,78 zł`) and show the native original amount (`500,00 ₴`) as a subtitle or hover tooltip.
- **Last Transaction Endpoint & Currency Resolution**:
  - Update `getLastTransactionSummaryForCategory` and `buildLastTransactionMap` to resolve counterpart account currencies via category metadata instead of falling back to PLN.
  - Store both normalized reporting amount and original amount + currency, displaying normalized value in the badge header with original native currency breakdown on hover.
- **Budget Spent vs Limit Foreign & Group Currency Presentation**:
  - Respect native currency when an individual category's budget limit is defined exclusively in a foreign currency (e.g. `4 500 ₴ / 5 000 ₴`), providing a converted equivalent on hover.
  - In Smart Category Groups, present the parent row normalized in the primary reporting currency (PLN), and present each child category in its original native currency with conversion details.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Update requirements for the Budget Overview screen, Spent vs Limit summary, Last Transaction popover, and Category Expense Trace sheet to support multi-currency normalization to reporting currency with original-currency hover breakdowns.

## Impact

- **Affected components**:
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-sheet.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/category-expense-trace-helpers.ts`
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/last-transaction-badge.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`
- **Tests**:
  - Update and expand unit tests in `category-expense-trace.test.ts`, `external-provider-data.test.ts`, and `spending-metrics.test.ts` to assert multi-currency conversions and breakdowns.
