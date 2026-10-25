# Proposal: Fix Stale Category Name and Invalidation on Archive

## Why

When an active expense category is archived from the Budget Overview screen, the category is renamed with an underscore (`_`) prefix and moved to the end of the order sequence. While the new sequential order (`#114`) and bottom position were immediately rendered, the category name itself remained stale without the `_` prefix and lacked the `Archived` badge.

This occurred because `computeBudgetSummaryItems` favored snapshot `cat.title` fields from `statData` over the canonical `categoryNameMap`. Furthermore, category exchange writes (`POST /Exchange/Ping`) failed to invalidate client-side `stat:` cache entries and proxy-level `/stat/ping` cache, preserving stale titles across reloads.

## What Changes

- **Authoritative Category Name Priority**: Update `computeBudgetSummaryItems` in `budget-summary-card.tsx` to prioritize the category name in `categoryNameMap` over snapshot `cat.title` and `cat.name` fields from `/stat/ping`.
- **Client Statistics Cache Invalidation**: Update `updateCategoriesOrder` in `external-provider-client.ts` to invalidate `stat:*` cache entries in `clientCacheState` whenever category order or renames are pushed upstream.
- **Proxy Route Statistics Invalidation**: Update proxy route `src/app/api/external-provider/[...path]/route.ts` so that `isExchangeWritePayload` invalidates cached `/stat/ping` proxy entries in addition to `/Exchange/Ping`.
- **Unit Test Coverage**: Add unit tests verifying `computeBudgetSummaryItems` name resolution priority, client-side cache invalidation on category updates, and proxy cache invalidation for `/stat/ping`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Update requirements for category reorder and archive write cache invalidation to include `/stat/ping` and client-side statistics caches, and specify that category display names in budget summaries prioritize canonical category metadata over snapshot statistics titles.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`: `computeBudgetSummaryItems` name resolution.
- `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`: `updateCategoriesOrder` cache eviction.
- `src/app/api/external-provider/[...path]/route.ts`: Exchange write cache invalidation.
- `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts`: Added unit tests.
- `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-client.test.ts`: Added unit tests.
