# Tasks

## 1. Historical Series & Net Worth Transform Engine

- [ ] 1.1 Extend `src/app/(main)/dashboard/family-budget/_components/yoy-transforms.ts` with a chronological timeline series builder (`transformChronologicalTrends`) that outputs monthly `netIncome`, `controllableExpense`, `netCashFlowMargin`, reconstructed `liquidBalance`, and `netWorth` points, and verify `npm run verify` succeeds
- [ ] 1.2 Add windowing and zoom helpers (`6M`, `12M`, `24M`, `40M`, and custom `[from, to]` filtering) in `yoy-transforms.ts` and verify unit tests in `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts` pass

## 2. Multi-Mode Macro Chart & Timeline UI

- [ ] 2.1 Update `src/app/(main)/dashboard/family-budget/_components/yoy-trends-card.tsx` and `budget-overview-dashboard.tsx` to pass `currencies` and support the 5 ExternalProvider Web macro modes (`Expenses & Income`, `Expenses`, `Income`, `Balance`, `Net Worth`) plus `Cash Flow Margin`, verifying the mode selector renders and switches series cleanly
- [ ] 2.2 Add Continuous Timeline vs. Year-over-Year view switching and `+` / `-` range zoom controls to `YoYTrendsCard`, including dual-curve rendering and surplus/deficit tooltips for `Expenses & Income`, and verify `npm run verify` passes with zero errors
