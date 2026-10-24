# Tasks

## 1. Data layer

- [x] 1.1 Create `family-budget/_components/external-provider-data.ts` with typed models for the four verified responses (settings, categories, transaction page, stats) and parse helpers for `/Exchange/Ping` double-encoded `entityJson` strings; verify with `npm run check` that types compile strict-clean
- [x] 1.2 Create `family-budget/_components/external-provider-client.ts` with abortable per-section fetch wrappers (`getSettings`, `getCategories`, `getTransactionPage`, `getBudgetSelection`) targeting `/api/external-provider/...` and typed non-credential errors; verify via browser network pane that requests contain no credential material
- [x] 1.3 Add money formatting (`Intl.NumberFormat` with currency from settings, fallback to stats `params.currency`) and date formatting from `dateTimestampISO` using `date-fns`; verify with formatted fixtures covering PLN and an unknown-currency fallback

## 2. Section components

- [x] 2.1 Implement shared `SectionShell` (loading skeleton, empty state, error message + retry) following existing card conventions (`Card`/`CardHeader`/`CardTitle`, ring token styling like `finance/_components/overview-kpis.tsx`); verify each state renders from a forced fetch result
- [x] 2.2 Implement `AccountsCard`: account/bank-account/expense categories grouped by type with balances; empty state when no accounts; verify against live proxy data in `npm run dev`
- [x] 2.3 Implement `BudgetSummaryCard`: per-category spent vs limit meters from `/stat/ping`, overrun flagged, reporting currency shown, month switch (current/previous) re-issuing the selection payload with changed `period.from`; verify overruns and currency against live data
- [x] 2.4 Implement `RecentTransactionsCard`: newest-first page from `/api/transaction/get` with direction-aware amount coloring, date, counterpart/comment, and a "load more" that appends using `hasMoreData` without duplicates; verify continuation against live data

## 3. Screen assembly

- [x] 3.1 Create `src/app/(main)/dashboard/family-budget/page.tsx` as a Server Component composing the sections with `metadata` and canonical `/dashboard/family-budget`, matching finance-screen rhythm (12-col responsive grids); verify layout at mobile/tablet/desktop widths
- [x] 3.2 Add a "Family Budget" entry to `src/navigation/sidebar/sidebar-items.ts` (Dashboards group, near Finance); verify the sidebar highlights and navigates correctly

## 4. Validation

- [x] 4.1 Run `npm run check` and `npm run build`; fix any type or lint issues; verify both pass
- [x] 4.2 Exercise all spec scenarios against live data in the running dev server: each section's loading → data, one-section failure + retry (e.g. revoke cookie temporarily via proxy 503), empty transaction page via `take`-1 sanity probe, period switch refresh; record observed results in the change notes
