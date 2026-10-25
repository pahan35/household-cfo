# Tasks

## 1. Core Diffing & Tier Reason Logic

- [ ] 1.1 Implement Longest Increasing Subsequence (LIS) algorithm in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` to classify category order diffs into active movers (`isActiveMove: true`) and passive ripple shifts (`isActiveMove: false`).
- [ ] 1.2 Enhance `buildCategoryOrderDiffItems` in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts` to detect currency tier realignments and output contextual reason labels (e.g. "Moved to Foreign tier" or "Promoted to Primary tier").
- [ ] 1.3 Add unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` verifying that when 4 categories are out of tier, exactly those 4 categories are flagged as `isActiveMove: true`, remaining categories are flagged as passive shifts, and reason texts correctly reflect tier realignment.

## 2. Dialog UX & Footer Spacing Polish

- [ ] 2.1 Update `CategoryOrganizationDialog` in `src/app/(main)/dashboard/family-budget/_components/category-organization-dialog.tsx` to support a 3-state filter (`direct` / `shifted` / `all`), defaulting to "Direct moves" (`direct`).
- [ ] 2.2 Update the diff summary bar and action button in `category-organization-dialog.tsx` to display active reorganization counts (e.g. "4 categories to reorganize") alongside passive ripple counts, and update button label to reflect active count.
- [ ] 2.3 Refactor `DialogFooter` styling in `category-organization-dialog.tsx` by setting `m-0 px-6 py-4 flex flex-row items-center justify-end gap-3` to neutralize negative margins and provide balanced spacing for action buttons.

## 3. Verification & Quality Gates

- [ ] 3.1 Run unit test suites for `external-provider-data.test.ts` and verify all tests pass.
- [ ] 3.2 Run `npm run verify` (`biome check && tsc --noEmit`) and verify zero errors, lint warnings, or type discrepancies.
