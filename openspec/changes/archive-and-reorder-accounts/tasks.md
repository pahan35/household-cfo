# Tasks

## 1. Core Data & Algorithm Logic

- [x] 1.1 Implement `archiveAccountCategory` in `external-provider-data.ts` to prefix account names with `_`, move to the end of the accounts group, re-index sequential orders, and verify with unit tests
- [x] 1.2 Implement `unarchiveAccountCategory` in `external-provider-data.ts` to strip leading `_`, place as the last non-archived account, re-index sequential orders, and verify with unit tests
- [x] 1.3 Implement `findAccountsBelowArchived` and `moveAccountsAboveArchived` in `external-provider-data.ts` for single and batch repositioning above the first archived account, and verify with unit tests
- [x] 1.4 Add unit tests in `external-provider-data.test.ts` covering archive, unarchive, single move, batch move, and edge cases, verifying with `npx vitest run src/app/\(main\)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`

## 2. UI Components & Dashboard Integration

- [x] 2.1 Add row action dropdown menu to `SortableAccountRow` in `accounts-card.tsx` with "Archive account", "Unarchive account", and "Move above archived" actions
- [x] 2.2 Implement archive confirmation `AlertDialog` in `accounts-card.tsx` displaying name changes and unreconciled balance warnings
- [x] 2.3 Implement batch repositioning banner in `accounts-card.tsx` when one or more active accounts are positioned below archived accounts
- [x] 2.4 Wire mutation callbacks in `accounts-card.tsx`, `family-budget-dashboard.tsx`, and `budget-overview-dashboard.tsx` with optimistic updates, rollback, and `sonner` toast notifications

## 3. Verification & Quality Gates

- [x] 3.1 Run `npm run verify` to validate formatting, linting, and strict TypeScript compilation
- [x] 3.2 Run test suite to ensure all unit tests pass without regressions
