# Proposal

## Why

Currently, exclusion preset categorization relies heavily on hardcoded regex heuristics (e.g. `RENT_CATEGORY_REGEX = /(rent|аренд|квартир|найм|czynsz|housing)/i`), preventing users from configuring other non-controllable fixed obligations—such as `"Insurance PLN"`, kindergarten tuition, or loans—without modifying source code. Furthermore, although custom presets can theoretically be saved to `localStorage`, there is no UI dialog or management interface to view, select, check/uncheck, or manage excluded categories.

At the same time, in the "Macro Financial Trends" time-series chart (`yoy-trends-card.tsx`), toggling exclusions (such as "Exclude Rent") drops the red "Controllable Expenses" line, but does not deduct/negate those excluded fixed expenses from the green "Income" line. This causes the visual curve gap to artificially inflate, disconnects the chart from the tooltip's "Monthly Gap" (which correctly subtracts excluded expenses via invariant net cash flow margin), and calculates a distorted, inflated savings rate in `yoy-transforms.ts`.

## What Changes

- **Preset Configuration Dialog**:
  - Add an interactive Preset Configuration Dialog accessible via a settings gear button (`[⚙]`) next to the Preset Selector in the Expenses Breakdown card.
  - Render all active ExternalProvider expense categories with search filtering, amounts, and toggleable checkboxes to classify any category as a non-controllable fixed obligation (e.g., `"Apartment Rent"`, `"Insurance PLN"`).
  - Support updating the active preset, creating new custom presets, and deleting custom presets with client-side persistence in `localStorage` (`family-budget:presets:v1`).
  - Deprecate reliance on fragile regex heuristics in favor of explicit user-selected category IDs.
- **Macro Financial Trends Income Negation & Alignment**:
  - In continuous timeline and year-over-year series (`yoy-transforms.ts`), when expense exclusions are active, deduct excluded expenses (`excludedExpenseSum`) from the Income curve so it represents the **Available Controllable Pool** (`netDisposableIncome - excludedExpenseSum`).
  - Align the visual difference between the Income curve and Controllable Expenses curve in "Expenses & Income" view so it directly equals the invariant Net Cash Flow Margin.
  - In `CustomTimelineTooltip` and `CustomYoYTooltip`, clearly surface Net Disposable Income, Excluded Fixed Obligations (Rent, Insurance, etc.), and the resulting Available Controllable Pool.
  - Fix the `savingsRate` calculation in `yoy-transforms.ts` to compute `(netCashFlowMargin / netDisposableIncome) * 100`, matching the dashboard KPI strip.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `expense-customization`: Provide an interactive UI dialog for configuring category exclusions and managing presets in `localStorage`, eliminating hardcoded regex category matching.
- `historical-budget-trends`: In Macro Financial Trends (dual-curve and single-metric income views), negate/deduct active expense exclusions from the Income line to plot the Available Controllable Pool, and align the savings rate formula with invariant cash margin.
- `budget-overview`: Update the Expenses Breakdown card header to expose the Preset Configuration Dialog trigger and reflect multi-category exclusions (Rent, Insurance, etc.).

## Impact

- **UI Components**:
  - `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx`: New component providing the interactive category checklist and preset management dialog.
  - `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`: Add manage presets button next to preset selector and integrate `PresetDialog`.
  - `src/app/(main)/dashboard/family-budget/_components/yoy-trends-card.tsx`: Update Income metric descriptions, tooltips, and curve data keys to reflect the Controllable Income Pool when exclusions are active.
- **Data Transforms & Hooks**:
  - `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts`: Expose preset update and category toggle methods for the dialog, removing hardcoded regex reliance.
  - `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts`: Derive `netIncome` as `availableControllablePool` (or provide both `netDisposableIncome` and `availableControllablePool`), and fix savings rate calculation.
- **Automated Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts`: Add unit tests verifying dialog preset persistence, multi-category exclusions (Rent + Insurance), and macro trend curve gap invariance.
