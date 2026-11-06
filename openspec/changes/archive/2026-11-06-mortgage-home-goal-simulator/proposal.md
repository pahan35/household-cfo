# Proposal: Mortgage & Home Goal Simulator

## Why

Buying a primary-market (*rynek pierwotny*) apartment requires orchestrating substantial upfront capital (down payment, notary/court fees, finishings/renovation), pacing monthly savings towards that target, and navigating a high-friction overlap period where current rent, developer tranche interest, and eventual mortgage payments coexist. Currently, the family budget application lacks a dedicated calculator to model primary market purchase cashflows, track progress against ExternalProvider savings goals, and simulate post-purchase budget impact with rent-to-mortgage substitution.

## What Changes

- Add a new dashboard route `/dashboard/family-budget/mortgage` accessible via the sidebar navigation under the "Family Budget" group.
- Implement a **Primary Market Cashflow & Upfront Target Calculator** covering apartment price (m² or lump sum), appurtenances (parking, storage), closing fees (notary, court, 0% PCC for primary market), and renovation/turnkey budget (cash-funded vs. mortgage-bundled).
- Implement a **Two-Milestone Home Goal Tracker** linked to ExternalProvider `Goal` (`CategoryType.Goal` / `ClassicGoal`) categories: Milestone 1 (Down Payment + Closing at developer contract signing) and Milestone 2 (Renovation/Finishing cash needs at key handover), featuring live savings pace auditing against historical net cashflow margins.
- Implement a **Rent Overlap & Budget Impact Simulator** modeling the construction wait (grace period interest on drawn developer tranches alongside existing rent), key handover overlap, steady-state post-move-in budget with rent replaced by mortgage + admin fee (*czynsz administracyjny*), and WIBOR/rate sensitivity stress testing.
- Enable direct synchronization of calculated savings milestones back to ExternalProvider Goal limits (`limitAmount` and `periodizedLimitAmount`) via `/api/external-provider/Exchange/Ping`.
- Persist simulator scenario configuration, selected goal IDs, and property parameters in browser `localStorage`.

## Capabilities

### New Capabilities
- `mortgage-home-goal-simulator`: Interactive mortgage and primary market home purchase planning, two-milestone ExternalProvider Goal tracking, overlap cashflow simulation, and post-purchase household budget impact analysis.

### Modified Capabilities
<!-- No existing capabilities requirements are modified. -->

## Impact

- **UI / Routes**: Adds `src/app/(main)/dashboard/family-budget/mortgage/page.tsx` and accompanying client components in `src/app/(main)/dashboard/family-budget/mortgage/_components/`.
- **Navigation**: Updates `src/navigation/sidebar/sidebar-items.ts` to include the "Mortgage & Home Goal" item in the Family Budget group.
- **ExternalProvider Integration**: Reuses client endpoints (`getCategories`, `getCurrencies`, `getSettings`, `getBudgetSelection`, `updateCategoriesOrder`) and reads category goal amounts and `/stat/ping` historical net cashflow trends.
- **Persistence**: Uses typed `localStorage` schema with versioning, matching the existing `runway-repository.ts` pattern.
