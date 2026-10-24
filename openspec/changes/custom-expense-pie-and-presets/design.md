# Design

## Context

The Family Budget screen (`src/app/(main)/dashboard/family-budget/`) currently renders accounts, recent transactions, and a spending-vs-limit progress list using data from `/stat/ping`. The progress list displays raw categories without distinguishing fixed obligations (taxes, rent) from discretionary spending.

The shadcn/ui chart component (`src/components/ui/chart.tsx`) backed by Recharts is already installed and used across several dashboard routes in the project.

## Goals / Non-Goals

**Goals:**
- Provide a client-side exclusion presets engine with default presets and user customization.
- Render an interactive Expense Composition Pie/Donut Chart using shadcn/Recharts primitives.
- Calculate and display Net Disposable Income (Gross Income minus Tax deductions) and Controllable Expenses (Total Expenses minus Exclusions).
- Persist presets and active selection in browser `localStorage`.
- Support auto-matching default categories for "Tax" and "Rent" by name.

**Non-Goals:**
- Multi-year or historical time-series trends (scoped to Change 2).
- Currency conversion or CPI inflation deflators (scoped to Change 3).
- Modifying upstream ExternalProvider data (read-only client transformations).
- Server-side database persistence for presets (client `localStorage` is sufficient).

## Decisions

### 1. Colocated Hook & Storage Adapter for Presets

Create `src/app/(main)/dashboard/family-budget/_components/use-exclusion-presets.ts`.

- **Model**:
  ```typescript
  export interface ExclusionPreset {
    id: string;
    name: string;
    incomeDeductions: string[];   // Category IDs deducted from Gross Income (e.g. Tax)
    expenseExclusions: string[];  // Category IDs omitted from Expense Pie/Totals (e.g. Rent)
    isBuiltIn?: boolean;
  }
  ```
- **Storage**: Keyed under `family-budget:presets:v1` in `localStorage` with SSR fallback.
- **Auto-detection**: On initialization, default presets locate category IDs where `name.toLowerCase().includes("tax")` or `includes("rent")` to populate initial IDs seamlessly.
- **Alternative considered**: Storing in cookies or server session. Rejected because presets are private client preferences with zero backend state dependency.

### 2. Chart Rendering via shadcn/ui `ChartContainer` and Recharts `PieChart`

- Implement `src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx` wrapped in `SectionShell`.
- Uses Recharts `PieChart`, `Pie`, and `Cell` inside `ChartContainer`.
- Category slices map to Tailwind / shadcn chart semantic color variables (`--color-chart-1` ... `--color-chart-5`) with dynamic rotation.
- Inner donut layout with centered total controllable expense display.
- Legend displaying top categories by spent amount and share percentage.
- **Alternative considered**: Custom SVG paths as in legacy ExternalProvider web client. Rejected in favor of the repo's standard shadcn/Recharts component for theme consistency, accessibility, and tooltip support.

### 3. Pure Calculation Helper for Adjusted Metrics

Create `src/app/(main)/dashboard/family-budget/_components/expense-transforms.ts`:
- Pure functions taking raw `StatPoint.categories`, category metadata, and the active `ExclusionPreset`.
- Outputs:
  - `controllableCategories`: Array of category slices for the pie chart.
  - `totalGrossExpense`: Raw expense sum.
  - `totalControllableExpense`: Expense sum omitting exclusions and income deductions.
  - `totalTaxDeductions`: Sum of income deduction categories.
  - `excludedExpenseSum`: Sum of omitted expense categories (e.g. Rent).
- Unit-testable and independent of React components.

## Risks / Trade-offs

- **[Category IDs vary across user accounts]** → Mitigation: Built-in presets use dynamic name matching (e.g. `c.name.match(/tax/i)`) on initial load to resolve the correct category IDs automatically, while allowing explicit override.
- **[A category could be deleted or renamed upstream]** → Mitigation: Transformation functions gracefully ignore unknown category IDs present in presets.
- **[Small expense slices can crowd the donut chart]** → Mitigation: Categories representing under 3% of the total can optionally be grouped into an "Other" slice in the pie view with detailed breakdown in the legend.

## Migration Plan

- Purely additive client changes under `src/app/(main)/dashboard/family-budget/_components/`.
- Placed in the Family Budget dashboard layout alongside the existing `BudgetSummaryCard`.
- No rollback or schema migration required.
