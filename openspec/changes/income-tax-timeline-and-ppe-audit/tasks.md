# Tasks

## 1. Tax Tag Updates & Audit Expectations

- [ ] 1.1 Update `KNOWN_TAX_BUCKETS` in `tax-transforms.ts` to set `#PPE` as canonical for personal income tax and `#VAT-7` as canonical for VAT remittances (preserving aliases), and verify with updated unit tests in `tax-transforms.test.ts`.
- [ ] 1.2 Update `TaxAuditCard` and `TaxBreakdownCard` UI labels, descriptions, and dropdown selectors to present `#PPE` and `#VAT-7`, and verify that transactions tagged `#PPE` or `#VAT-7` are not flagged as untagged.

## 2. Historical Timeline Data Engine

- [ ] 2.1 Implement `computeIncomeTaxTimeline` in `tax-transforms.ts` to aggregate transactions into monthly points (`yyyy-MM`), isolating client revenue by source, net ZUS after PFRON contra-rebates, PPE, Health, and effective tax rate with Cash vs. Accrual mode support.
- [ ] 2.2 Add unit tests for `computeIncomeTaxTimeline` in `tax-transforms.test.ts` verifying monthly grouping, PFRON netting, source filtering, and $M-1$ accrual shift.

## 3. Timeline UI Component & Dashboard Integration

- [ ] 3.1 Build `IncomeTaxTimelineCard` in `src/app/(main)/dashboard/family-budget/_components/income-tax-timeline-card.tsx` using Recharts, with stacked tax bars, gross turnover comparison, effective rate trendline, source toggle chips, and Cash/Accrual toggle.
- [ ] 3.2 Integrate `IncomeTaxTimelineCard` into `IncomeDashboard` on `/dashboard/family-budget/income` and ensure transaction querying fetches sufficient historical depth for income and tax categories.

## 4. Verification & Polish

- [ ] 4.1 Run `npm run verify` (`biome check && tsc --noEmit`) to verify zero linting, formatting, or TypeScript errors across the codebase.
