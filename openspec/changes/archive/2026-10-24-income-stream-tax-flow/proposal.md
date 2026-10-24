# Proposal

## Why

The current budget overview and income analytics conflate income targets with spending limits and misrepresent the user's tax and foreign-exchange reality. Income sources with target budgets appear in "Budget Spent vs Limit" as 100% spending overruns, while "Tax Deductions by Tag" displays unrelated non-tax transactions on fallback, distorts disposable income by treating pass-through VAT-7 as personal tax expense, and mislabels PFRON refunds ("Cashback taxes") as top-line revenue rather than a 60% rebate against ZUS social security payments. Additionally, USD income streams suffer unmeasured friction from bank/Kantor exchange spreads and currency-rate movements on fixed-PLN VAT liabilities.

## What Changes

- **Budget Overview Spend Isolation**: Restrict the "Budget Spent vs Limit" summary exclusively to expense categories (`CategoryType.Expense`), preventing income sources and their target limits from appearing as spend budgets.
- **PFRON ZUS Contra-Rebate Netting**: Recognize the `"Cashback taxes"` income source as a PFRON subsidy that offsets and nets against ZUS social security contributions rather than inflating gross business revenue.
- **VAT-7 Pass-Through Exclusion**: Treat Polish VAT-7 remittances as neutral pass-through taxes excluded from personal tax burden and disposable income analytics.
- **USD FX Friction & VAT Currency Drag**: Compute and visualize realized foreign exchange friction for USD income streams, including trade spread (realized Kantor rate vs. NBP mid-market rate) and VAT currency delta (the extra USD needed to pay fixed-PLN VAT liabilities due to exchange rate shifts).
- **Income Streams & Tax Flow Visualization**: Replace "Tax Deductions by Tag" with an "Income Streams & Tax Flow" card that maps gross earnings through FX drag, net ZUS (after PFRON), and PIT down to true net disposable cash flow.
- **Ledger Fallback Remediation**: Remove the fallback that loaded 50 arbitrary non-tax transactions in the Income & Taxes transaction ledger when no tax transactions matched.

## Capabilities

### Modified Capabilities
- `budget-overview`: Modify the budget spent-versus-limit requirement to strictly exclude income sources (`CategoryType.Income`) and only compute spending metrics for expense categories.
- `income-and-tax-management`: Modify tax categorization and net disposable income analytics to exclude pass-through VAT-7, net `"Cashback taxes"` against ZUS, track USD FX trade and VAT-7 conversion friction, and replace the tag-deduction view with a stream-to-net tax flow.

## Impact

- **Client Code**:
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/tax-transforms.ts`
  - `src/app/(main)/dashboard/family-budget/_components/tax-breakdown-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/income-metrics-strip.tsx`
- **Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/tax-transforms.test.ts`
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/spending-metrics.test.ts`
- **Data Models**: Enhanced tax summary types supporting ZUS gross/rebate/net, VAT-7 pass-through segregation, and USD FX friction metrics.
