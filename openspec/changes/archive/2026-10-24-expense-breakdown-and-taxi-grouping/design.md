# Design

## Context

The Family Budget overview dashboard derives category breakdowns and financial KPIs in `expense-transforms.ts`, `tax-transforms.ts`, and `use-exclusion-presets.ts`. See `proposal.md` for background and motivation.

Currently:
1. `transformExpenses` calculates `netCashFlowMargin = netDisposableIncome - totalControllableExpense`. When an expense category (like rent) is placed in `expenseExclusions`, it is removed from `totalControllableExpense`, creating an artificial increase in `netCashFlowMargin`.
2. `TAX_CATEGORY_REGEX = /(tax|podat|налог)/i` lacks word boundaries and matches `"Taxi PLN"`, classifying it as a tax deduction.
3. Minor categories below 3% are grouped into a generic `"Other Categories"` slice via `groupSmallSlices`. Transport and Taxi are typically 0.5%–2% each, causing both to be hidden in "Other".

## Goals / Non-Goals

**Goals:**
- Make Net Cash Margin invariant to chart exclusion presets (`Net Disposable Income - (Controllable Expenses + Excluded Expenses)`).
- Prevent `"Taxi PLN"` and ride-hailing categories from matching tax detection patterns.
- Rename the breakdown card to `"Expenses Breakdown"`.
- Surface controllable spending capacity (`Available Pool = Net Disposable - Excluded Expenses` and `Cash Left = Available Pool - Controllable Expenses`) in both the KPI strip and the Expenses Breakdown card.
- Provide smart grouping for Transport and Taxi, allowing them to form a combined slice on the donut chart when minor, while displaying distinct line items in the breakdown list.

**Non-Goals:**
- Modifying ExternalProvider upstream API schemas or database models.
- Altering user categories upstream in ExternalProvider (categories remain distinct as created by the user).
- Changing historical trend calculations or inflation dashboards.

## Decisions

### 1. Invariant Net Cash Margin Calculation

- **Choice**:
  ```ts
  const grossIncome = computedIncome > 0 ? computedIncome : Math.max(0, rawGrossIncome);
  const netDisposableIncome = grossIncome - totalTaxDeductions;
  const totalLivingExpenses = totalControllableExpense + excludedExpenseSum;
  const netCashFlowMargin = netDisposableIncome - totalLivingExpenses;
  ```
- **Rationale**: Excluding an expense category from a chart is a view configuration, not an income-generating or debt-forgiving event. All living expenses must be deducted to report true net cash flow.
- **Alternatives Considered**: Keeping margin tied to controllable expenses alone (rejected: produced false surpluses when rent was excluded).

### 2. Available Controllable Budget Pool & Cash Left Metrics

- **Choice**: Compute two derived metrics in `TransformedExpenseData`:
  ```ts
  const availableControllablePool = netDisposableIncome - excludedExpenseSum;
  const controllableCashLeft = availableControllablePool - totalControllableExpense; // equals netCashFlowMargin
  ```
- **Presentation**:
  - **KPI Metrics Strip** (`BudgetMetricsStrip`): Controllable Expenses card displays `Pool: X PLN • Left: Y PLN` in its subtext.
  - **Expenses Breakdown Card** (`ExpensePieCard`): Summary badge strip renders `[Controllable: X PLN] [Rent Excluded: Y PLN] [Cash Left: +Z PLN]` (styled emerald when $\ge 0$, destructive when $< 0$).

### 3. Word-Boundary Regex for Tax Detection

- **Choice**:
  ```ts
  export const TAX_CATEGORY_REGEX = /(?:\btax(?:es)?\b|podat|налог)/i;
  ```
- **Rationale**: Standardizes across `tax-transforms.ts` and `use-exclusion-presets.ts`. Correctly matches `"Tax PLN"`, `"Taxes & ZUS"`, `"Podatki"`, `"Налоги"`, while ignoring `"Taxi"`, `"Taxi PLN"`, or `"Uber / Taxi"`.

### 4. Smart Grouping for Transport & Taxi

- **Choice**:
  - Define a regex `TRANSPORT_CATEGORY_REGEX = /(transport|taxi|uber|bolt)/i` and `isTaxiCategory = /(taxi|uber|bolt)/i`.
  - In `expense-transforms.ts`, introduce `groupSmartSlices`:
    - Before generic `< 3%` threshold collapsing, check if both or either Transport and Taxi slices are `< 3%`.
    - If present, merge their amounts into a single chart slice: `{ id: "group-transport", name: "Transport (incl. Taxi)", amount: combinedAmount, isSmartGroup: true, children: [...] }`.
  - In `ExpensePieCard` legend/list:
    - If the Transport group is active, render a group row `Transport Group: X PLN` with indented/badged child line items (`Taxi (Uber/Bolt): A PLN`, `Transport (bus/train): B PLN`).
    - If the user prefers flat sorting by spend, allow clicking to inspect the sub-items.

## Risks / Trade-offs

- **[Risk] Existing unit tests expecting old Net Cash Margin values with exclusions**
  → *Mitigation*: Update tests in `spending-metrics.test.ts` to verify that toggling rent exclusion maintains invariant `netCashFlowMargin` while updating `excludedExpenseSum` and `totalControllableExpense`.
- **[Risk] Category name localization variations for Taxi / Transport**
  → *Mitigation*: The matching regex handles standard case-insensitive patterns (`taxi`, `uber`, `bolt`, `transport`). Custom ExternalProvider category IDs and names are preserved.
