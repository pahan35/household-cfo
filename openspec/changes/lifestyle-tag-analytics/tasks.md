# Tasks

## 1. Core Lifestyle & Tag Transform Engine

- [ ] 1.1 Create `src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts` with currency-suffix-tolerant category normalizers, generic Category/Tag donut & drill-down aggregators (`Expenses` and `Income`), and filtered monthly trend series builders, and verify `npm run verify` passes
- [ ] 1.2 Implement travel episode detection (`#travel`/`#end-travel` bookends, >60-day gap splitting for reused destination tags, pre-trip booking attribution, and untagged date-window candidate discovery) and concert event costing (same-day multi-ticket grouping, Local vs. Trip vs. Concert-in-Travel overlap) in `lifestyle-transforms.ts`
- [ ] 1.3 Implement the wellness & learning cadence engine in `lifestyle-transforms.ts` (multi-currency unification for `Massage`, `Medicine`/`Medical services`, `Menthal Health`/`Mental Health`, `Sport`, `Learning`; `10x` Pilates default pass multiplier; `#10x`/`#5x`/`#1x` overrides; package outlier detection; session frequency and cost-per-session calculation)
- [ ] 1.4 Add comprehensive unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/lifestyle-transforms.test.ts` covering category-to-tag drill-down, reused destination tag splitting, untagged window candidate scoring, concert overlap, and wellness pass cadence, and verify all tests pass

## 2. Navigation, Shared Layout & Tag/Category Statistics Explorer

- [ ] 2.1 Update `src/navigation/sidebar/sidebar-items.ts` to add the expandable "Lifestyle & Tags" item under "Family Budget" (`Tag & Category Explorer`, `Trips & Concerts`, `Health & Sport`, `Learning`) and create the shared `src/app/(main)/dashboard/family-budget/lifestyle/layout.tsx` and `use-lifestyle-data.ts` hook with in-page tab navigation
- [ ] 2.2 Implement the **Tag & Category Explorer** screen (`src/app/(main)/dashboard/family-budget/lifestyle/page.tsx` and `tag-category-explorer.tsx`) featuring the `Expenses | Income` donut chart, `By Category (with > Tag drill-down) | Unified Category | By Tag` switcher, filtered historical trend chart, and matching transaction feed, and verify `npm run verify` passes

## 3. Trips & Concerts, Health & Sport, and Learning Screens

- [ ] 3.1 Implement the **Trips & Concerts** screen (`src/app/(main)/dashboard/family-budget/lifestyle/trips-concerts/page.tsx` and `trips-concerts-dashboard.tsx`) with episode cards, pre-booking vs. on-site breakdown, explicit "Untagged in Trip Window" confirmation checklist wired to `updateTransactionTags`, and Concert Direct vs. Allocated Trip Overhead views
- [ ] 3.2 Implement the **Health & Sport** screen (`src/app/(main)/dashboard/family-budget/lifestyle/health-sport/page.tsx` and `health-sport-dashboard.tsx`) with multi-currency stream cards (`Massage`, `Physiotherapy`, `Mental Health`, `Pilates`), session cadence & effective cost-per-session metrics, and the inline Wellness Tag & Pass Audit queue wired to `updateTransactionTags`
- [ ] 3.3 Implement the **Learning** screen (`src/app/(main)/dashboard/family-budget/lifestyle/learning/page.tsx` and `learning-dashboard.tsx`) with `#platform`, `#cert`, `#course`, `#tutor`, and `#books` facets and subscription run-rate metrics, and verify `npm run verify` passes with zero errors
