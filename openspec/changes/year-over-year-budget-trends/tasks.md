# Tasks

## 1. Historical Data Transformation

- [ ] 1.1 Implement `yoy-transforms.ts` to parse, sort, and group 40 `/stat/ping` points by calendar year and month index; verify output alignment with sample multi-year points.
- [ ] 1.2 Add preset-aware mapping to `yoy-transforms.ts` to compute historical Net Income, Controllable Expenses, and YoY delta percentages; verify math across consecutive years.

## 2. Year-over-Year Trends Component

- [ ] 2.1 Implement `yoy-trends-card.tsx` using `ChartContainer` and Recharts grouped `BarChart` / `LineChart` to display multi-year monthly comparisons; verify component renders multi-year series cleanly.
- [ ] 2.2 Add view switcher (Controllable Expenses vs Cash Flow / Net Margin) and interactive tooltips showing YoY percentage change; verify metric toggles update chart series.
- [ ] 2.3 Implement month-click selection handler to allow focusing the dashboard on a selected historical month; verify selection updates parent dashboard state.

## 3. Integration & Validation

- [ ] 3.1 Place `YoYTrendsCard` in `family-budget-dashboard.tsx` layout and connect active exclusion preset and period props; verify layout responsiveness.
- [ ] 3.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify end-to-end type safety, linting, and build readiness.
