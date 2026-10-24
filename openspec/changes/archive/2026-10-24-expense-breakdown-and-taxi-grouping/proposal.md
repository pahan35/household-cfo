# Proposal

## Why

Currently, the Family Budget dashboard's "Controllable Expenses Breakdown" calculates Net Cash Margin by subtracting only controllable expenses from Net Disposable Income (`netDisposableIncome - totalControllableExpense`). When a user excludes large fixed expenses (such as rent or mortgage) from the breakdown chart to focus on variable lifestyle spending, the calculated Net Cash Margin artificially spikes as if the excluded expenses were never paid. In reality, excluding an expense category from a visualization filter does not mean the household did not incur that cost.

Additionally, automatic tax category detection uses an unanchored substring regex (`/(tax|podat|налог)/i`), causing categories like `"Taxi PLN"` (Uber, Bolt, and ride-hailing) to be erroneously classified as government tax deductions, deducted from Gross Income, and omitted from controllable expense tracking. Finally, because both public transit (`"Transport PLN"`) and ride-hailing (`"Taxi PLN"`) are often minor percentages of total spending, they frequently get collapsed into a generic `"Other Categories"` bucket instead of being visibly grouped under a cohesive Transport smart group.

## What Changes

- **Rename Breakdown Card**: Rename `"Controllable Expenses Breakdown"` to `"Expenses Breakdown"`, updating inner donut chart labels and card headers accordingly.
- **Invariant Net Cash Margin**: Update the Net Cash Margin calculation to always deduct all living expenses (`netDisposableIncome - (totalControllableExpense + excludedExpenseSum)`), ensuring that toggling category exclusions in the breakdown chart does not distort the true bottom-line cash margin.
- **Show Cash Left for Controllable Expenses**: Surface the available controllable budget pool (`Net Disposable Income - Excluded Fixed Expenses`) and remaining cash left (`Controllable Pool - Controllable Expenses`, equal to Net Cash Margin) across:
  - **KPI Metrics Strip**: On the `Controllable Expenses` card subtext (`Pool: X PLN • Left: Y PLN`).
  - **Expenses Breakdown Card**: In the header badge summary strip (`[Controllable: X PLN] [Excluded: Y PLN] [Cash Left: +Z PLN]`).
- **Fix Tax Category Auto-Detection**: Update `TAX_CATEGORY_REGEX` across `tax-transforms.ts` and `use-exclusion-presets.ts` to enforce word boundaries (`/(?:\btax(?:es)?\b|podat|налог)/i`), preventing `"Taxi PLN"` and other ride-hailing categories from being categorized as tax deductions.
- **Smart Grouping for Transport & Taxi**: Introduce a smart category group for `"Transport"` that links both public transit (`"Transport"`) and ride-hailing (`"Taxi"`):
  - Preserves distinct category-level tracking and ordering in ExternalProvider.
  - Combines small transit and taxi slices into a unified `"Transport (incl. Taxi)"` slice on the donut chart when either falls below the threshold, preventing them from being buried in `"Other Categories"`.
  - In the breakdown legend/list, presents the Transport smart group with visible breakdown between regular transit and taxi/ride-hailing.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `budget-overview`: Rename the card to "Expenses Breakdown", render invariant Net Cash Margin regardless of active exclusions, surface controllable spending pool and cash left across the KPI strip and card badges, and provide Transport/Taxi smart grouping.
- `income-and-tax-management`: Refine tax category detection pattern to prevent non-tax transport categories (e.g. "Taxi PLN") from being misclassified as dedicated tax deductions.

## Impact

- **UI Components**:
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`: Renamed to "Expenses Breakdown", updated donut center label, added "Cash Left" badge, and integrated Transport smart group rendering.
  - `src/app/(main)/dashboard/family-budget/_components/budget-metrics-strip.tsx`: Added controllable pool and cash left metrics to the Controllable Expenses card.
- **Data Transforms**:
  - `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`: Corrected `netCashFlowMargin` calculation to include excluded expenses, and enhanced small slice grouping with smart group awareness.
  - `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts` & `use-exclusion-presets.ts`: Fixed `TAX_CATEGORY_REGEX` with word-boundary patterns.
- **Tests & Specifications**:
  - Unit tests in `spending-metrics.test.ts` and `tax-transforms.test.ts` updated to verify regex boundary matching, margin invariance, and transport grouping.
