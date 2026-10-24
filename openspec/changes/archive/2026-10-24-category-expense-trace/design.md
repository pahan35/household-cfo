# Design

## Context

The Budget Overview dashboard (`/dashboard/family-budget/budget-overview`) currently displays high-level statistics: KPIs, an Expenses Breakdown donut chart with category list, YoY historical trends, and category budget limits. While users can see that a category like "Groceries" spent 2,417 PLN (+567 PLN vs baseline), they cannot inspect the individual transactions that comprise this amount without leaving the screen.

The ExternalProvider API supports date-windowed transaction queries (`period: { from, to }`) filtered by category IDs (`categoryIds: [categoryId]`). When querying with an Expense Category ID, ExternalProvider returns all transactions where the destination category matches that ID, with `sourceId` identifying the paying account (e.g. Primary bank card, Revolut, Cash).

See `proposal.md` for motivation and `specs/budget-overview/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Provide an interactive slide-over drawer (`CategoryExpenseTraceSheet`) launched by clicking any category row or smart group in the "Expenses Breakdown" section.
- Default to showing all transactions across all accounts for the active month, clearly badging each transaction's paying account.
- Enable immediate period contrast: allow users to switch between the Active Month, the Comparison Baseline Month, or a Side-by-Side/Combined view when a comparison mode is active.
- Offer non-intrusive in-sheet Account Filter chips displaying each paying account and its subtotal spend for that category.
- Support smart category groups (e.g. "Transport & Taxi") by querying both parent and child category IDs and providing a sub-category breakdown.
- Synchronize sheet visibility with URL search params (`?traceCategory=<id>`) so links can be shared or refreshed without losing context.

**Non-Goals:**
- Modifying the underlying `/stat/ping` data pipeline or recalculating dashboard KPIs.
- Creating a full editable transaction ledger in the drawer (the sheet is read-only for auditing and tracing; edits remain in ExternalProvider or dedicated workflows).
- Replacing `/dashboard/family-budget` (Accounts & Transactions), which remains the system's all-time ledger and accounts liquidity screen.

## Decisions

### Decision 1: In-Place Slide-over Sheet (`Sheet`) over Full-Page Navigation
- **Rationale**: Full-page navigation to `/dashboard/family-budget` interrupts the analytical review session, discards dashboard scroll position and local filters, and requires browser-back navigation to inspect subsequent categories. A slide-over sheet keeps the user anchored in their budget overview, allowing frictionless back-to-back category inspection.
- **Alternatives Considered**:
  - *Full-page redirect with query parameters*: Simple to link, but jarring UX that causes dashboard context loss.
  - *Inline expandable table under the breakdown card*: Pushes all subsequent cards (YoY Trends, Budget Limits) down the page, increasing vertical bloat on an already rich dashboard.

### Decision 2: Default to "All Accounts" with Dynamic Account Filter Chips
- **Rationale**: When auditing an expense category, users want to understand total category consumption first, regardless of which card or cash pocket paid for it. The sheet defaults to "All Accounts", but dynamically tallies spending across paying accounts and renders clickable filter chips (e.g., `All (2,417 PLN)`, `Primary Bank (1,600 PLN)`, `Revolut (650 PLN)`, `Cash (167 PLN)`).
- **Alternatives Considered**:
  - *Forcing account selection first*: Adds unnecessary clicks for users who simply want to see all grocery transactions.

### Decision 3: Dual-Period Comparison Tabs within the Sheet
- **Rationale**: When the dashboard has a comparison baseline active (Previous Month, YoY, or Custom Month), the primary question is "Why did this category change?". The sheet inherits the dashboard's `activeMonthDateStr` and `baselineResolution.dateStr` and provides tabs:
  - `Active Month (e.g. Oct 2026)`
  - `Baseline Month (e.g. Sep 2026)`
  - `Combined / Side-by-Side`
- **Data Strategy**: Transactions for active and baseline months are fetched independently via `getTransactionPage`. If baseline comparison is "Off", the period selector defaults to a single active month view.

### Decision 4: Smart Group Handling (e.g. Transport & Taxi)
- **Rationale**: If the inspected slice is a smart group (`slice.isSmartGroup = true`), the query includes `[slice.id, ...(slice.children.map(c => c.id))]`. The sheet renders child category badges (e.g. `Uber`, `Fuel`, `Public Transit`) alongside account badges.

## Component Architecture

```
BudgetOverviewDashboard
├── MonthPeriodPicker (activeMonthDateStr, compareMode, baselineResolution)
├── BudgetMetricsStrip
├── ExpensePieCard
│   └── Category rows (onClick -> setSelectedTraceCategory)
└── CategoryExpenseTraceSheet (open when selectedTraceCategory !== null)
    ├── SheetHeader (Category name, total amount, delta badge)
    ├── PeriodTabs (Active Month vs Baseline Month vs Combined)
    ├── AccountFilterChips (All Accounts, Account A, Account B...)
    ├── TransactionTraceList (reverse-chronological transaction rows)
    └── SheetFooter (Deep link to full /dashboard/family-budget)
```

## Risks / Trade-offs

- **[High Transaction Count per Category]** → While rare for a single category in a single month to exceed 100 transactions, `getTransactionPage` will fetch `take: 200` to ensure complete coverage, falling back to an incremental "Load more" indicator if `hasMoreData` is true.
- **[Network latency on comparison month]** → Baseline month transactions are fetched on-demand only when the sheet is opened (or when the user switches to the baseline tab), and cached in the client cache for 5 hours.
