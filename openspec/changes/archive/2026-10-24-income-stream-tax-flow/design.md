# Design

## Context

See `proposal.md` for problem motivation and `specs/` for normative behavior contracts.

ExternalProvider represents financial entities with categorical metadata:
- `categoryType`: `Income` (1), `Account` (2), `Expense` (3), `Goal` (6), `BankAccount` (7).
- Inflow transactions connect an income category (`sourceType === CategoryType.Income`) to an account (`destinationType === CategoryType.Account`).
- Outflow tax transactions connect an account to a tax expense category (`TAX_CATEGORY_REGEX = /(tax|podat|налог)/i`) with tags (`#pit`, `#zus`, `#vat`, `#health`).
- Currency exchanges occur via account-to-account transfers between accounts of different currencies (e.g., USD business account to PLN personal/operating account).

## Goals / Non-Goals

**Goals:**
- Completely eliminate income budget targets from Budget Overview's "Budget Spent vs Limit" card.
- Deduct `"Cashback taxes"` from gross business income and credit it directly against ZUS contributions.
- Segregate VAT-7 from personal tax calculations to keep effective tax rates economically accurate.
- Calculate USD FX friction: trade spread on Kantor exchanges against NBP mid-market rate and VAT-7 currency rate drag.
- Prevent non-tax living expense transactions from polluting the Income & Taxes ledger.

**Non-Goals:**
- Modifying ExternalProvider upstream data structures or schemas.
- Full corporate accounting (CIT/KPiR); this remains focused on personal family finances and sole proprietor (JDG) disposable cash flow.
- Real-time live NBP API fetching (we leverage existing historical and monthly NBP rates from `macro-data.ts`).

## Decisions

### Decision 1: Strict Expense Category Filtering in `computeBudgetSummaryItems`
- **Choice**: Update `computeBudgetSummaryItems` signature to accept a `categoryTypeMap: Map<string, number>` (or full `categories` array), and filter:
  ```ts
  const isExpense = categoryTypeMap.get(cat.id) === CategoryType.Expense;
  ```
- **Rationale**: Currently, only `limitAmount > 0 || current > 0` is checked. Filtering by `CategoryType.Expense` guarantees that only spend budgets appear in Budget Overview.
- **Alternatives Considered**: Filtering by name regex (brittle; fails if an income source has an arbitrary name).

### Decision 2: PFRON "Cashback taxes" Identification & Netting
- **Choice**: Match `"Cashback taxes"` via case-insensitive regex `/cashback[\s_-]*taxes/i` on the income category name.
- **Mechanics**:
  1. Inflow from this category is deducted from `grossIncome` (`trueGross = totalInflow - pfronCashback`).
  2. Applied as a credit against ZUS (`netZus = Math.max(0, grossZus - pfronCashback)`).
  3. `IncomeSourcesCard` badges this item as "Tax Rebate / ZUS Offset".
- **Rationale**: Refunding 60% of social security is an expenditure rebate, not revenue. Netting it aligns reported tax burden with actual net cash out the door.

### Decision 3: Segregating VAT-7 from Personal Tax Burden
- **Choice**: Keep tracking VAT transactions (destined to tax categories with `#vat` tag or named VAT), but split `TaxBreakdownResult` into:
  - `personalTaxes`: PIT, ZUS, Health, Belka.
  - `passThroughTaxes`: VAT-7.
- **Computation**:
  - `effectiveTaxRate = (personalTaxesTotal / trueGrossIncome) * 100`
  - `netDisposableIncome = trueGrossIncome - personalTaxesTotal - fxFriction`
  - VAT-7 is rendered in a dedicated pass-through info badge/card indicating total remitted without inflating personal tax rates.

### Decision 4: Realized FX Friction Computation
- **Choice**: Detect currency transfer transactions where `sourceCurrency === "USD"` and `destinationCurrency === "PLN"`.
  1. `realizedRate = destinationAmount / sourceAmount`
  2. `nbpRate = getMacroData(monthKey).usdPlnRate`
  3. `tradeSpreadLoss = Math.max(0, sourceAmount * (nbpRate - realizedRate))`
  4. For VAT drag: If VAT was fixed at invoice date rate $R_{inv}$ and remitted at realized exchange rate $R_{rem}$, the loss is `vatPln / R_rem - vatPln / R_inv`.

### Decision 5: Ledger Fallback Remediation
- **Choice**: In `IncomeDashboard`, replace the `transactions.slice(0, 50)` fallback with an explicit empty state when `incomeAndTaxTxs.length === 0`.
- **Rationale**: Showing random groceries and coffee transactions when no tax transactions exist violates user trust and causes confusing audit displays.

## Risks / Trade-offs

- **[Risk] Transactions lack explicit exchange counterpart links in ExternalProvider** → In ExternalProvider, transfers between accounts are paired transactions sharing date and amounts. We match transfer pairs by matching timestamp and currency conversions, or calculate the effective rate directly if ExternalProvider provides dual amounts on the transaction entity (`sourceAmount` and `destinationAmount`).
- **[Trade-off] Historical NBP Rates in `macro-data.ts` are monthly** → For days where intraday rates vary, monthly NBP mid-rate provides a close approximation (~0.5% variance) while avoiding network latency or third-party API dependencies.

## Migration Plan

- Pure client-side calculation and presentation changes; zero database or upstream migration required.
- Existing tests in `tax-transforms.test.ts` and `spending-metrics.test.ts` will be updated to cover the new netting and filtering invariants.
