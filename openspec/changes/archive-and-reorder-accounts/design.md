# Design

## Context

ExternalProvider represents accounts as categories with `categoryType` in `[Account, BankAccount, DebtAccount]`, each having a `name` and an integer `order`. Archived accounts follow the convention of having their `name` prefixed with `_`. The dashboard already hides zero-balance archived accounts and exposes non-zero ones as unreconciled warnings.

Upstream synchronization takes place through `POST /api/external-provider/Exchange/Ping` under `ExchangeKey.Category` (key: 2), accepting a JSON-encoded array of modified category entities (`entityJson`).

## Goals / Non-Goals

**Goals:**
- Provide pure, testable transform functions in `external-provider-data.ts` for archiving, unarchiving, single account repositioning, and batch repositioning.
- Integrate an accessible row action menu (`DropdownMenu`) on each account row in `AccountsCard`.
- Implement a confirmation modal (`AlertDialog`) for archiving that highlights non-zero balance implications.
- Implement a card-level notification banner in `AccountsCard` to batch-move active accounts positioned below archived accounts.
- Provide optimistic UI updates with error rollback and toast feedback.
- Maintain 100% test coverage for all new reordering and renaming logic.

**Non-Goals:**
- Modifying account balances or currencies (reconciliation remains the user's responsibility).
- Altering existing drag-and-drop sortable behavior.
- Altering category types or creating/deleting accounts from this UI.

## Decisions

### Decision 1: Pure transform helpers in `external-provider-data.ts`

We will implement dedicated pure helper functions:
- `archiveAccountCategory(allCategories, accountId)`:
  - Normalizes account name with leading `_`.
  - Moves the account to the last index of the accounts group.
  - Shifts subsequent accounts up and re-indexes `order` values sequentially (0, 1, 2, ...).
  - Returns `{ updatedCategories, modifiedCategories }`.
- `unarchiveAccountCategory(allCategories, accountId)`:
  - Strips leading `_` and any trailing spaces from the prefix.
  - Finds the index of the first archived account in the accounts group. If none exists, targets the end of the accounts group.
  - Inserts the unarchived account immediately before that index.
  - Re-indexes `order` values sequentially.
  - Returns `{ updatedCategories, modifiedCategories }`.
- `findAccountsBelowArchived(allCategories)`:
  - Finds the first archived account's index in the sorted accounts list.
  - Returns all active accounts whose index is greater than that first archived account.
- `moveAccountsAboveArchived(allCategories, accountIds?)`:
  - If `accountIds` is provided (single move), moves those specific accounts; otherwise moves all accounts found by `findAccountsBelowArchived`.
  - Inserts them as a preserved-order block immediately before the first archived account.
  - Re-indexes `order` values sequentially.
  - Returns `{ updatedCategories, modifiedCategories }`.

*Rationale:* Pure functions allow exhaustive unit testing with vitest, completely separated from React rendering and async network calls.

### Decision 2: Upstream mutation support

`updateCategoriesOrder` in `external-provider-client.ts` already sends `items: [{ key: ExchangeKey.Category, entityJson: JSON.stringify(modifiedCategories) }]`. Because both `name` and `order` belong to `ExternalProviderCategory`, this existing endpoint and protocol can accept both `order` and `name` changes simultaneously. We can aliased/generalize `updateCategories` or keep `updateCategoriesOrder` with clear documentation.

### Decision 3: UI Architecture in `AccountsCard`

- **Row Actions Menu**: A button with `MoreHorizontal` icon on the right side of `SortableAccountRow`, triggering a `DropdownMenu`.
- **Archive Confirmation**: An `AlertDialog` managed in `AccountsCard`, showing account name and warning if `balance !== 0`.
- **Batch Banner**: A compact banner rendered inside `SectionShell` above the account rows when `accountsBelowArchived.length > 0`. Includes a button *"Move above archived"*.

## Risks / Trade-offs

- **[Risk] Upstream network/proxy failure during mutation**  
  $\rightarrow$ *Mitigation*: Perform optimistic state updates with standard `try / catch` rollback to previous categories and sonner error toast notification.
- **[Risk] Accounts with already existing `_` prefixes or whitespace**  
  $\rightarrow$ *Mitigation*: Stripping regex `replace(/^_+/, "").trim()` when unarchiving, and ensuring clean single `_` prefix when archiving.
- **[Risk] Conflicting concurrent reorders**  
  $\rightarrow$ *Mitigation*: Sequential integer re-indexing across all accounts in the group ensures consistent ordering without sparse gaps or collisions.
