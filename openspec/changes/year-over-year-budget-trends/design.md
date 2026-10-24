# Design

## Context

ExternalProvider's `/stat/ping` returns up to 40 chronological points (each representing a calendar month). Currently, `BudgetSummaryCard` only uses the active month point.

Change 1 (`custom-expense-pie-and-presets`) introduces the `ExclusionPreset` model. This change takes that model and applies it across the entire multi-year series to enable Year-over-Year (YoY) trend analysis.

## Goals / Non-Goals

**Goals:**
- Ingest and normalize the full 40-point series from `/stat/ping`.
- Transform chronological points into calendar-aligned YoY data structures (e.g. Month vs. Year comparisons).
- Apply the active `ExclusionPreset` across all historical periods.
- Render a grouped Bar/Line chart comparing spending and income across years using shadcn/Recharts.
- Provide interactive hover tooltips showing year-over-year deltas (e.g. "+12% vs Oct 2025").

**Non-Goals:**
- External inflation rates or foreign exchange adjustments (scoped to Change 3).
- Adding new endpoints or fetching beyond the existing `/stat/ping` contract.

## Decisions

### 1. Pure Transformer Layer for YoY Aggregation

Create `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts`:
- Groups points into year buckets (`yearMap: Map<number, MonthPoint[]>`).
- Formats aligned monthly comparison records for Recharts:
  ```typescript
  export interface YoYMonthData {
    monthIndex: number;     // 0-11
    monthLabel: string;     // "Jan", "Feb", ...
    years: Record<number, {
      controllableExpense: number;
      netIncome: number;
      totalExpense: number;
      savingsRate: number;
    }>;
  }
  ```
- Computes YoY variance: `((currentYearAmount - previousYearAmount) / previousYearAmount) * 100`.

### 2. Chart Layout & Visual Hierarchy

- Implement `yoy-trends-card.tsx` in `_components/`.
- Uses shadcn `ChartContainer` with Recharts `BarChart` (grouped bars per month) or `LineChart` (overlapping multi-year lines).
- Palette maps each year to distinct semantic theme tokens (`--color-chart-1` for 2024, `--color-chart-2` for 2025, `--color-chart-3` for 2026).
- Action buttons in header allow toggling between "Controllable Expenses" and "Net Income vs Expenses".

### 3. Bidirectional Month Selection Sync

- Clicking a month column on the YoY chart can trigger an `onMonthSelect` callback to focus the rest of the dashboard (the budget summary and expense pie) on that historical period.

## Risks / Trade-offs

- **[Gaps in historical data for certain months]** → Mitigation: Transformer inserts `null` values for missing months so Recharts does not misalign subsequent months.
- **[Visual clutter with 3+ years on mobile]** → Mitigation: On mobile screens (`sm`/`xs`), the chart displays the 2 most recent years by default with a scrollable container or year toggle.

## Migration Plan

- Purely additive client components under `family-budget/_components/`.
- Placed in the overview grid below the monthly cards.
