# Tasks

## 1. Sidebar Navigation & Route Setup

- [x] 1.1 Update `src/navigation/sidebar/sidebar-items.ts` to add a top-level `"Family Budget"` group above `"Dashboards"`, moving `/dashboard/family-budget` into it as `"Overview"` and adding `/dashboard/family-budget/fx-inflation` as `"FX & Inflation"`.
- [x] 1.2 Create the Server Component route `src/app/(main)/dashboard/family-budget/fx-inflation/page.tsx` with page metadata and header layout matching `/dashboard/family-budget/page.tsx`.

## 2. Macro Data Series & Transformation Logic

- [x] 2.1 Create `src/app/(main)/dashboard/family-budget/_components/macro-data.ts` containing monthly Polish CPI indices and USD/PLN historical average exchange rates (2023–2026); verify data covers the 40-month timeline without gaps.
- [x] 2.2 Implement `src/app/(main)/dashboard/family-budget/_components/macro-transforms.ts` with real purchasing power deflation and dual-currency conversion helpers; verify real income deflation matches expected CPI erosion.
- [x] 2.3 Add forward FX sensitivity projection logic to `macro-transforms.ts`; verify projected PLN margin calculations against varying simulated exchange rates and tax percentages.

## 3. FX & Inflation Analysis Screen Components

- [x] 3.1 Implement the CPI Inflation Erosion & Dual-Currency historical chart component using shadcn/Recharts (`AreaChart` / `LineChart`) with PLN/USD currency context toggle; verify chart displays the nominal vs. real purchasing power curve accurately.
- [x] 3.2 Implement the interactive Forward USD/PLN Sensitivity Simulator component with USD salary input, USD/PLN exchange rate slider (`3.50` – `4.80`), tax deduction slider, and projected monthly PLN buffer/margin breakdown; verify moving sliders updates projected PLN figures in real time.
- [x] 3.3 Assemble `src/app/(main)/dashboard/family-budget/_components/fx-inflation-dashboard.tsx` connecting ExternalProvider historical `/stat/ping` and controllable expense data with the macro analysis cards, and wire it into `fx-inflation/page.tsx`.
- [x] 3.4 Run `npm run verify` (`biome check && tsc --noEmit`) to verify type safety, linting, formatting, and build readiness.
