# Design: Mortgage & Home Goal Simulator

## Context

The Family Budget section currently contains live tracking screens (`Accounts & Transactions`, `Budget Overview`, `Income & Taxes`) and analytical simulators (`Runway Simulator`, `Offer Comparator`). These existing screens establish patterns for:
1. Loading live categories, currencies, and multi-year `/stat/ping` aggregates through `external-provider-client.ts`.
2. Modeling financial projections using pure TypeScript calculation engines covered by unit tests (e.g. `runway-engine.ts`, `polish-tax-engine.ts`).
3. Persisting complex scenario parameters, custom weights, and account selections to browser `localStorage` with versioned repository patterns (`runway-repository.ts`, `offer-repository.ts`).
4. Writing category entity mutations (e.g. Goal limits or account properties) upstream via `/api/external-provider/Exchange/Ping`.

See `proposal.md` for overall user motivation.

## Goals / Non-Goals

**Goals:**
- Provide a clean, modular route at `/dashboard/family-budget/mortgage` adhering to shadcn UI, Tailwind v4, and existing dashboard styling.
- Implement an exact financial calculation engine for Polish primary market property acquisitions, notary/court costs, Polish mortgage mechanics (Equal/Decreasing installments, WIBOR + margin, grace period tranche interest), and construction/renovation overlap.
- Connect seamlessly to ExternalProvider Goal categories (`CategoryType.Goal` / `CategoryType.ClassicGoal`), tracking Day-1 cash accumulation and allowing upstream synchronization of goal target limits.
- Benchmark required monthly savings against real historical net cashflow margins from `/stat/ping`.
- Deliver responsive, accessible cards with full unit test coverage for calculation engines.

**Non-Goals:**
- Full bank credit scoring (BIK history analysis, complex multi-bank algorithmic underwriting).
- Live bank rate scraping (interest rates and bank margins will be user-configurable with sensible Polish market defaults).
- Modifying shared components in `src/components/ui/` or `src/components/calendar/`.

## Decisions

### 1. Route Co-location and Component Breakdown

Follow repository convention by co-locating all feature code under `src/app/(main)/dashboard/family-budget/mortgage/`:
- `page.tsx`: Server component mounting `MortgageDashboard`.
- `_components/mortgage-dashboard.tsx`: Top-level client component managing ExternalProvider data loading and scenario state.
- `_components/property-acquisition-card.tsx`: Apartment parameters (area, price/m²), parking/storage, closing fees (0% PCC), and renovation budget.
- `_components/mortgage-financing-card.tsx`: Down payment selector (10%, 15%, 20%), renovation mode toggle (Cash vs. Bundled), interest rate (reference + margin), term in years, and installment schedule (Equal vs. Decreasing).
- `_components/home-goal-tracker-card.tsx`: Linked ExternalProvider Goal selector, two-milestone progress meters (Signing vs Handover), savings pace audit vs `/stat/ping` net cashflow, and upstream "Sync Target" action.
- `_components/overlap-cashflow-card.tsx`: Interactive multi-phase timeline showing the construction wait (grace period interest + rent), finishing window (peak overlap), and steady state.
- `_components/budget-impact-card.tsx`: Post-move-in monthly cashflow comparison (rent replaced by mortgage + admin fee), DTI gauge, and interest rate stress slider.
- `_components/mortgage-engine.ts`: Pure TS calculations for amortization, fees, savings pace, overlap, and budget impact.
- `_components/mortgage-types.ts` & `mortgage-repository.ts`: Typed scenario interfaces and versioned `localStorage` persistence.

*Alternative considered:* Embedding this inside `budget-overview` or `offer-comparator`.
*Rationale:* Home purchase planning is a distinct long-term milestone with deep domain complexity; giving it its own route matches `runway` and prevents cluttering operational budget views.

### 2. Pure Calculation Engine Separation (`mortgage-engine.ts`)

Extract all mathematical models into `mortgage-engine.ts` with zero UI or framework dependencies:
- `calculatePropertyAcquisition`: Computes total purchase price, parking/storage totals, 0% PCC for primary market, notary/court statutory brackets, and total required cash.
- `calculateAmortization`: Implements standard French amortization formula for equal payments ($M = P \frac{r(1+r)^n}{(1+r)^n - 1}$) and linear principal decay for decreasing payments, calculating first-month installment, total interest paid, and full schedule.
- `calculateOverlapTimeline`: Generates month-by-month cashflow arrays across Saving, Construction Wait (interest-only grace period on disbursed developer tranches), Finishing Overlap, and Steady State.
- `auditSavingsPace`: Calculates required monthly savings to meet target dates for Milestone 1 and Milestone 2, comparing against `/stat/ping` average net cashflow margin across 3m, 6m, and 12m lookback windows.

*Alternative considered:* Calculating inline inside React component hooks.
*Rationale:* Engine separation ensures high reliability, instant Jest/Biome testing without DOM overhead, and easy reuse across preview cards.

### 3. ExternalProvider Goal Integration & Upstream Sync

- Use `categories.filter(c => !c.deleted && (c.categoryType === CategoryType.Goal || c.categoryType === CategoryType.ClassicGoal))` to populate the linked goal picker.
- Convert multi-currency goal amounts (e.g. if savings are in USD/EUR) to PLN using `convertCurrencyAmount` and live exchange rates from `currencies`.
- For syncing targets back to ExternalProvider: construct an updated `ExternalProviderCategory` with `limitAmount = milestone1CashTarget` (or combined target) and `periodizedLimitAmount = requiredMonthlySavings`, calling `updateCategoriesOrder([updatedCategory])` via `POST /api/external-provider/Exchange/Ping`.

*Alternative considered:* Only calculating numbers locally without upstream Goal sync.
*Rationale:* Syncing empowers users to see their home savings target reflected across official ExternalProvider mobile and web apps.

## Risks / Trade-offs

- [Risk] Construction tranche disbursement schedules vary by developer agreement.
  → Mitigation: Provide a configurable average disbursement draw model (defaulting to linear ramp-up or 50% average drawn principal during construction) with an intuitive slider.
- [Risk] Historical `/stat/ping` data might be sparse if user recently onboarded.
  → Mitigation: Gracefully fall back to user's configurable default monthly savings estimate or fallback net income if historical statistics are unavailable.
- [Risk] Developer finishing costs often experience scope creep / cost overruns.
  → Mitigation: Include a dedicated finishing contingency buffer percentage slider (+5% to +20%) in the renovation section.
