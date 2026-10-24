# Proposal

## Why

In ExternalProvider, accounts are archived by prefixing their names with `_` and moving them to the bottom of the account list. When users create new accounts in ExternalProvider, ExternalProvider automatically appends them with the highest `order` index, placing new active accounts below existing archived accounts. Currently, the Family Budget Accounts screen lacks actions to quickly archive/unarchive accounts and requires tedious manual dragging to reposition newly created accounts above archived ones.

## What Changes

- Add an **Archive Account** action on active account rows that prefixes the account name with `_`, moves it to the very end of the account order list ($N-1$), and requires confirmation before updating ExternalProvider upstream.
- Add an **Unarchive Account** action on archived account rows that strips the leading `_` prefix and places the account as the last non-archived account (immediately preceding the first archived account).
- Add a **Move Above Archived** row action for active accounts that are positioned below any archived account, moving the account immediately above the first archived account.
- Add a **Batch Move Above Archived** banner/action in the Accounts card when one or more active accounts are positioned below archived accounts, allowing users to reposition all misplaced active accounts above the archived section in a single action while preserving their relative order.
- Provide clear confirmation dialogues and toast notifications for all archive and reorder operations.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `budget-overview`: Add account management actions for archiving, unarchiving, single-account repositioning above archived accounts, and batch repositioning above archived accounts.

## Impact

- Affected code:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`: Helper functions for account archiving, unarchiving, detecting accounts below archived, and batch/single repositioning.
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx`: Row action menu (`DropdownMenu`), confirmation dialog (`AlertDialog`), and batch repositioning banner.
  - `src/app/(main)/dashboard/family-budget/_components/budget-overview-dashboard.tsx` & `family-budget-dashboard.tsx`: Wiring mutations to upstream sync and state updates.
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-data.test.ts`: Unit test suite verifying account ordering algorithms and edge cases.
- API impact: Uses existing `POST /api/external-provider/Exchange/Ping` (`ExchangeKey.Category`) proxy endpoint for persisting category changes (`name` and `order`).
