# Spec Delta: multi-currency-presentation

## MODIFIED Requirements

### Requirement: Canonical domain money representation and currency resolution

The system SHALL provide canonical domain types (`MoneyAmount`) and pure helper functions (`resolveCategoryCurrency`, `resolveTransactionMoney`, `toFxRateToTarget`) to reliably pair amounts with their verified ISO currency code. The system SHALL:

1. Maintain amounts and currency codes as an indivisible pair (`MoneyAmount { amount: number; currency: string }`). UI components and data transforms SHALL NOT pass bare numbers or separate amount and currency parameters that could diverge or default independently.
2. Resolve category currency hierarchically:
   - Priority 1: Uppercase 3-letter currency code trailing suffix in category name (e.g., `"Hotel EUR"`, `"Salary USD"`, `"Freelance UAH"`, `"Subscriptions UAH"`, `"Kantor USD"`) or legacy Cyrillic match, when the category `currencyId` is undefined or matches the system default currency (`PLN`). Explicit category name suffixes SHALL override default database placeholder currency codes.
   - Priority 2: Category `currencyId` if explicitly defined and non-empty.
   - Priority 3: Fallback to the dashboard default currency (`PLN`).
3. Resolve transaction money from upstream records:
   - For expense transactions (`CategoryType.Expense` destination): source money resolves to `tx.sourceAmount` in source account currency; destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination category currency. When destination currency is default currency but source currency is foreign, or when source amount is missing, the resolver SHALL preserve foreign currency amounts and fall back across destination/source fields.
   - For income transactions (`CategoryType.Income` source): source money resolves to `tx.sourceAmount` in source income category currency; destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination account currency.
   - For transfers: source money resolves to `tx.sourceAmount` in source account currency; destination money resolves to `tx.destinationAmount ?? tx.sourceAmount` in destination account currency. If one side of a transfer represents a foreign currency relative to the default currency, the primary money SHALL represent that foreign currency amount rather than silently defaulting to the domestic side.
4. Compute exchange rates between arbitrary currencies using ExternalProvider base currency rates where `c.rate` represents units per 1 USD (e.g., `USD = 1`, `EUR = 0.92`, `PLN = 4.0`). The rate to convert an amount from currency $A$ to target currency $B$ SHALL be computed as `amount * (rateB / rateA)`.

#### Scenario: Category currency resolved from name suffix when currencyId is default PLN placeholder

- **GIVEN** an expense category named `"Subscriptions UAH"` whose upstream database `currencyId` is `"PLN"`
- **WHEN** `resolveCategoryCurrency` is invoked on the category with default currency `"PLN"`
- **THEN** it returns `"UAH"` rather than `"PLN"`, respecting the user's explicit naming suffix

#### Scenario: Category currency resolved from name suffix when currencyId is missing

- **GIVEN** an expense category named `"Hotels EUR"` whose `currencyId` is `undefined`
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
