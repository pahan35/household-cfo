# multi-currency-presentation Specification

## Purpose

Establishes a unified domain money model, canonical multi-currency resolution rules, and consistent UI presentation patterns across the Family Budget dashboard. Guarantees that every monetary figure is coupled with its authentic currency code, eliminates mismatched amount-currency pairs and raw foreign numbers masquerading as default currency, and provides standardized dual-currency presentation across transaction ledgers and analytical rollups.

## Requirements

### Requirement: Canonical domain money representation and currency resolution

The system SHALL provide canonical domain types (`MoneyAmount`) and pure helper functions (`resolveCategoryCurrency`, `resolveTransactionMoney`, `toFxRateToTarget`) to reliably pair amounts with their verified ISO currency code. The system SHALL:

1. Maintain amounts and currency codes as an indivisible pair (`MoneyAmount { amount: number; currency: string }`). UI components and data transforms SHALL NOT pass bare numbers or separate amount and currency parameters that could diverge or default independently.
2. Resolve category currency hierarchically:
   - Priority 1: Category `currencyId` directly from ExternalProvider category data (`category.currencyId`) when explicitly defined and non-empty on a category entity. Each ExternalProvider category carries its authoritative currency in `category.currencyId`.
   - Priority 2: Uppercase 3-letter currency code trailing suffix in category name (e.g., `"Hotel EUR"`, `"Salary USD"`, `"Freelance UAH"`, `"Subscriptions UAH"`, `"Kantor USD"`) or legacy Cyrillic match, ONLY when `category.currencyId` is undefined/empty or when resolving virtual/grouped Smart Category slices that lack a single category entity `currencyId`.
   - Priority 3: Fallback to the dashboard default currency (`PLN`).
3. Resolve transaction money from upstream records:
   - For expense transactions (`CategoryType.Expense` destination): source money resolves to `tx.sourceAmount` in source account currency; destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination category currency. When destination currency is default currency but source currency is foreign, or when source amount is missing, the resolver SHALL preserve foreign currency amounts and fall back across destination/source fields.
   - For income transactions (`CategoryType.Income` source): source money resolves to `tx.sourceAmount` in source income category currency (`sourceCat.currencyId`); destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination account currency.
   - For transfers: source money resolves to `tx.sourceAmount` in source account currency; destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination account currency. If one side of a transfer represents a foreign currency relative to the default currency, the primary money SHALL represent that foreign currency amount rather than silently defaulting to the domestic side.
4. Compute exchange rates between arbitrary currencies using ExternalProvider base currency rates where `c.rate` represents units per 1 USD (e.g., `USD = 1`, `EUR = 0.92`, `PLN = 4.0`). The rate to convert an amount from currency $A$ to target currency $B$ SHALL be computed as `amount * (rateB / rateA)`.

#### Scenario: Category currency resolved directly from category.currencyId
- **GIVEN** a ExternalProvider category entity with `currencyId: "PLN"` or `currencyId: "UAH"` or `currencyId: "USD"`
- **WHEN** `resolveCategoryCurrency` is invoked on the category
- **THEN** it returns `category.currencyId` directly without overriding it with name regexes

#### Scenario: Category currency resolved from name suffix when currencyId is default PLN placeholder
- **GIVEN** a virtual or unhydrated category slice named `"Subscriptions UAH"` without an authoritative `currencyId`
- **WHEN** `resolveCategoryCurrency` is invoked on the category with default currency `"PLN"`
- **THEN** it returns `"UAH"` rather than `"PLN"`, respecting the explicit naming suffix

#### Scenario: Category currency resolved from name suffix when currencyId is missing
- **GIVEN** an expense category or smart-group slice named `"Hotels EUR"` whose `currencyId` is `undefined`
- **WHEN** `resolveCategoryCurrency` is invoked on the category
- **THEN** it returns `"EUR"` rather than falling back to default `"PLN"`

#### Scenario: Category currency resolved from legacy Cyrillic name
- **GIVEN** an expense category named `"Аптека Грн"` with no explicit `currencyId`
- **WHEN** `resolveCategoryCurrency` is invoked on the category
- **THEN** it returns `"UAH"`

#### Scenario: Transaction money resolved atomically for cross-currency card payment
- **GIVEN** an upstream transaction from a USD debit card paying €120.00 into `"Hotel EUR"` with `sourceAmount: 130` and `destinationAmount: 120` but omitting transaction-level `sourceCurrencyId` and `destinationCurrencyId`
- **WHEN** `resolveTransactionMoney` is invoked with the account map and category map
- **THEN** it returns source money of `130 USD` and destination money of `120 EUR` without defaulting either side to `PLN`

#### Scenario: Cross-currency transfer preserves foreign currency side as primary
- **GIVEN** a transfer between a PLN bank account and `"Kantor USD"` where 8,000 PLN was exchanged for 2,000 USD
- **WHEN** `resolveTransactionMoney` is evaluated for foreign boundary inspection
- **THEN** the primary money preserves the foreign `$2,000.00` representation

#### Scenario: Converting amounts between two non-USD currencies
- **GIVEN** ExternalProvider currency definitions where `EUR.rate = 0.92` and `PLN.rate = 4.00`
- **WHEN** converting `100 EUR` into `PLN`
- **THEN** the system calculates `100 * (4.00 / 0.92) = 434.78 PLN`

### Requirement: Dual-currency presentation for ledgers versus analytical rollups

The system SHALL provide a shared `<MoneyValue />` component that formats monetary values with their proper currency symbol and renders contextual dual-currency information according to strict display mode rules:

1. **Ledger & Assistant Mode (`mode="ledger"`)**:
   - Primary line renders the native transaction amount and native currency (e.g., `€120.00`, `$2,500.00`).
   - Secondary line renders the converted default reporting currency amount with an approximation prefix (e.g., `≈ PLN 516.00`).
   - If native currency equals reporting currency, OR if the native amount is zero (`Math.abs(amount) < 0.005`), the secondary line is omitted to prevent redundant `≈ PLN 0.00` clutter.
2. **Analytical Rollup Mode (`mode="rollup"`)**:
   - Primary line renders the converted default reporting currency total (e.g., `PLN 1,420.00`) to align with container headers and summary totals.
   - Secondary line renders the original foreign currency amount with an `"orig."` prefix (e.g., `orig. €320.00`).
   - If all underlying amounts are in default currency, or if the amount is zero, the secondary line is omitted.
3. **Strict Formatting Integrity**: The component SHALL NEVER format a raw foreign number with a default currency symbol or code (e.g., formatting 120 EUR as `PLN 120.00`).

#### Scenario: Rendering a foreign expense in a ledger
- **GIVEN** a travel expense recorded as `€120.00` with converted value `PLN 516.00`
- **WHEN** `<MoneyValue />` renders with `mode="ledger"`
- **THEN** the primary line displays `€120.00` and the secondary subline displays `≈ PLN 516.00`

#### Scenario: Omitting secondary conversion line when foreign amount is zero
- **GIVEN** a foreign-currency income source with `amount: 0` in `UAH` or `USD` and reporting currency `PLN`
- **WHEN** `<MoneyValue />` renders with `mode="ledger"`
- **THEN** it renders the primary zero value and omits the redundant `≈ PLN 0.00` secondary subline

#### Scenario: Rendering a foreign expense in an analytical rollup
- **GIVEN** an expense trace item recorded natively as `€120.00` with converted total `PLN 516.00`
- **WHEN** `<MoneyValue />` renders with `mode="rollup"`
- **THEN** the primary line displays `PLN 516.00` and the secondary subline displays `orig. €120.00`

#### Scenario: Rendering a domestic expense in either mode
- **GIVEN** an expense recorded natively as `PLN 250.00`
- **WHEN** `<MoneyValue />` renders in either `ledger` or `rollup` mode
- **THEN** it displays `PLN 250.00` as the primary line and renders no secondary subline

### Requirement: Compact currency axis and table cell formatting

The system SHALL ensure that all summary matrices, compact table cells, and chart axes clearly disclose their currency unit rather than rendering raw bare numbers:

1. **Offer Comparison Matrix**: Cashflow table cells (such as 3-year cumulative net compensation, signing bonus, or benefit values) SHALL render with their explicit currency symbol or unit (e.g., `PLN 450,000` or `zł450,000`).
2. **Chart Y-Axes and Tooltips**: Financial charts (e.g., YoY trends, CPI inflation, FX simulator) SHALL indicate the currency unit in axis ticks or header labels (e.g., `PLN` or `(PLN)`).
3. **Preset Dialogs and Category Cards**: Budget inputs and summary meters SHALL render the assigned currency symbol or code alongside every numeric value.

#### Scenario: Viewing multi-year cashflows in Offer Comparator
- **GIVEN** the Offer Comparison Matrix displaying 3-year cumulative cashflows
- **WHEN** values are rendered across compared employment offers
- **THEN** each cell includes the currency unit (e.g. `PLN 520,000`) instead of rendering an ambiguous bare number `520,000`
