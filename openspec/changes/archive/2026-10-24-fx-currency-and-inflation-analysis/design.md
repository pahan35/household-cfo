# Design

## Context

The user experienced a 2-year period of flat nominal salary in PLN during high Polish inflation (2024–2026), and previously received USD income (2023 to mid-2024). Next month, income transitions back to USD while the primary living expenses remain in PLN.

Understanding true financial progress requires decoupling macro inflation and currency exchange movements from domestic spending decisions. Furthermore, because the main `/dashboard/family-budget` overview screen already renders 5 dense sections (metrics strip, accounts, expense composition pie, YoY historical trends, budget limits, and recent transactions), adding deep macroeconomic and FX simulation views warrants its own screen under a dedicated **Family Budget** sidebar group.

## Goals / Non-Goals

**Goals:**
- Introduce a top-level `"Family Budget"` sidebar group above `"Dashboards"` in `src/navigation/sidebar/sidebar-items.ts` containing `"Overview"` (`/dashboard/family-budget`) and `"FX & Inflation"` (`/dashboard/family-budget/fx-inflation`).
- Keep all Family Budget routes inside `src/app/(main)/dashboard/family-budget/` so they share `src/app/(main)/dashboard/layout.tsx` without remounting the sidebar/header shell on navigation and co-locate shared ExternalProvider utilities in `src/app/(main)/dashboard/family-budget/_components/`.
- Provide a typed historical dataset of monthly Polish CPI indices and USD/PLN exchange rates (2023–2026).
- Calculate and plot Real Purchasing Power Income vs. Nominal Income over the flat-salary timeline.
- Implement an interactive Forward FX Sensitivity Simulator for upcoming USD salary against PLN living expenses.
- Support dual-currency viewing (converting historical figures between PLN and USD).

**Non-Goals:**
- Moving routes outside `/dashboard/...` (which would break or duplicate `src/app/(main)/dashboard/layout.tsx`).
- Real-time automated bank currency transfers.
- Live streaming forex feeds (historical monthly averages and interactive simulation are sufficient).

## Decisions

### 1. Sidebar Group & Route Co-location

- **Sidebar Structure (`src/navigation/sidebar/sidebar-items.ts`)**:
  - Prepend a new `NavGroup` labeled `"Family Budget"` above `"Dashboards"`.
  - Move the existing Family Budget link from `"Dashboards"` into `"Family Budget"` as `"Overview"` (`/dashboard/family-budget`, `PiggyBank` icon).
  - Add `"FX & Inflation"` (`/dashboard/family-budget/fx-inflation`, `TrendingUp` or `ArrowLeftRight` icon) as the second item in the `"Family Budget"` group.
  - Because `NavMain` checks `path === item.url` for flat `NavMainLinkItem` entries, `/dashboard/family-budget` and `/dashboard/family-budget/fx-inflation` highlight independently, and `SearchDialog` (`Cmd+J`) automatically groups both under `"Family Budget"`.
- **Route Structure (`src/app/(main)/dashboard/family-budget/fx-inflation/page.tsx`)**:
  - Keep `page.tsx` as a Server Component providing metadata and the page header (`FX & Inflation Analysis`), rendering a client `FxInflationDashboard` component.
  - Reuse shared ExternalProvider data fetchers (`external-provider-client.ts`), exclusion presets (`use-exclusion-presets.ts`), and expense transforms (`expense-transforms.ts`) from `src/app/(main)/dashboard/family-budget/_components/`.

### 2. Embedded Macro Series with Public Baseline

Create `src/app/(main)/dashboard/family-budget/_components/macro-data.ts`:
- Historical monthly Polish CPI index (GUS data, normalized with Jan 2024 = 100).
- Historical monthly USD/PLN average exchange rates (NBP monthly tables).
- Embedding the monthly series ensures instant rendering, offline availability, and zero network flakiness.

### 3. Deflator & FX Calculation Helpers

Create `src/app/(main)/dashboard/family-budget/_components/macro-transforms.ts`:
- `calculateRealIncome(nominalIncome, monthKey, baseMonthKey)`: Returns purchasing power adjusted for cumulative CPI.
- `convertCurrency(amount, fromCurrency, toCurrency, monthKey)`: Applies monthly FX rate.
- `simulateUsdIncome(usdAmount, fxRate, taxRatePct, currentPlnExpenses)`: Returns projected PLN gross/net income, net margin, and savings rate.

### 4. Dedicated Screen Component Structure

Instead of cramming both tools into tabs inside a single card on the overview page, the dedicated `/dashboard/family-budget/fx-inflation` screen gives each tool full visual breathing room:
- **Top Control & KPI Strip**: Reporting currency toggle (`PLN` / `USD`), active exclusion preset indicator, cumulative CPI erosion metric, and current/simulated USD/PLN rate summary.
- **Inflation Impact Card (Real vs Nominal Income & Expenses)**: Recharts `AreaChart` / `LineChart` showing Nominal Income vs. Real Purchasing Power (CPI-deflated) and dual-currency normalized cash flow across the historical timeline.
- **Forward USD/PLN Sensitivity Simulator Card**: Interactive controls for USD gross amount, USD/PLN exchange rate slider (`3.50` – `4.80`), and tax deduction % slider, displaying projected PLN net disposable income, controllable expense coverage, and monthly savings buffer gauge across rate scenarios.

## Risks / Trade-offs

- **[CPI updates lag current month by ~2-3 weeks]** → Mitigation: Use latest published GUS flash estimate or carry over the previous month's rate for in-progress months.
- **[Tax rules differ under USD income contracts]** → Mitigation: The simulator includes an adjustable tax deduction % slider so the user can accurately model their tax structure.

## Migration Plan

- Move the `"Family Budget"` sidebar entry from `"Dashboards"` to the new top-level `"Family Budget"` group in `src/navigation/sidebar/sidebar-items.ts` (keeping `/dashboard/family-budget` URL intact so existing links and bookmarks continue to work).
- Add the new route `src/app/(main)/dashboard/family-budget/fx-inflation/page.tsx` and co-located macro components under `src/app/(main)/dashboard/family-budget/_components/`.
