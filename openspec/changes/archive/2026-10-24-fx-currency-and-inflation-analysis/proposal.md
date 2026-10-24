# Proposal

## Why

Two external macroeconomic factors heavily distort personal finance analysis when evaluated purely on nominal local currency:
1. **Inflation Erosion**: A flat nominal salary over 2 years in Poland resulted in a significant loss of real purchasing power due to cumulative CPI inflation, masking whether budget stress came from increased family spending or macro price increases.
2. **Currency Transition**: Having historical USD income (2023 to mid-2024), shifting to PLN income (mid-2024 to 2026), and returning to USD income next month makes the USD/PLN exchange rate a governing factor for monthly margins when expenses remain in PLN.

Layering inflation deflation and USD/PLN foreign exchange analysis onto the budget data enables separating personal lifestyle decisions from macroeconomic forces and allows forecasting the upcoming USD income transition.

At the same time, the main `/dashboard/family-budget` overview screen already hosts 5 full-width analytical sections, and the sidebar currently buries "Family Budget" inside the template's generic `Dashboards` group. Elevating **Family Budget** into its own top-level sidebar group above `Dashboards` reflects the application's primary focus and allows **FX & Inflation Analysis** to live on its own dedicated page (`/dashboard/family-budget/fx-inflation`) without overcrowding the overview dashboard.

## What Changes

- **Sidebar Navigation Restructuring**: Add a dedicated `"Family Budget"` top-level sidebar group above `"Dashboards"` in `src/navigation/sidebar/sidebar-items.ts`, containing `"Overview"` (`/dashboard/family-budget`, moved out of `"Dashboards"`) and `"FX & Inflation"` (`/dashboard/family-budget/fx-inflation`).
- **Dedicated FX & Inflation Page**: Create `src/app/(main)/dashboard/family-budget/fx-inflation/page.tsx` and its client dashboard view under the shared `/dashboard` layout shell.
- **Polish CPI Inflation Deflator**: Calculate and visualize "Real Purchasing Power Income" vs. "Nominal Income" over the 2-year flat salary period in a dedicated Inflation Erosion card.
- **Historical USD/PLN Exchange Rate Context**: Support dual-currency normalization (toggling historical figures and trends between PLN and USD).
- **Forward FX Sensitivity Simulator**: Provide an interactive simulator card for the upcoming USD income transition, allowing interactive rate adjustment (e.g. 3.50 – 4.80 PLN per USD) and tax rate configuration to project monthly PLN budget buffers against current controllable expenses.

## Capabilities

### New Capabilities
- `macro-currency-analysis`: Dedicated `/dashboard/family-budget/fx-inflation` screen providing inflation index normalization (Real vs Nominal purchasing power), dual-currency (USD/PLN) historical conversion, and forward FX rate sensitivity simulation.

### Modified Capabilities
- `budget-overview`: Promotes Family Budget into a top-level `"Family Budget"` sidebar group above `"Dashboards"` with `"Overview"` (`/dashboard/family-budget`) and `"FX & Inflation"` (`/dashboard/family-budget/fx-inflation`) entries.

## Impact

- **Navigation**: Updates `src/navigation/sidebar/sidebar-items.ts` to add the top-level `"Family Budget"` group above `"Dashboards"` (automatically reflected in `NavMain` and `SearchDialog`).
- **Routes & UI Components**: Adds `src/app/(main)/dashboard/family-budget/fx-inflation/page.tsx` and macro/FX analysis components under `src/app/(main)/dashboard/family-budget/_components/`.
- **Data & Models**: Adds static/cached monthly CPI indices (GUS Poland) and monthly USD/PLN historical average exchange rates (NBP).
- **Dependencies**: Leverages existing shadcn/ui charts (`ChartContainer`, `LineChart`, `AreaChart`). No new external packages.
- **Upstream / API**: No ExternalProvider upstream changes needed; operates on existing historical `/stat/ping` and transaction data points with macro coefficients applied.
