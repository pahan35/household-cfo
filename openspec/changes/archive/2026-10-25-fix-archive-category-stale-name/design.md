# Design: Fix Stale Category Name and Invalidation on Archive

## Context

See `proposal.md` for motivation. The Family Budget application coordinates category metadata from two main sources:
1. Canonical category entities loaded via `POST /api/external-provider/Exchange/Ping` (key 2 / Category).
2. Historical statistics points loaded via `/api/external-provider/stat/ping`, where each category entry has `{ id, title, name, amount, value, limitAmount }`.

When a category mutation (such as archiving, unarchiving, or renaming) occurs, `categories` in React state is immediately updated and pushed upstream. However:
1. `computeBudgetSummaryItems` prioritized `rawTitle` from snapshot point categories over `categoryNameMap.get(cat.id)`, causing stale names to be rendered even after optimistic local state updates.
2. `updateCategoriesOrder` only updated the `categories` cache key, leaving `stat:*` client-side caches intact with 5-hour TTLs.
3. The server proxy route (`route.ts`) only invalidated `/Exchange/Ping` on exchange writes, leaving `/stat/ping` intact in the proxy cache.

## Goals / Non-Goals

**Goals:**
- Ensure `computeBudgetSummaryItems` always reflects the most up-to-date category name from `categoryNameMap` when present, falling back to snapshot titles only for unmapped categories.
- Ensure any category write (`updateCategoriesOrder` / `Exchange/Ping`) purges cached statistics points both on the client (`clientCacheState`) and in the server proxy cache (`/stat/ping`).
- Ensure unit tests strictly guard against regressions in name priority and cache invalidation.

**Non-Goals:**
- Modifying how ExternalProvider's upstream server computes or labels `stat/ping` categories.
- Altering the archival ordering algorithm (`archiveExpenseCategory`).

## Decisions

### Decision 1: Prioritize `categoryNameMap` over `cat.title` in `computeBudgetSummaryItems`
- **Choice**: Evaluate `const mappedName = categoryNameMap.get(cat.id)?.trim()` before `rawTitle` and `rawName`.
- **Rationale**: `categoryNameMap` is derived from canonical `categories` state, which receives optimistic updates and reflects user actions like archive (`_` prefix), unarchive, or rename immediately. Snapshot `cat.title` is merely a fallback for orphaned or unmapped category IDs.
- **Alternative considered**: Mutating `statData` in place on category actions. Rejected because `statData` is an immutable snapshot of historical points, whereas `categoryNameMap` cleanly injects current metadata across all rendered points.

### Decision 2: Invalidate `stat:*` client cache in `updateCategoriesOrder`
- **Choice**: Iterate over `clientCacheState.entries.keys()` and delete keys starting with `stat:`, matching the eviction pattern in `createTransaction` and `updateTransaction`.
- **Rationale**: Ensures subsequent re-fetches or page navigations retrieve fresh statistics with updated upstream category metadata.

### Decision 3: Invalidate `/stat/ping` in server proxy route on `isExchangeWritePayload`
- **Choice**: Call `invalidateProxyCacheByPathPrefix("/stat/ping")` whenever an exchange write payload is processed.
- **Rationale**: Prevents server-side proxy cache from serving stale 5-hour `/stat/ping` responses when categories are modified.

## Risks / Trade-offs

- **[Risk]**: Invalidating `/stat/ping` cache causes an extra upstream fetch on the next period view.
  - **Mitigation**: Category writes (reorder, archive, rename) are deliberate, low-frequency user actions. Clearing the 5-hour statistics cache on explicit mutations is correct and expected behavior.
- **[Risk]**: A category exists in `statData` but not in `categoryNameMap` (e.g., deleted or orphaned category).
  - **Mitigation**: The fallback chain preserves `rawTitle || rawName || "Category"`, guaranteeing orphaned categories still render their snapshot title.
