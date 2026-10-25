# Proposal

## Why

In the Health & Sport dashboard (`/dashboard/family-budget/lifestyle/health-sport`), wellness expenses paid in foreign currencies (e.g. EUR) are erroneously classified as PLN and un-converted because category settings override foreign source account currencies. Furthermore, the inline audit queue appends package outlier warnings at the bottom under routine untagged entries, and immediately dismisses audit entries the moment any tag (such as `#wife`) is applied, preventing users from adding orthogonal activity stream tags (such as `#pilates`) to the same transaction.

## What Changes

- **Foreign Source Currency Precedence**: Fix transaction amount conversion in `lifestyle-transforms.ts` to recognize foreign source account currencies (e.g. EUR) when the destination category lacks currency distinction, converting native foreign amounts to the default currency (`PLN`) at live rates.
- **Dual Amount Presentation**: Render audit queue amounts consistently with other lifestyle views: showing the primary converted amount in `PLN` alongside a secondary native amount/currency indicator (e.g., `PLN 3,010.00` with `700.00 EUR`).
- **Audit Queue Warning Prioritization**: Reorder the inline audit queue so high-priority warnings (multi-session package outliers) appear first at the top, followed by informational untagged medical/sport entries, with secondary sorting descending by transaction date.
- **Orthogonal Tag Dimensions**: Differentiate between primary activity/service tags (`#pilates`, `#gym`, `#multisport`, `#consult`, `#exams`, `#dentist`, etc.) and scope/person tags (`#wife`, `#partner`). Applying a person tag keeps the item in the queue with the person tag active so activity tags remain selectable.
- **Auto-Dismissal Timer with Pause / Dismiss Controls**: When required audit tags are applied, start an auto-dismissal countdown timer (4 seconds) with `Pause / Add more` and `Dismiss now` controls to allow frictionless multi-tagging before removal from the queue.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `wellness-and-learning-cadence`: Updates requirements for foreign currency conversion in wellness streams, prioritization of package outlier warnings in the audit queue, dimension-aware multi-tagging, and auto-dismissal controls for tag audit workflows.

## Impact

- **Affected Files**:
  - `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`
  - `src/app/(main)/dashboard/family-budget/lifestyle/health-sport/health-sport-dashboard.tsx`
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts`
- **APIs & Dependencies**: Reuses existing `updateTransactionTags` and `convertCurrencyAmount` without requiring new upstream endpoints or schema changes.
