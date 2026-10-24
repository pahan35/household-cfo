# Spec Delta

## MODIFIED Requirements

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards, debt accounts) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable, and sorted ascending by ExternalProvider's `order` property (`category.order`). Money SHALL be presented in the category's currency or the default currency from settings. Users SHALL be able to click an account row to filter the transactions list to that account (and click again or clear the filter to restore the all-accounts view). Users SHALL be able to drag-and-drop reorder accounts, which SHALL persist the updated `order` values upstream via `/Exchange/Ping` so that the order is updated across ExternalProvider mobile and web apps. Accounts whose name starts with `_` and whose balance is `0` SHALL be hidden by default and viewable on demand via a toggle; accounts whose name starts with `_` and whose balance is non-zero SHALL always remain visible with a warning indicator and reconciliation guidance. Each account row SHALL also display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's counterpart (source or target), amount, comment, and tags. Users SHALL be able to archive an active account via a row action, which SHALL prompt for confirmation, prefix the account name with `_`, move it to the very end of the account order list, and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to unarchive an archived account, which SHALL strip the leading `_` prefix, move it to become the last non-archived account (immediately preceding the first archived account), and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to reposition active accounts located below archived accounts to immediately above the first archived account individually via a row action or collectively via a batch action banner, preserving relative order and persisting updated orders to `/Exchange/Ping`.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances and `order` values
- **THEN** each active account is shown in ascending `category.order` sequence with its balance rendered in the appropriate currency

#### Scenario: Clicking an account filters transactions by that account

- **WHEN** the user clicks an account row in the accounts list
- **THEN** the account row is visually marked as selected and the transactions section filters to show all-time transactions involving that account

#### Scenario: Clearing the selected account filter

- **WHEN** an account is currently selected and the user clicks the selected account row again or activates the "Clear filter" control in the transactions section
- **THEN** the account selection is cleared and the transactions section returns to showing transactions across all accounts

#### Scenario: Reordering accounts persists upstream to ExternalProvider

- **WHEN** the user drags an account row to a new position in the accounts list
- **THEN** the UI immediately reflects the new order and sends the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`, updating the canonical category state

#### Scenario: Zero-balance `_` prefixed accounts hidden by default and shown on demand

- **WHEN** the upstream returns an account whose name starts with `_` and whose balance is `0`
- **THEN** the account is omitted from the default view and becomes visible when the user activates the "Show archived" toggle

#### Scenario: Non-zero-balance `_` prefixed accounts remain visible with reconciliation warning

- **WHEN** the upstream returns an account whose name starts with `_` and whose balance is not `0`
- **THEN** the account remains visible even when archived accounts are hidden, displays a warning icon, and on hover/focus explains how to reconcile the balance to `0` in the ExternalProvider app

#### Scenario: Viewing last transaction details on an account

- **WHEN** an account has at least one recorded transaction and the user views the account row or hovers/focuses the last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart category (source or destination), formatted amount, comment (if any), and tags (if any)

#### Scenario: No accounts defined

- **WHEN** the upstream returns no account-type categories
- **THEN** the accounts section shows an empty state with guidance to add accounts in ExternalProvider

#### Scenario: Archiving an active account

- **WHEN** the user selects "Archive account" from an active account's row action menu and confirms the action in the confirmation dialog
- **THEN** the account name is prefixed with `_`, the account is moved to the end of the accounts group, subsequent accounts shift up, updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Cancelling account archiving

- **WHEN** the user opens the archive confirmation dialog for an account and clicks Cancel
- **THEN** the dialog closes, no changes are made to the account name or order, and no upstream requests are sent

#### Scenario: Unarchiving an archived account

- **WHEN** the user selects "Unarchive account" from an archived account's row action menu
- **THEN** the leading `_` is removed from the account name, the account is moved to become the last non-archived account (immediately preceding the first archived account), updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Moving an active account above archived accounts via row action

- **WHEN** an active account is positioned after one or more archived accounts and the user selects "Move above archived" from its row action menu
- **THEN** that account is moved immediately preceding the first archived account, intermediate accounts shift accordingly, updated entities are sent upstream via `/Exchange/Ping`, and a success toast notification appears

#### Scenario: Batch moving active accounts above archived accounts

- **WHEN** one or more active accounts are positioned below archived accounts and the user activates the batch "Move above archived" action in the card banner
- **THEN** all active accounts below archived accounts are moved as a block immediately preceding the first archived account preserving their relative order, updated entities are sent upstream via `/Exchange/Ping`, and the banner is dismissed
