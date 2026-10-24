# Tasks

## 1. Macro Data Series & Transformation Logic

- [ ] 1.1 Create `macro-data.ts` containing monthly Polish CPI indices and USD/PLN historical average exchange rates (2023–2026); verify data covers the 40-month timeline without gaps.
- [ ] 1.2 Implement `macro-transforms.ts` with real purchasing power deflation and dual-currency conversion helpers; verify real income deflation matches expected CPI erosion.
- [ ] 1.3 Add forward FX sensitivity projection logic to `macro-transforms.ts`; verify projected PLN margin calculations against varying simulated rates.

## 2. Macro & FX Analysis Component

- [ ] 2.1 Implement `macro-fx-analysis-card.tsx` with tabs for Inflation Erosion and FX Sensitivity Simulation; verify component mounts and toggles tabs cleanly.
- [ ] 2.2 Render the Nominal vs Real Purchasing Power area chart using shadcn/Recharts; verify chart displays the flat salary erosion line accurately.
- [ ] 2.3 Build the interactive USD/PLN rate slider and projected monthly buffer gauge in the simulation tab; verify moving the slider updates projected PLN figures in real time.

## 3. Dashboard Integration & Verification

- [ ] 3.1 Place `MacroFxAnalysisCard` into `family-budget-dashboard.tsx` layout; verify responsive behavior on desktop and mobile.
- [ ] 3.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify type safety, linting, formatting, and build readiness.
