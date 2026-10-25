# Proposal

## Why

The Budget Overview dashboard (`/dashboard/family-budget/budget-overview`) currently suffers from three key usability and data integrity issues:
1. **Incomplete Zero-Spend Visibility**: The "Zero Spend" filter only checks whether spending is 0 in the currently selected month, obscuring dormant categories that have had zero spend over the whole historical period or lifetime, which are critical for budgeting audits and category restructuring.
2. **Misleading Budget Progress & Currency Mismatch**: Foreign currency category rows calculate progress percentages by comparing reporting-currency spend (e.g. PLN from `/stat/ping`) directly against native limits (e.g. USD/EUR), triggering false overrun warnings, 400%+ progress lines, and double conversions.
3. **Cluttered & Opaque Reordering Actions**: The "Smart Order" and "Foreign currency above archived" buttons crowd the header, and reorder actions trigger immediate upstream mutations without displaying how many categories will move or what the new rank order looks like.

## What Changes

- **Zero-Spend Period & Lifetime Auditing**:
  - Extend the "Zero Spend" category view with a scope selector: `Current Month`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, and `All-Time / Lifetime`.
  - Render an interactive "Last active:" indicator on every category row in the Budget Spent vs Limit summary card, showing the exact date/relative time of the most recent transaction.
  - Provide quick insights/actions for truly dormant categories (0 spend across the selected historical period).
- **Correct Category Currency Budget Progress Calculation**:
  - For individual categories, evaluate spend and limit in the category's native currency (or normalize both consistently into the category currency before computing ratio).
  - For Smart Groups, normalize member categories and limits into the user's default reporting currency (e.g. PLN).
  - Correct the progress line width and overrun indicators to reflect true spend-to-limit percentage without cross-currency skew or double exchange conversions.
- **Unified Category Organization & Reorder Modal**:
  - Replace the cluttered header action buttons (`Smart Order`, `Foreign currency above archived`, and scattered displacement warnings) with a clean, unified `Organize Categories...` action.
  - Introduce an interactive modal featuring:
    - **Smart Activity Order** (time-decayed activity scores over 90d, 180d, or all-time).
    - **Currency & Lifecycle Tier Cleanup** (Primary PLN -> Foreign -> Archived -> Removed).
    - **Interactive Before/After Diff Table**: Explicitly displays how many categories will move, their current rank vs. projected rank, rank delta (+/-), and explanation.
    - Explicit confirmation before persisting sequential orders to `/Exchange/Ping`.

## Capabilities

### New Capabilities
<!-- None: This enhances existing budget-overview functionality -->

### Modified Capabilities
- `budget-overview`: Enhance the budget spent-versus-limit summary and category reordering requirements to support multi-period zero-spend filtering, last active transaction indicators, category-currency progress line normalization, and a unified reorder preview dialog.

## Impact

- **UI Components**:
  - `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/smart-order-optimizer-dialog.tsx` (extended or refactored into unified category order dialog)
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx`
- **Data Transforms**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` (`computeBudgetSummaryItems`, `classifyCategoryActivity`)
- **Automated Tests**:
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`
  - `src/app/(main)/dashboard/family-budget/_components/spending-metrics.test.ts`
