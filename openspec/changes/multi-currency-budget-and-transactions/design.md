# Design

## Context

See `proposal.md` for motivation. Currently:
- `BudgetOverviewDashboard` loads `currencies` via `getCurrencies()` and passes it to `YoYTrendsCard`, but does not pass `currencies` to `BudgetSummaryCard` or `CategoryExpenseTraceSheet`.
- `getLastTransactionSummaryForCategory` attempts to read `tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? "PLN"`, failing to inspect the counterpart category entity in `categoryById`.
- `getTransactionSpendAmount` in `category-expense-trace-helpers.ts` extracts raw floats without currency awareness, and `CategoryExpenseTraceSheet` formats rows, account chips, and headers with `formatMoney(..., defaultCurrency)`.
- `BudgetSummaryCard` renders every row with the reporting currency (`defaultCurrency`, PLN) regardless of whether an individual category has a foreign budget limit or belongs to a multi-currency smart group.

## Goals / Non-Goals

**Goals:**
- Provide reliable multi-currency normalization so all aggregated summaries (slide-over header, tabs, account chips, and smart groups) use consistent reporting units (`PLN`).
- Display Option A across all transaction surfaces: converted reporting currency as the primary numeric value, with the original native amount and currency as a subtitle or hover tooltip.
- Support standalone foreign categories displaying native currency (e.g. `4 500 ₴ / 5 000 ₴`) with reporting equivalents on hover.
- Support Smart Category Groups displaying normalized reporting currency on the group header with native currencies on child category breakdowns.

**Non-Goals:**
- Modifying ExternalProvider server-side `/stat/ping` or `/Exchange/Ping` contracts.
- Introducing external currency conversion APIs; rates continue to originate from ExternalProvider's `ExchangeKey.Currency` exchange rate table.
- Changing historical macroeconomic FX models in `/dashboard/family-budget/fx-inflation`.

## Decisions

### 1. Unified Transaction Spend & Currency Resolver
Create a helper function `resolveTransactionSpend(tx, defaultCurrency, currencies, categoryMap)` in `category-expense-trace-helpers.ts` or `external-provider-data.ts`:
- **Source Currency**: `tx.sourceCurrencyId ?? categoryMap.get(tx.sourceId)?.currencyId ?? defaultCurrency`.
- **Destination Currency**: `tx.destinationCurrencyId ?? categoryMap.get(tx.destinationId)?.currencyId ?? defaultCurrency`.
- **Direction & Native Amount**: For expense transactions, native spend is `Math.abs(Number(tx.sourceAmount ?? tx.destinationAmount ?? tx.defaultAmount) || 0)`. The native currency is the source account's currency if money left a bank/cash account, or the transaction/category currency.
- **Converted Amount**: `convertCurrencyAmount(nativeAmount, nativeCurrency, defaultCurrency, currencies) ?? nativeAmount`.
- *Rationale*: Reuses the battle-tested `convertCurrencyAmount` helper while properly resolving missing currency fields on raw transactions from their category entities.

### 2. Option A UI Presentation in Category Expense Trace Sheet
- **Row Presentation**:
  - Right column: Primary bold text displays converted reporting currency (`-{formatMoney(convertedAmount, defaultCurrency)}`).
  - Below/hover: If `nativeCurrency !== defaultCurrency`, render muted subtext (e.g. `{formatMoney(nativeAmount, nativeCurrency)}`) and a hover tooltip showing exchange rate details (`{nativeAmount} {nativeCurrency} @ rate = {convertedAmount} {defaultCurrency}`).
- **Account Filter Chips**:
  - Chip text shows total converted spend in `defaultCurrency` (e.g. `Monobank (3) • 146,34 zł`).
  - Hover tooltip displays native account spend (e.g. `Native: 1 500,00 ₴`).
- **Header & Period Tabs**:
  - Sum `convertedAmount` so total spend and baseline variance are mathematically sound.

### 3. Category Metadata Resolution in `getLastTransactionSummaryForCategory`
- Extend `getLastTransactionSummaryForCategory(categoryId, tx, categoryById, defaultCurrency, currencies)`:
  - When `isDest` (expense category), inspect `categoryById.get(tx.sourceId)?.currencyId` to identify if payment came from a foreign account (e.g. UAH).
  - Return `originalAmount`, `originalCurrency`, and `normalizedAmount` (in `defaultCurrency`).
- In `LastTransactionBadge`:
  - Popover header displays normalized amount in reporting currency, accompanied by a badge or secondary label showing `{formatMoney(originalAmount, originalCurrency)}` when foreign.

### 4. Standalone vs. Smart Group Foreign Limits in BudgetSummaryCard
- Pass `currencies` and `periodTransactions` to `BudgetSummaryCard`.
- **Standalone Foreign Category**: If a category has an explicit foreign `currencyId` or currency tier (`getCategoryCurrencyTier(...) === "foreign"`):
  - If limit is defined in that foreign currency, format limit and spend in the native currency.
  - Hovering on the amount reveals a tooltip with the converted reporting currency equivalent.
- **Smart Category Group**:
  - The parent row renders in reporting currency (`defaultCurrency`, PLN).
  - Child category rows in the breakdown render in their respective native currencies.

## Risks / Trade-offs

- **[Risk] Missing Currency Rate in `ExchangeKey.Currency`**: If a rare currency lacks a rate in ExternalProvider:
  - *Mitigation*: `convertCurrencyAmount` returns `null`. Fall back gracefully to `nativeAmount` and indicate unconverted status with a badge or tooltip.
- **[Risk] Historical Rate Fluctuations**: ExternalProvider stores a single global exchange rate table rather than historical daily spot rates for budget overview.
  - *Mitigation*: Using current snapshot exchange rates aligns with existing budget calculation conventions in `YoYTrendsCard` and `AccountLiquidityStrip`.
