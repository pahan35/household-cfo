# Design

## Context

See `proposal.md` for the motivation. The Family Budget dashboard currently handles exclusions through `use-exclusion-presets.ts` and `expense-transforms.ts`. While `localStorage` persistence exists under `family-budget:presets:v1`, presets are initialized via hardcoded regexes (`RENT_CATEGORY_REGEX`) and lack a visual configuration interface for users to select custom categories (such as `"Insurance PLN"`).

In the historical trends module (`yoy-transforms.ts` and `yoy-trends-card.tsx`), the Income series in the timeline and YoY views displays gross/net disposable income without deducting active expense exclusions, resulting in an artificial visual gap against controllable spending and an inflated savings rate calculation.

## Goals / Non-Goals

**Goals:**
- Provide a `PresetDialog` component that enables users to inspect all active expense categories and toggle exclusions directly.
- Persist custom category exclusions per preset in `localStorage` without depending on brittle name-matching regexes.
- In Macro Financial Trends, negate active expense exclusions from the Income line (`availableControllablePool = netDisposableIncome - excludedExpenseSum`), so the visual curve difference exactly equals `netCashFlowMargin`.
- Align the savings rate calculation in `yoy-transforms.ts` to `(netCashFlowMargin / netDisposableIncome) * 100`, matching `budget-metrics-strip.tsx`.

**Non-Goals:**
- Backend database persistence for presets (client `localStorage` remains the agreed source of truth).
- Modifying upstream ExternalProvider transaction or category data.

## Decisions

### 1. `PresetDialog` Component with Shadcn Primitives

- Implement `src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx` using `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `Input` (for category search), and `Checkbox` from `src/components/ui/`.
- Accessible via a `[⚙]` button next to the Preset Selector in `ExpensePieCard`.
- Lists all non-deleted expense categories with their current period spending and budget limits.
- Supports switching presets within the dialog, creating a new preset, renaming, deleting custom presets, and saving category exclusion IDs.
- *Alternatives considered*: Multi-select popover on the card header. Rejected because managing full presets, naming, and multi-category review requires more space and better keyboard accessibility.

### 2. Pure Hook Enhancements in `use-exclusion-presets.ts`

- Refactor `useExclusionPresets` to accept category lists and manage custom presets cleanly:
  - Add `updatePreset(preset: ExclusionPreset)`: Updates the category IDs and name of an existing preset.
  - Initial defaults can use broad fallback IDs on first run, but user edits directly save explicit `categoryIds: string[]` to `localStorage`.
- *Alternatives considered*: Retaining regex matching as an override. Rejected per user preference; explicit category selection in presets is deterministic and user-controlled.

### 3. Macro Trends Income Curve as Controllable Income Pool

- In `yoy-transforms.ts`:
  - For continuous timeline points (`ChronologicalTrendPoint`) and YoY points (`YoYYearMetric`):
    - Compute `availableControllablePool = transformed.netDisposableIncome - transformed.excludedExpenseSum`.
    - Plotted Income curve represents `availableControllablePool` when exclusions are active.
    - When `activeMetric === "expenses_income"`, the visual delta between the green curve (`availableControllablePool`) and red curve (`controllableExpense`) equals `(netDisposableIncome - excludedExpenseSum) - controllableExpense = netCashFlowMargin`.
  - In `CustomTimelineTooltip` and `CustomYoYTooltip`:
    - Display Net Disposable Income, Excluded Fixed Deductions (Rent, Insurance, etc.), and the resulting Available Pool.
- In `savingsRate`:
  - Update `savingsRate = netDisposableIncome > 0 ? Math.round((netCashFlowMargin / netDisposableIncome) * 100) : 0`.

## Risks / Trade-offs

- **[New ExternalProvider category added upstream]** → *Mitigation*: Unconfigured new categories default to included/controllable until the user checks them in the Preset Configuration Dialog.
- **[A category in a saved preset is deleted upstream]** → *Mitigation*: Transforms filter exclusion IDs against live categories, ignoring unknown/deleted IDs gracefully.
- **[User switches to a preset with zero exclusions]** → *Mitigation*: When `excludedExpenseSum === 0`, `availableControllablePool` equals `netDisposableIncome`, smoothly reverting to standard disposable income curves.

## Migration Plan

- Backward-compatible with existing `localStorage` keys (`family-budget:presets:v1`).
- Upgrades existing stored presets in place if present; falls back to default preset structure if empty.
- Automated tests in `spending-metrics.test.ts` verify exclusion math, savings rate, and preset serialization.
