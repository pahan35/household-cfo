# Proposal

## Why

When active categories are positioned below archived categories in `BudgetSummaryCard`, the UI currently triggers a rigid batch banner claiming that all active categories (e.g., 91 categories) are misplaced below archived categories (e.g., 4 categories) and renumbers every category from 0, generating massive 95-entity write payloads to `/Exchange/Ping`. Furthermore, toggling "Show archived" currently passes `includeAll: true` to `computeBudgetSummaryItems`, leaking inactive and soft-deleted (`deleted: true`) categories into the active budget view where they collide on `#order` numbers and interleave with active items. Finally, categories not used within the recent 300 transactions lack last-transaction date indicators on the dashboard overview.

## What Changes

1. **Adaptive Anomaly Detection & Reordering**:
   - Compare the count of active categories below archived ($N_{\text{activeBelow}}$) against archived categories positioned above active ($N_{\text{archivedAbove}}$).
   - When $N_{\text{archivedAbove}} < N_{\text{activeBelow}}$ (e.g. 4 archived above 91 active), adapt the banner to: `"4 archived expense categories are positioned above active categories"` with action `[Move archived to bottom]`.
   - When $N_{\text{activeBelow}} \le N_{\text{archivedAbove}}$, preserve the banner: `"${N} active expense categories are positioned below archived categories"` with action `[Move above archived]`.
   - Optimize the reordering algorithm so that moving archived categories to the bottom preserves existing active category `order` integers and updates only the archived categories with sequential orders starting after the maximum active order, shrinking network mutations from 95 items to only 4.

2. **Clean Separation of "Show archived" and "Show removed"**:
   - Disentangle "Show archived" from `includeAll: true`. "Show archived" strictly toggles categories whose name starts with `_`.
   - Exclude soft-deleted (`deleted: true`) categories from default `Active in Month` and `All Categories` listings.
   - Add a dedicated `"Show removed (N)"` toggle in `BudgetSummaryCard` to reveal soft-deleted categories on demand.
   - Distinctly style removed categories with a muted visual treatment and a `Removed` badge, enabling row actions (Inspect Transactions, Rename/Edit, Move to bottom).
   - Enforce a strict three-tier order hierarchy across reordering and currency-tier organization:
     $$\text{Active Categories} \longrightarrow \text{Archived Categories (\_)} \longrightarrow \text{Removed Categories (\texttt{deleted})}$$

3. **Targeted Last-Transaction Date Resolution**:
   - Resolve last transaction timestamps for visible categories missing from the initial 300-transaction window via on-demand / batched queries to `POST /api/external-provider/api/transaction/get` filtered by `categoryIds`.

## Capabilities

### Modified Capabilities
- `budget-overview`: Update budget spent-vs-limit requirements to support adaptive archived/active banner actions and minimal-mutation reordering, separate "Show archived" from "Show removed" toggles, enforce the three-tier order hierarchy (Active -> Archived -> Removed), and support targeted transaction date resolution for categories outside the initial transaction window.
- `category-management`: Update category normalization and audit requirements to allow viewing and editing soft-deleted categories under an explicit "Show removed" toggle.

## Impact

- Affected files:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts`
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/category-renaming-dialog.tsx`
  - Unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/`
- No new external runtime dependencies.
