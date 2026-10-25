# Tasks

## 1. Data Transforms & Hook Enhancements

- [x] 1.1 Update `use-exclusion-presets.ts` to support explicit category exclusion management, preset renaming, creating/updating presets, and saving exact category IDs without regex reliance; verify with unit tests.
- [x] 1.2 Update `yoy-transforms.ts` to compute `availableControllablePool` (`netDisposableIncome - excludedExpenseSum`), map the timeline and YoY Income curve to the pool when exclusions are active, and align `savingsRate` calculation to `(netCashFlowMargin / netDisposableIncome) * 100`; verify with unit tests.

## 2. Preset Configuration Dialog & UI Integration

- [x] 2.1 Implement `PresetDialog` (`src/app/(main)/dashboard/family-budget/_components/preset-dialog.tsx`) using shadcn Dialog, Checkbox, and Input primitives, allowing users to filter categories, toggle exclusions, and save presets to `localStorage`; verify component compilation and layout.
- [x] 2.2 Add manage presets trigger button (`[⚙]`) next to the Preset Selector in `ExpensePieCard` (`src/app/(main)/dashboard/family-budget/_components/expense-pie-card.tsx`), wiring it to open `PresetDialog` and update active exclusions; verify dialog launches and applies changes.
- [x] 2.3 Update `YoYTrendsCard` (`src/app/(main)/dashboard/family-budget/_components/yoy-trends-card.tsx`) tooltips and metric descriptions to clearly indicate the Controllable Income Pool and deducted fixed obligations (Rent, Insurance); verify tooltip and curve alignment in both Timeline and YoY modes.

## 3. Verification & Quality Gates

- [x] 3.1 Add unit tests in `spending-metrics.test.ts` verifying multi-category exclusions (e.g. Rent and Insurance PLN), income pool negation, and invariant curve delta matching net cash flow margin; verify with `npm run test` or `npm run verify`.
- [x] 3.2 Run `npm run verify` (`biome check && tsc --noEmit`) to ensure clean formatting, zero lint errors, and complete TypeScript strict type safety.
