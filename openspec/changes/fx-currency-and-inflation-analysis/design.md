# Design

## Context

The user experienced a 2-year period of flat nominal salary in PLN during high Polish inflation (2024–2026), and previously received USD income (2023 to mid-2024). Next month, income transitions back to USD while the primary living expenses remain in PLN.

Understanding true financial progress requires decoupling macro inflation and currency exchange movements from domestic spending decisions.

## Goals / Non-Goals

**Goals:**
- Provide a typed historical dataset of monthly Polish CPI indices and USD/PLN exchange rates (2023–2026).
- Calculate and plot Real Purchasing Power Income vs. Nominal Income over the flat-salary timeline.
- Implement an interactive Forward FX Sensitivity Simulator for upcoming USD salary against PLN living expenses.
- Support dual-currency viewing (converting figures between PLN and USD).

**Non-Goals:**
- Real-time automated bank currency transfers.
- Live streaming forex feeds (historical monthly averages and interactive simulation are sufficient).

## Decisions

### 1. Embedded Macro Series with Public Baseline

Create `src/app/(main)/dashboard/family-budget/_components/macro-data.ts`:
- Historical monthly Polish CPI index (GUS data, normalized with Jan 2024 = 100).
- Historical monthly USD/PLN average exchange rates (NBP monthly tables).
- Embedding the monthly series ensures instant rendering, offline availability, and zero network flakiness.

### 2. Deflator & FX Calculation Helpers

Create `src/app/(main)/dashboard/family-budget/_components/macro-transforms.ts`:
- `calculateRealIncome(nominalIncome, monthKey, baseMonthKey)`: Returns purchasing power adjusted for cumulative CPI.
- `convertCurrency(amount, fromCurrency, toCurrency, monthKey)`: Applies monthly FX rate.
- `simulateUsdIncome(usdAmount, fxRate, currentPlnExpenses)`: Returns projected PLN net margin and savings rate.

### 3. UI Component Structure

- Implement `macro-fx-analysis-card.tsx` in `_components/`:
  - Tab 1: **Inflation Impact (Real vs Nominal Income)**: Recharts `AreaChart` with Nominal Salary (flat horizontal line) vs. Real Purchasing Power (descending curve).
  - Tab 2: **USD/PLN Sensitivity Simulator**: Slider controlling USD/PLN rate (3.50 – 4.80) with projected monthly PLN margin and savings rate gauge.

## Risks / Trade-offs

- **[CPI updates lag current month by ~2-3 weeks]** → Mitigation: Use latest published GUS flash estimate or carry over the previous month's rate for in-progress months.
- **[Tax rules differ under USD income contracts]** → Mitigation: The simulator includes an adjustable tax deduction % slider so the user can accurately model their tax structure.

## Migration Plan

- Purely additive client components under `family-budget/_components/`.
- Placed in the Family Budget dashboard layout.
