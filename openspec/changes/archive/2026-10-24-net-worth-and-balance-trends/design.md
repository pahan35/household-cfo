# Design

## Context

The Budget Overview screen (`/dashboard/family-budget/budget-overview`) currently renders `YoYTrendsCard`, which groups 40 months of `/stat/ping` points by calendar month (`Jan`–`Dec`) and plots a single selected metric (`controllable`, `margin`, or `netIncome`) per year. ExternalProvider Web's chart window (see `proposal.md`) provides a continuous chronological timeline (`APR'26`–`OCT'26`) with a mode selector (`EXPENSES AND INCOME`, `EXPENSES`, `INCOME`, `BALANCE`, `NET WORTH`), range zoom (`+` / `-`), and period range controls.

## Goals / Non-Goals

**Goals:**
- Support all five ExternalProvider Web macro chart modes (`expenses_income`, `controllable`, `netIncome`, `balance`, `netWorth`) plus `margin` inside the Budget Overview trends card without adding a redundant screen.
- Allow toggling between **Continuous Timeline** (chronological `MMM'YY` x-axis) and **Year-over-Year Alignment** (`Jan`–`Dec` grouped by year).
- Provide `+` / `-` zoom steps (`6M`, `12M`, `24M`, `40M`) and period window filtering on the continuous timeline.

**Non-Goals:**
- Category-to-tag drill-down or per-tag timeline filtering (covered by `lifestyle-tag-analytics`).
- Modifying upstream proxy endpoints or adding new external chart libraries (continue using Recharts via `src/components/ui/chart.tsx`).

## Decisions

1. **Extend `YoYTrendsCard` and `yoy-transforms.ts` rather than creating a second competing macro chart card on Budget Overview**:
   - *Rationale*: `YoYTrendsCard` already receives `statPoints`, `categories`, `defaultCurrency`, and `activePreset` on `/dashboard/family-budget/budget-overview`. Adding a Timeline vs. YoY view toggle and expanding the metric selector keeps the Budget Overview layout compact and avoids duplicating 40-month data transforms.
   - *Alternatives considered*: Adding a separate card below `YoYTrendsCard`—rejected because it would duplicate the same historical dataset and clutter the overview page.

2. **Reconstruct historical `Balance` and `Net Worth` anchored on current live account balances (`ExchangeKey.Category` + `ExchangeKey.Currency`) and monthly net cash flows**:
   - *Rationale*: ExternalProvider's `ExchangeKey.Category` provides exact current account balances and `exceptFromBalance` flags, while `/stat/ping` provides 40 months of monthly income and expense totals. Walking backward from current converted liquid balance (`Balance`) and total balance (`Net Worth`) by subtracting each month's net cash flow (or reading `/stat/ping` balance points when present) produces a fast, deterministic trajectory with zero extra network requests.
   - *Alternatives considered*: Fetching all-time raw transactions across all accounts on Budget Overview load—rejected because paging thousands of transactions would slow down initial load and duplicate `/stat/ping` aggregates.

## Risks / Trade-offs

- **[Risk] Historical FX fluctuations vs. current `ExchangeKey.Currency` rates when reconstructing multi-currency Net Worth** -> **Mitigation**: Clearly note in the `Balance` / `Net Worth` tooltip that historical points are normalized using current default-currency exchange rates and monthly net flows (detailed historical FX sensitivity remains on `/dashboard/family-budget/fx-inflation`).
- **[Risk] Dual-line `Expenses & Income` mode doesn't map cleanly to multi-year YoY bar grouping (which would require 2x bars per year per month)** -> **Mitigation**: When `Expenses & Income` is selected, automatically default the chart layout to the Continuous Timeline view (smooth dual lines for Income in emerald and Expenses in rose/amber) while still allowing switching back to single-metric YoY comparison.
