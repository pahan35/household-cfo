# Tasks

## 1. UI Precedence Fix

- [x] 1.1 In `computeBudgetSummaryItems` (`budget-summary-card.tsx`), prioritize `categoryNameMap.get(cat.id)` over `cat.title` and `cat.name` in both filter and mapping blocks, falling back to snapshot titles only for unmapped categories.
- [x] 1.2 Add unit tests in `spending-metrics.test.ts` verifying that `computeBudgetSummaryItems` prioritizes `categoryNameMap` when a category is renamed or archived (`_` prefix), and verify with `npx vitest run src/app/\(main\)/dashboard/family-budget/_components/spending-metrics.test.ts`.

## 2. Client and Proxy Cache Invalidation Fix

- [x] 2.1 Update `updateCategoriesOrder` in `external-provider-client.ts` to purge entries starting with `stat:` from `clientCacheState.entries`.
- [x] 2.2 Update proxy route `src/app/api/external-provider/[...path]/route.ts` to invalidate `/stat/ping` proxy cache on `isExchangeWritePayload` writes.
- [x] 2.3 Add unit tests in `external-provider-client.test.ts` and `proxy-route.test.ts` verifying client `stat:*` and proxy `/stat/ping` cache invalidation upon category writes, and verify with `npx vitest run`.

## 3. Quality & Verification

- [x] 3.1 Run `npm run verify` and vitest tests across modified test suites to ensure zero type errors, clean linting, and passing regressions.
