# Design

## Context

See `proposal.md` for motivation and `specs/budget-overview/spec.md` for behavioral requirements.

Currently:
1. `getCategories()` in `external-provider-client.ts` fetches categories via `POST /api/external-provider/Exchange/Ping` with `{ items: [{ key: 2, entityJson: null }] }`. Each `ExternalProviderCategory` includes `order?: number`, `name: string`, `amount?: number`, and `categoryType: number`.
2. `AccountsCard` filters account-type categories (`Account = 2`, `BankAccount = 7`, `DebtAccount = 5`) without sorting by `order` or handling `_`-prefixed archived accounts.
3. `BudgetSummaryCard` joins `statData` points with `categories` metadata and sorts strictly by `b.rawPercent - a.rawPercent` rather than ExternalProvider's `order`.
4. The proxy (`src/app/api/external-provider/[...path]/route.ts`) caches all `GET` and `POST` requests by `(method, pathname, search, bodyHash)` unless `Cache-Control: no-cache` is supplied.
5. `@dnd-kit/react`, `@dnd-kit/helpers`, and `@dnd-kit/abstract` (`^0.5.1`) are already installed and used in `src/app/(main)/dashboard/invoice/_components/invoice-items.tsx`.

## Goals / Non-Goals

**Goals:**
- Respect ExternalProvider's `category.order` across `AccountsCard` and `BudgetSummaryCard`, and provide smooth drag-and-drop reordering that writes updated `order` values back to ExternalProvider via `/Exchange/Ping`.
- Ensure `/Exchange/Ping` write payloads invalidate stale category cache entries in both the server proxy and client cache.
- Filter out `_`-prefixed accounts when their balance is `0` (with an on-demand toggle to show them), while keeping `_`-prefixed accounts with a non-zero balance always visible with a warning badge/tooltip explaining how to reconcile the balance to `0` in ExternalProvider.
- Filter out `_`-prefixed budget categories when inactive (with an on-demand toggle to show them).
- Resolve and display the last transaction timestamp for each account and category, with a hover/focus popover showing counterpart (source or target), amount, comment, and tags.
- Provide fast, deterministic unit tests for all pure domain functions and cache/client logic.

**Non-Goals:**
- Editing account balances, creating adjustment transactions, or deleting categories directly from our web app (reconciliation guidance directs the user to ExternalProvider for now).
- Introducing new external runtime dependencies (`@dnd-kit/*` and Radix UI `Tooltip` / `HoverCard` are already in the project).

## Decisions

### 1. Syncing Category Order Upstream via `/Exchange/Ping`
- **Choice**: Use `POST /api/external-provider/Exchange/Ping` with:
  ```json
  {
    "items": [
      {
        "key": 2,
        "entityJson": "[{...updatedCategory1}, {...updatedCategory2}]"
      }
    ]
  }
  ```
- **Rationale**: Reverse-engineering of ExternalProvider's `upstream client` (`CategoryManager.prototype.write` and `CategoryBuilder.prototype.setOrder`) and `upstream client` (`DataExchangeProvider.prototype.push`) confirmed that ExternalProvider has no separate REST endpoint for category updates; all category mutations (including `order`) are pushed as double-encoded JSON arrays under `ExchangeKey.Category` (`key: 2`) to `/Exchange/Ping`. Furthermore, `/Exchange` is already in `PATH_ALLOWLIST`.
- **Order Recalculation Strategy (`reorderCategoriesSubset`)**:
  When a user reorders a visible list of categories (e.g., visible accounts, or visible expense categories in `BudgetSummaryCard`), only a subset of all categories in `ExchangeKey.Category` may be displayed. To avoid colliding `order` values or scrambling hidden items:
  1. Determine the full sorted list of categories sharing that group (e.g. account-type categories for `AccountsCard`, or expense/goal categories for `BudgetSummaryCard`), sorted by `(a.order ?? 0) - (b.order ?? 0)` with tie-breaking by `id`.
  2. Apply the move among the visible ordered IDs, slot the reordered visible items back into the positions they occupied in the group, and assign sequential integer `order` values (`0, 1, 2, ...`) across the group.
  3. Collect only the `ExternalProviderCategory` objects whose `order` value actually changed, preserving all existing fields on each category object, and send those modified entities in `entityJson`.
- **Cache Invalidation**:
  - Client: `updateCategoriesOrder(updatedCategories)` sends `Cache-Control: no-cache` and updates/invalidates the `"categories"` entry in `clientCacheState`.
  - Server Proxy: In `src/server/external-provider/cache.ts`, add `invalidateProxyCacheByPathPrefix(pathnamePrefix: string)`. When `route.ts` handles a `POST` to `/Exchange/Ping` whose request body has any item with `entityJson !== null`, bypass caching for that write request and call `invalidateProxyCacheByPathPrefix("/Exchange/Ping")` so subsequent category reads fetch fresh state (or seed from the write response).

### 2. `_` Prefix Filtering & Non-Zero Balance Warning
- **Classification Helper (`classifyArchivedAccount` / `isArchivedCategoryName`)**:
  - A category is considered archived-by-naming when `category.name.trim().startsWith("_")`.
  - For accounts (`Account`, `BankAccount`, `DebtAccount`):
    - Active (`!isArchivedName`): always visible.
    - Archived with zero balance (`isArchivedName && Math.abs(balance) < 0.005`): hidden by default; shown when `showArchived` toggle is enabled.
    - Archived with non-zero balance (`isArchivedName && Math.abs(balance) >= 0.005`): **always visible** regardless of `showArchived` toggle, flagged with `hasUnreconciledBalance: true`.
  - Warning UI & Reconciliation Guidance:
    - Render an amber warning icon (`AlertTriangle`) next to the account name.
    - On hover/focus (`Tooltip` / `HoverCard`), explain why it is shown (`"Archived account ('_' prefix) has a non-zero balance"`) and how to reconcile it in ExternalProvider:
      1. Open ExternalProvider mobile or web app and edit the account's current balance directly to `0`, **or**
      2. Record a balancing transfer/adjustment transaction from/to an active account so the `_` account reaches `0` while keeping history intact.

### 3. Last Transaction Resolution & Hover Popover
- **Data Resolution**:
  - In `FamilyBudgetDashboard`, alongside the period-filtered transactions (`periodTransactions`), fetch a cached unfiltered recent batch (`getTransactionPage({ skip: 0, take: 300 })`, cached for 5 hours under key `tx:0:300::`) so accounts and categories that were not used in the currently selected month still resolve their most recent transaction across recent months.
  - Build a pure helper `buildLastTransactionMap(transactions: ExternalProviderTransaction[])`:
    - Iterates non-deleted transactions sorted newest-first (`dateTimestampISO` / `dateTimestamp`).
    - Records the latest transaction for both `tx.sourceId` and `tx.destinationId` if not already recorded.
    - Produces a `LastTransactionSummary` for a given `categoryId` containing:
      - `transactionId`, `dateTimestampISO`, `formattedDate`
      - `direction`: `"income" | "expense" | "transfer"`
      - `counterpartLabel`: `"From"` or `"To"`
      - `counterpartName`: the opposite side of the transaction relative to the inspected `categoryId` (if `categoryId === tx.sourceId`, counterpart is `tx.destinationName`; if `categoryId === tx.destinationId`, counterpart is `tx.sourceName`)
      - `amount` and `currency` (using the side-appropriate amount/currency for the inspected account/category)
      - `comment`: trimmed `tx.comment` or `null`
      - `tags`: `tx.tags ?? []`
- **Hover Presentation**:
  - On each account row in `AccountsCard` and category row in `BudgetSummaryCard`, show a compact last-transaction pill/Trigger (`Clock` / `Info` icon + formatted date) when a last transaction exists.
  - Hovering or focusing opens a `HoverCard` / `Tooltip` displaying the counterpart (`From: ...` or `To: ...`), signed/formatted amount, full date, comment, and tag badges.

### 4. Unit Testing Strategy
- **Choice**: Use Node 22's built-in test runner (`node --import tsx --test` or `node --experimental-strip-types --test`) with a `"test"` script in `package.json`, requiring zero new packages.
- **Rationale**: Node 22.20+ supports `--experimental-strip-types` and `node:test` + `node:assert/strict` natively out of the box, keeping `package.json` dependency-free per `AGENTS.md` ("Avoid unnecessary dependencies").

## Risks / Trade-offs

- **[Risk] Partial list reordering in `BudgetSummaryCard` when some categories have 0 spent in the active month** → **Mitigation**: `reorderCategoriesSubset` operates on the full category list in memory, swapping only the relative order slots of the visible items while keeping unrendered categories in their existing relative positions, then normalizes sequential `order` integers.
- **[Risk] Upstream `/Exchange/Ping` write fails due to expired cookie or network error** → **Mitigation**: Optimistically update UI order on drop, and if `updateCategoriesOrder` throws, revert to the previous categories state and surface an inline/toast error banner with retry capability.
