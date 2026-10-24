# Proposal

## Why

A single-month budget snapshot cannot reveal whether lifestyle spending has expanded over time or how cash flow margins have evolved during periods of flat income. ExternalProvider's `/stat/ping` endpoint already returns up to 40 chronological monthly points (over 3 years of history), but the dashboard currently uses only the latest month and discards the historical series.

Extracting and visualizing this full multi-year dataset enables Year-over-Year (YoY) comparisons, showing how spending in any given month compares to the same month in previous years under active exclusion presets.

## What Changes

- Parse and chronologically sort the full 40-point time series from `/stat/ping`.
- Implement a **Year-over-Year Aggregator** that groups historical data by calendar month across years (e.g. comparing October 2024, 2025, and 2026).
- Apply active exclusion presets across the historical timeline to compute historical Net Disposable Income and Controllable Expenses.
- Add an interactive **Year-over-Year Trends Card** to the Family Budget dashboard (`yoy-trends-card.tsx`) using shadcn/Recharts (grouped/stacked bar and line views).
- Display key trend metrics: YoY spending variance (percentage and absolute), historical savings rate trajectory, and multi-year cash flow margin.

## Capabilities

### New Capabilities
- `historical-budget-trends`: Multi-period historical time-series aggregation from `/stat/ping`, calendar month alignment across years, and historical cash flow and savings rate trend calculations.

### Modified Capabilities
- `budget-overview`: Adds the Year-over-Year Trends card and historical comparison view to the Family Budget dashboard.

## Impact

- **UI Components**: Adds `yoy-trends-card.tsx` under `src/app/(main)/dashboard/family-budget/_components/`.
- **Data Layer**: Extends `external-provider-client.ts` and `external-provider-data.ts` to expose multi-point series accessors and YoY normalization helpers.
- **Dependencies**: Uses existing shadcn/ui chart and Recharts components (`BarChart`, `LineChart`, `ChartContainer`). No new external packages.
- **API**: Reuses the verified `/stat/ping` endpoint without upstream schema changes.
