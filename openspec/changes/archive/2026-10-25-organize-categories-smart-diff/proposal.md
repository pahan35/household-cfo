# Proposal

## Why

In the "Organize Expense Categories" dialog, any reordering that displaces categories across tiers or positions shifts the dense 0-indexed positions (`order: 0, 1, 2, ...`) of all intermediate categories. When only 4 categories are out of tier or sequence, the dialog currently flags all 120 categories as moved (`hasMoved = prevOrder !== newOrder`), drowning the 4 intentional changes in 116 passive cascading shifts. Additionally, categories with 0 recent transactions show ambiguous "0 transactions, score 0.0" reasons even when moving due to currency tier realignment, and the dialog footer has cramped action buttons due to inherited negative margins colliding with `overflow-hidden`.

## What Changes

- **Active Mover Detection (LCS Algorithm)**: Classify category order changes into **Active Movers** (categories whose relative sequence changed against peers, identified via Longest Common Subsequence) and **Passive Shifts** (categories whose relative sequence is unchanged but whose index shifted due to upstream insertions/removals).
- **Default "Direct moves" Filter**: Default the dialog view to show only Active Movers (e.g. 4 categories instead of 120), with filter controls to inspect "All shifted" or "Show all".
- **Clear Reorganization Summary**: Update the summary badge from a flat "120 categories to move" to highlight active moves (e.g. "4 categories to reorganize") alongside passive ripple count.
- **Context-Aware Movement Reasons**: Detect currency tier migrations and surface explicit reasons (e.g., "Moved to Foreign tier (UAH)" or "Promoted to Primary tier (PLN)") instead of generic "0 transactions, score 0.0".
- **Dialog Footer Layout & Spacing Polish**: Neutralize negative margins (`m-0`) on the dialog footer, increase padding, and add generous horizontal spacing between action buttons (`Cancel` and `Apply Changes`).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `category-management`: Extend the Smart Order Optimization preview requirement to distinguish active movers from passive ripple shifts using sequence diffing (LCS), default the preview table to active movers, provide tier migration explanatory reasons, and ensure accessible dialog footer layout.

## Impact

- `src/app/(main)/dashboard/family-budget/_components/category-organization-dialog.tsx`: Update filtering, counters, badges, and footer styling.
- `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`: Add active mover diffing logic (LCS / LIS relative order preservation) and tier migration reason resolution.
- `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`: Add unit test coverage for active mover detection vs passive shifts and reason formatting.
- Upstream ExternalProvider API sync remains fully backward compatible: all modified entity `order` updates are still correctly persisted via `POST /api/external-provider/Exchange/Ping`.
