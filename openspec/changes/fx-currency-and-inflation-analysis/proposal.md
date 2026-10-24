# Proposal

## Why

Two external macroeconomic factors heavily distort personal finance analysis when evaluated purely on nominal local currency:
1. **Inflation Erosion**: A flat nominal salary over 2 years in Poland resulted in a significant loss of real purchasing power due to cumulative CPI inflation, masking whether budget stress came from increased family spending or macro price increases.
2. **Currency Transition**: Having historical USD income (2023 to mid-2024), shifting to PLN income (mid-2024 to 2026), and returning to USD income next month makes the USD/PLN exchange rate a governing factor for monthly margins when expenses remain in PLN.

Layering inflation deflation and USD/PLN foreign exchange analysis onto the budget data enables separating personal lifestyle decisions from macroeconomic forces and allows forecasting the upcoming USD income transition.

## What Changes

- Add a **Polish CPI Inflation Deflator** series to calculate and visualize "Real Purchasing Power Income" vs. "Nominal Income" over the 2-year flat salary period.
- Add **Historical USD/PLN Exchange Rate Context** and dual-currency normalization (toggle whole dashboard or trend views between PLN and USD).
- Provide a **Forward FX Sensitivity Simulator** for the upcoming USD income, allowing interactive rate adjustment (e.g. 3.80, 4.00, 4.25 PLN per USD) to project monthly PLN budget buffers.
- Add an interactive **Macro & FX Analysis Card** (`macro-fx-analysis-card.tsx`) to the Family Budget dashboard.

## Capabilities

### New Capabilities
- `macro-currency-analysis`: Inflation index normalization (Real vs Nominal purchasing power), dual-currency (USD/PLN) historical conversion, and forward FX rate sensitivity simulation.

### Modified Capabilities
- `budget-overview`: Adds the Macro & FX Analysis card to the Family Budget dashboard.

## Impact

- **UI Components**: Adds `macro-fx-analysis-card.tsx` under `src/app/(main)/dashboard/family-budget/_components/`.
- **Data & Models**: Adds static/cached monthly CPI indices (GUS Poland) and monthly USD/PLN historical average exchange rates.
- **Dependencies**: Leverages existing shadcn/ui charts (`ChartContainer`, `LineChart`, `AreaChart`). No new external packages.
- **Upstream / API**: No ExternalProvider upstream changes needed; operates on existing historical `/stat/ping` data points with macro coefficients applied.
