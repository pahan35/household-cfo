# Proposal

## Why

ExternalProvider Web provides a unified macro chart window (`EXPENSES AND INCOME`, `EXPENSES`, `INCOME`, `BALANCE`, `NET WORTH`) with smooth dual-line overlays, zoom (`+` / `-`), and flexible period selectors (`budget` / `your period`), whereas our current `/dashboard/family-budget/budget-overview` trends card only compares single-metric year-over-year monthly bars/lines (`Controllable Expenses`, `Cash Flow Margin`, or `Net Income`). Adding macro `Expenses & Income` dual-curve overlays alongside historical `Balance` and `Net Worth` trajectories gives users a complete picture of both monthly cash flow and cumulative wealth progression.

## What Changes

- **Multi-Mode Macro Chart Window on Budget Overview**:
  - Extend the trends section on `/dashboard/family-budget/budget-overview` to support ExternalProvider Web's five macro chart modes:
    1. **Expenses & Income**: Dual-series smooth line/bar chart overlaying monthly controllable expenses against net disposable income on the same timeline to visualize surplus/deficit gaps at a glance.
    2. **Expenses**: Dedicated controllable expense trajectory (preserving existing Year-over-Year comparison and continuous timeline views).
    3. **Income**: Dedicated net/gross income trajectory.
    4. **Balance**: Historical end-of-month liquid account balance trajectory (converted to default currency and respecting `exceptFromBalance`).
    5. **Net Worth**: Historical end-of-month total net worth trajectory combining liquid accounts, goal/savings accounts, and debt/clearing balances.
- **Continuous Timeline, Custom Period Range & Zoom Controls**:
  - Add a toggle between **Continuous Timeline** (`APR'26 -> OCT'26` chronological curve like ExternalProvider Web) and **Year-over-Year Calendar Alignment** (`Jan -> Dec` grouped by year).
  - Add quick range zoom (`+` / `-` to step between 6M, 12M, 24M, and full 40M windows) and custom `[from, to]` period selection.

## Capabilities

### New Capabilities
<!-- None; this extends existing macro budget overview and historical trend capabilities. -->

### Modified Capabilities
- `budget-overview`: Extend the historical trends chart section to support switching between `Expenses & Income` (dual curve), `Expenses`, `Income`, `Balance`, and `Net Worth` modes, plus continuous timeline vs. YoY views and range zoom controls.
- `historical-budget-trends`: Add historical series computation for dual `Expenses & Income` overlays and monthly `Balance` / `Net Worth` trajectories derived from ExternalProvider `/stat/ping` and account/transaction history.

## Impact

- **Components & Transforms**: Updates `src/app/(main)/dashboard/family-budget/_components/yoy-trends-card.tsx`, `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts`, and `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`.
- **Tests**: Extends `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts` with unit tests for `Expenses & Income` dual series, `Balance` / `Net Worth` historical point reconstruction, and timeline range windowing.
- **Data & Upstream API**: Uses existing `/api/external-provider/stat/ping`, `/api/external-provider/Exchange/Ping`, and `/api/external-provider/api/transaction/get` proxy routes without new upstream endpoints.
