# Tasks

## 1. Data Transformation & Presets Engine

- [ ] 1.1 Implement `expense-transforms.ts` for filtering excluded categories, calculating tax deductions, and computing net disposable income and controllable expenses; verify calculation outputs via unit tests or assertions.
- [ ] 1.2 Implement `use-exclusion-presets.ts` hook managing preset definitions, active preset state, and `localStorage` persistence with auto-matching for default Tax and Rent categories; verify presets persist across browser sessions.

## 2. Expense Pie Chart Component

- [ ] 2.1 Implement `expense-pie-card.tsx` using shadcn/Recharts `PieChart`, `Pie`, `Cell`, and `ChartContainer` to render a donut chart of controllable expenses; verify component renders with category slices and semantic theme tokens.
- [ ] 2.2 Add preset selector and quick exclusion toggle ("Exclude Rent") to `expense-pie-card.tsx`; verify toggling immediately recalculates slices and metrics.
- [ ] 2.3 Implement interactive tooltip and category breakdown legend displaying category names, formatted amounts, and percentages; verify legend displays correct values and handles small slices cleanly.

## 3. Dashboard Integration & Verification

- [ ] 3.1 Integrate `ExpensePieCard` into `family-budget-dashboard.tsx` layout and pass active period data; verify the card fits the responsive dashboard grid.
- [ ] 3.2 Display Net Disposable Income metric alongside Gross Income and Controllable Expenses; verify calculations update on period and preset changes.
- [ ] 3.3 Run `npm run check` and `npm run build` to verify type safety, linting, formatting, and build success.
