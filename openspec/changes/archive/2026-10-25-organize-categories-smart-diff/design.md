# Design

## Context

See `proposal.md` for background and motivation.

In `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`, categories in the active expense group are sorted into sequential contiguous integer orders (`0, 1, 2, ... N-1`). When categories are realigned across architectural tiers (e.g. Foreign categories moved down or Default-currency categories promoted up), intermediate categories keep their relative sequence to each other, but their absolute `order` property changes by $\pm 1$ or $\pm 2$.

Currently, `buildCategoryOrderDiffItems` computes `hasMoved = prevOrder !== currentOrder`. Because `order` changes for almost all items, all 120 items are marked as moved, and the dialog renders 120 items with uniform styling and noisy `+2` / `-2` deltas.

## Goals / Non-Goals

**Goals:**
- Formulate an algorithmic distinction between **Active Movers** (categories whose relative sequence changed against peers) and **Passive Shifts** (categories whose relative sequence is intact, but whose index shifted due to insertions/removals).
- Provide a default dialog view showing only Active Movers, with clear filter controls to view all shifted items or all categories.
- Detect tier realignments and generate clear explanatory reasons (e.g. "Moved to Foreign tier (UAH)" or "Promoted to Primary tier (PLN)") instead of generic "0 transactions, score 0.0".
- Correct DialogFooter CSS styling to eliminate negative-margin clipping and provide comfortable breathing room between action buttons.

**Non-Goals:**
- Changing ExternalProvider's upstream data schema or attempting sparse/fractional floating-point orders: ExternalProvider requires contiguous integer ordering, so the underlying sync payload will continue to submit all modified categories to maintain sequence integrity.
- Altering the time-decay scoring formulas or currency tier definitions.

## Decisions

### 1. Active Mover Classification via Longest Increasing Subsequence (LIS)

To determine which categories actively changed relative order:
1. Let the original list of categories in the group be $A = [c_1, c_2, \dots, c_n]$.
2. In the reordered list $B = [c'_1, c'_2, \dots, c'_n]$, map each category to its original index in $A$: `originalIndices = B.map(c => originalIndexMap.get(c.id))`.
3. Compute the **Longest Increasing Subsequence (LIS)** of `originalIndices`.
   - Categories that belong to the LIS have preserved their relative order (`c_i` is still before `c_j` for all pairs in the LIS). Their rank changes are purely **passive ripple shifts** caused by items inserted or removed around them.
   - Categories **not in the LIS** are the **Active Movers**: the minimal set of elements whose displacement created the reordering.
4. For tie-breaking or multiple candidate LIS paths, prioritize retaining categories with higher activity scores or categories whose positions stayed identical.
5. In `CategoryOrderDiffItem`, add `isActiveMove: boolean`.

*Alternatives Considered:*
- *Thresholding rank delta ($|\text{delta}| > 2$)*: Fails when an active move is small (e.g. moving 1 position) or when a ripple shift is large (e.g. 5 items inserted upstream causes a ripple delta of 5).
- *Tier-only check*: Fails when reordering by activity score within the same tier (e.g., high-frequency grocery category jumping past low-frequency entertainment). LIS handles both intra-tier activity ranking and inter-tier realignment uniformly.

### 2. Tier Migration Reason Detection

In `buildCategoryOrderDiffItems`:
- Determine the original tier boundary range in the original group (e.g., indices occupied by primary categories).
- Compare the category's detected currency tier against its previous placement:
  - If a category is `foreign` or `archived` but was positioned within the primary/default range, and is now placed in its proper tier: reason is `"Moved to Foreign tier (${currency})"` or `"Moved to Archived tier"`.
  - If a category is `primary` but was positioned below foreign categories, and is now placed in the primary tier: reason is `"Promoted to Primary tier (${defaultCurrency})"`.
- When not a tier migration, retain the activity decay score reason: `"${count} transactions, score ${score.toFixed(1)}"`.

### 3. Dialog Filter & Counter Experience

In `category-organization-dialog.tsx`:
- Introduce a 3-way view filter:
  - `"direct"` (Default): Shows only `isActiveMove === true` (e.g. 4 categories).
  - `"shifted"`: Shows all `hasMoved === true` (e.g. 120 categories).
  - `"all"`: Shows all categories including stationary ones.
- Summary bar:
  - Primary badge: `"{activeCount} categories to reorganize"`.
  - Secondary text / pill: `"+{passiveCount} ripple shifts"` (when passive shifts exist).
- Dialog action button:
  - Button text: `"Apply Reorganization ({activeCount})"` (with loader when submitting).

### 4. Dialog Footer Spacing

- In `category-organization-dialog.tsx`:
  - `DialogContent` has `p-0 overflow-hidden`.
  - `DialogFooter` has default `-mx-4 -mb-4` in `dialog.tsx`.
  - Override with:
    ```tsx
    <DialogFooter className="m-0 border-t border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-end gap-3">
    ```
  - This neutralizes negative margins, restores full 16px bottom padding, and ensures distinct 12px horizontal separation between "Cancel" and "Apply Reorganization".

## Risks / Trade-offs

- **[Risk] LIS ambiguity**: In rare cases with multiple identical LIS lengths, choosing an arbitrary LIS might mark one category as active mover instead of another.
  → *Mitigation*: Anchor stationary elements (`origIndex === newIndex`) in the subsequence first, maximizing the count of stationary elements.
- **[Risk] Performance**: Calculating LIS on 120–200 elements.
  → *Mitigation*: Standard $O(N \log N)$ patience sorting algorithm executes in $< 1\text{ms}$ on 120 elements, running smoothly inside `useMemo`.
