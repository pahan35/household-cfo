# Proposal

## Why

Raw personal finance numbers from ExternalProvider mix non-discretionary fixed obligations (such as taxes and rent) with everyday controllable spending, obscuring how much money the family is actually causing to be spent. Furthermore, taxes are currently lumped into regular expenses rather than deducted from income, preventing a true view of net disposable income.

Introducing reusable client-side exclusion presets alongside an interactive expense pie chart enables immediate visibility into actionable expenses and true disposable income without altering upstream ExternalProvider records.

## What Changes

- Introduce a client-side **Exclusion Presets Engine** stored in `localStorage` that classifies categories into:
  - **Income Deductions**: Categories (e.g. Taxes) subtracted from Gross Income to yield Net Disposable Income.
  - **Expense Exclusions**: Categories (e.g. Rent / Fixed Housing) optionally omitted from spending totals and distributions.
- Provide out-of-the-box presets:
  - **All Activity**: Raw unadjusted figures.
  - **Net Living**: Taxes deducted from income; all expenses shown.
  - **Controllable Expenses**: Taxes deducted from income; Rent excluded from expenses.
  - **Custom Presets**: Ability to create, save, and select custom exclusion configurations.
- Add an interactive **Expense Composition Pie/Donut Chart** to the Family Budget dashboard (`/dashboard/family-budget`) displaying category proportions for the active period.
- Add dynamic preset selection and quick toggles (e.g. "Exclude Rent", "Deduct Tax") directly on the chart card.
- Display a **Net Disposable Income** summary metric showing Gross Income minus Tax Deductions.

## Capabilities

### New Capabilities
- `expense-customization`: Client-side category role classification (tax deductions vs expense exclusions), reusable exclusion presets persisted to local storage, and calculation of net disposable income and controllable expenses.

### Modified Capabilities
- `budget-overview`: Adds the interactive Expense Composition Pie Chart and Net Disposable Income summary to the Family Budget overview dashboard.

## Impact

- **UI Components**: Adds `expense-pie-card.tsx` and preset management controls under `src/app/(main)/dashboard/family-budget/_components/`.
- **State & Storage**: Adds client-side local storage utilities/hooks for managing exclusion presets.
- **Dependencies**: Uses existing shadcn/ui chart components (`ChartContainer`, `ChartTooltip`) and Recharts primitives (`PieChart`, `Pie`, `Cell`). No new npm packages required.
- **Upstream / API**: No new API endpoints or upstream changes required; consumes existing `/stat/ping` data.
