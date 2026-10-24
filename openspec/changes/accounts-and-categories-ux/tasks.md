# Tasks

## 1. Domain Logic & Unit Tests (`external-provider-data.ts`)

- [ ] 1.1 Add category sorting (`sortCategoriesByOrder`), subset reorder calculation (`reorderCategoriesSubset`), `_`-prefix archive classification & non-zero balance warning detection (`isArchivedCategoryName`, `filterAndClassifyAccounts`, `filterAndClassifyCategories`), and last-transaction indexing/summary formatting (`buildLastTransactionMap`, `getLastTransactionSummaryForCategory`) in `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`, and verify TypeScript compilation with `npm run verify`.
- [ ] 1.2 Add a `test` script in `package.json` using Node's built-in test runner and create unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts` covering category order sorting, partial/full drag-and-drop reorder calculation, `_`-prefix filtering (hiding zero-balance `_` accounts while keeping non-zero `_` accounts flagged with reconciliation warning), and last-transaction extraction (counterpart source/target, amount, comment, tags, deleted-tx exclusion); run `npm test` to verify all tests pass.

## 2. Server Proxy Cache Invalidation & Client Write API

- [ ] 2.1 Add `invalidateProxyCacheByPathPrefix` to `src/server/external-provider/cache.ts` and update `src/app/api/external-provider/[...path]/route.ts` so `POST /api/external-provider/Exchange/Ping` write payloads (`entityJson !== null`) bypass caching and invalidate cached `/Exchange/Ping` entries; verify with unit tests in `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-client.test.ts`.
- [ ] 2.2 Add `updateCategoriesOrder` in `src/app/(main)/dashboard/family-budget/_components/external-provider-client.ts` to send modified `ExternalProviderCategory[]` entities via `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category = 2`, `Cache-Control: no-cache`), update/invalidate the client `categories` cache entry, and verify unit tests pass with `npm test`.

## 3. Shared Last-Transaction Hover Component & Dashboard Wiring

- [ ] 3.1 Create `src/app/(main)/dashboard/family-budget/_components/last-transaction-badge.tsx` to render the last transaction timestamp with an interactive hover/focus `HoverCard` / `Tooltip` displaying counterpart (`From` / `To`), formatted amount, full date/time, comment, and tag badges; verify types with `npm run verify`.
- [ ] 3.2 Update `src/app/(main)/dashboard/family-budget/_components/family-budget-dashboard.tsx` to load a cached unfiltered recent-transactions batch alongside period transactions, compute the last-transaction lookup map, and pass `onReorderCategories` (with optimistic state update + rollback on error) and `lastTransactionByCategoryId` down to `AccountsCard` and `BudgetSummaryCard`; verify with `npm run verify`.

## 4. `AccountsCard` & `BudgetSummaryCard` UX Enhancements

- [ ] 4.1 Update `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx` to sort accounts by ExternalProvider `order`, support `@dnd-kit/react` vertical drag-and-drop reordering, hide zero-balance `_`-prefixed accounts by default with a "Show archived" toggle, always display non-zero-balance `_`-prefixed accounts with an amber warning icon and reconciliation tooltip guidance, and show `LastTransactionBadge` on each account row; verify with `npm run verify`.
- [ ] 4.2 Update `src/app/(main)/dashboard/family-budget/_components/budget-summary-card.tsx` to sort budget categories by ExternalProvider `order` by default (with a toggle for `"Custom Order"` vs `"% Spent"`), support `@dnd-kit/react` vertical drag-and-drop reordering in Custom Order mode, hide inactive `_`-prefixed categories by default with a "Show archived" toggle, and show `LastTransactionBadge` on each category row; verify with `npm run verify` and `npm test`.
