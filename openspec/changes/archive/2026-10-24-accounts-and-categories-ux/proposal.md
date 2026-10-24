# Proposal

## Why

In ExternalProvider's mobile app, users can organize accounts and expense categories into a custom order (`category.order`), and while ExternalProvider's web app respects that order, neither ExternalProvider web nor our Family Budget dashboard currently allows reordering from the browser or respects `category.order` when rendering accounts and budget items. Additionally, accounts and categories prefixed with `_` (used as a soft-archive convention to preserve historical transactions) clutter the active views without a way to hide or inspect them on demand, and users lack immediate visibility into when and where the last transaction occurred on each account or category.

## What Changes

- **Respect & Persist Category Order (Accounts & Budget Categories)**:
  - Sort accounts in `AccountsCard` and budget categories in `BudgetSummaryCard` by ExternalProvider's `category.order` ascending by default (with a sort mode toggle in `BudgetSummaryCard` to switch between custom ExternalProvider order and `% Spent`).
  - Add drag-and-drop reordering (`@dnd-kit/react`) on both `AccountsCard` and `BudgetSummaryCard`.
  - Persist reordered categories upstream to ExternalProvider via `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2` with double-encoded `entityJson`), invalidating both server proxy and client category caches so changes sync across ExternalProvider mobile and web.
- **Archived (`_` Prefixed) Accounts & Categories Filtering + Reconciliation Warning**:
  - Hide `_`-prefixed accounts with a zero balance (`balance === 0`) and `_`-prefixed categories by default, providing an on-demand toggle ("Show archived") to reveal them.
  - Never hide `_`-prefixed accounts that have a non-zero balance (`balance !== 0`); always keep them visible with a warning indicator and actionable guidance explaining how to reconcile their balance to `0` in the ExternalProvider app.
- **Last Transaction Timestamp & Rich Hover Details**:
  - Display the latest transaction timestamp alongside an info trigger icon on each account and category row.
  - On hover/focus, render a popover/tooltip showing the last transaction's direction-aware counterpart (source or target), formatted amount and currency, date/time, comment, and tags.
  - Ensure last-transaction lookup resolves across recent history (not solely the active month slice) so infrequently used accounts and categories still surface their latest activity.
- **Unit Test Suite**:
  - Add automated unit tests covering category/account ordering, reorder payload calculation, `_`-prefix filtering and non-zero balance warning detection, last-transaction indexing, and cache invalidation.

## Capabilities

### New Capabilities

### Modified Capabilities
- `budget-overview`: Update `Accounts and cards snapshot`, `Budget spent-versus-limit summary`, and `Request deduplication, caching, and on-demand refresh` requirements to support ExternalProvider `order` sorting, bidirectional drag-and-drop reordering via `/Exchange/Ping`, `_`-prefixed archive filtering with non-zero balance warnings, and last-transaction hover inspection.

## Impact

- **UI Components**:
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx`
- **Data & Client Layer**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` (sorting, reorder calculation, `_`-prefix classification, and last-transaction indexing helpers)
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` (`updateCategoriesOrder` / `/Exchange/Ping` write client + cache invalidation)
- **Server Proxy & Cache**:
  - `src/app/api/external-provider/[...path]/route.ts` and `src/server/external-provider/cache.ts` (bypass and invalidate cached `/Exchange/Ping` category reads when a category write payload is sent)
- **Testing**:
  - Unit tests covering pure domain logic and client/cache helpers via Node's built-in test runner (`node --test`).
