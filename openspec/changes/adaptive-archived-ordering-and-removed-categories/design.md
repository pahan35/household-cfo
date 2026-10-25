# Design

## Context

See `proposal.md` for motivation and `specs/budget-overview/spec.md` and `specs/category-management/spec.md` for behavioral requirements.

Currently:
1. `findExpenseCategoriesBelowArchived(allCategories)` locates the first `_`-prefixed category and flags all subsequent active categories as "below archived", even if 4 archived categories sit at order `0..3` and 91 active categories sit at `4..94`.
2. `applyCategoryGroupUpdates` renumbers indices from `0` to `N-1`. Moving 91 active categories above 4 archived categories shifts every index from `0` to `94`, forcing a 95-entity mutation upstream to `/Exchange/Ping`.
3. In `budget-summary-card.tsx`, `computeBudgetSummaryItems` receives `{ includeAll: showArchived }`. When `showArchived` is toggled on, it extracts all categories from `statData` regardless of spend, including unarchived inactive and soft-deleted (`deleted: true`) categories. These categories collide on `#order` with active categories and interleave in the view.
4. `buildLastTransactionMap` only indexes the initial 300 recent transactions fetched on page load. Inactive, older, or foreign categories with no activity in that 300-transaction window show no date pill.

## Goals / Non-Goals

**Goals:**
- Provide an adaptive banner and action that compares $N_{\text{archivedAbove}}$ against $N_{\text{activeBelow}}$, switching to "Move archived to bottom" when archived categories are at the top.
- Optimize the reordering algorithm to mutate only the moving subset (e.g. updating 4 archived categories to order $M + 1..M + 4$ where $M$ is $\max(\text{active.order})$) rather than rewriting the entire list.
- Strictly isolate "Show archived" to `_`-prefixed categories, keeping unarchived zero-spend categories and soft-deleted categories out of the active list.
- Introduce a dedicated "Show removed" toggle in `BudgetSummaryCard` and `CategoryRenamingDialog` with clear removed styling and bottom-tier ordering.
- Establish a strict 3-tier hierarchy: Active $\rightarrow$ Archived (`_`) $\rightarrow$ Removed (`deleted`).
- Provide on-demand / batched targeted transaction date resolution for categories lacking a date in the initial window.

**Non-Goals:**
- Permanently deleting categories from ExternalProvider (ExternalProvider requires soft deletion to preserve transaction relationships).
- Changing account-type reordering or income source reordering where active/archived counts are small and already segregated.

## Decisions

### 1. Adaptive Banner and Minimal-Mutation Reordering
- **Detection**:
  ```ts
  export interface ExpenseArchivedDisplacement {
    direction: "move-archived-to-bottom" | "move-active-above-archived" | "none";
    archivedAbove: ExternalProviderCategory[];
    activeBelow: ExternalProviderCategory[];
  }
  ```
  - `activeBelow`: Active expense categories with index > index of first archived category.
  - `archivedAbove`: Archived expense categories with index < index of last active category.
  - If `archivedAbove.length === 0 || activeBelow.length === 0`: `direction = "none"`.
  - If `archivedAbove.length < activeBelow.length`: `direction = "move-archived-to-bottom"`.
  - Otherwise: `direction = "move-active-above-archived"`.

- **Banner Presentation**:
  - `move-archived-to-bottom`:
    - Banner: `"${archivedAbove.length} archived expense categories are positioned above active categories"`
    - Button: `[Move archived to bottom]`
  - `move-active-above-archived`:
    - Banner: `"${activeBelow.length} active expense categories are positioned below archived categories"`
    - Button: `[Move above archived]`

- **Minimal-Mutation Order Calculation (`moveExpenseCategoriesToBottom`)**:
  - Moves `archivedAbove` to the end of the active categories.
  - Retains the exact existing `order` integers of all active categories.
  - Assigns sequential orders to the moved archived categories starting at `max(active.order) + 1`.
  - Returns `modifiedCategories` containing **only the moved archived categories**.

### 2. Strict Filter Isolation: Active vs Archived vs Removed
- In `computeBudgetSummaryItems`:
  - Remove `{ includeAll: showArchived }`.
  - Keep `computeBudgetSummaryItems` focused strictly on categories active in that period `(limit > 0 || current > 0)` or all categories when `includeAll: true` is explicitly requested in directory mode.
  - Filter out `deleted: true` categories from `computeBudgetSummaryItems` by default.
- In `budget-summary-card.tsx`:
  - `showArchived` strictly toggles inactive categories matching `isArchivedCategoryName(name)`.
  - Add state `const [showRemoved, setShowRemoved] = useState(false)`.
  - When `showRemoved` is false, `categories.filter((c) => !c.deleted)`.
  - When `showRemoved` is true, append removed categories at the bottom of the list with a distinct `Removed` badge and muted styling.

### 3. Three-Tier Category Ordering Structure
- In `organizeExpenseCategoriesByCurrencyTier` and sorting routines:
  ```ts
  // Tier 1: Active default currency
  // Tier 2: Active foreign currency
  // Tier 3: Archived ("_" prefix, not deleted)
  // Tier 4: Removed (deleted === true)
  ```
- Removed categories are always sorted to the very bottom, ensuring they never interleave with active or archived categories in ExternalProvider Web or Mobile.

### 4. Targeted Resolution for Missing Last-Transaction Dates
- In `budget-overview-dashboard.tsx`:
  - Detect visible categories that lack an entry in `lastTransactionByCategoryId`.
  - Fetch targeted transactions via `getTransactionPage({ categoryIds: missingIds, take: missingIds.length * 2 })` or on-demand in batches.
  - Merge resolved transactions into `lastTransactionByCategoryId` cache.

### 5. Exposing Removed Categories in Normalization Dialog
- Add a `"Show removed"` checkbox/toggle to `CategoryRenamingDialog`.
- When checked, `isInNormalizationScope` permits `c.deleted === true` categories, enabling auditing, cleaning names, and renaming them before saving to ExternalProvider.

## Risks / Trade-offs

- **[Risk] Existing non-sequential orders in ExternalProvider**: If active categories have non-contiguous order gaps, assigning `max(active.order) + 1` to archived categories leaves those gaps intact.
  - $\rightarrow$ *Mitigation*: This is desirable. ExternalProvider's client sorts strictly with `a.order - b.order` and does not require contiguous `0..N` values. Preserving gaps prevents unnecessary mutations of unrelated categories.
- **[Risk] High count of removed categories slowing down transaction lookups**: If there are many removed categories with no transactions, searching for their last transaction could make unnecessary network requests.
  - $\rightarrow$ *Mitigation*: Only resolve last transactions for active and archived categories by default, or limit missing-date lookups to categories rendered on screen.
