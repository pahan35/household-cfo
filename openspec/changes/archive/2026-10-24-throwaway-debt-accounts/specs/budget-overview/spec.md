# Spec Delta

## MODIFIED Requirements

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards, debt accounts) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable (including badging `Debt:` / `_Debt:` standard accounts as Throwaway Clearing Accounts), and sorted ascending by ExternalProvider's `order` property (`category.order`). Money SHALL be presented in the category's currency or the default currency from settings. Users SHALL be able to click an account row to filter the transactions list to that account (and click again or clear the filter to restore the all-accounts view), and when a Throwaway Clearing Account (`Debt:` or `_Debt:`) is selected, the screen SHALL surface the Clearing Ledger Workbench for that account. Users SHALL also be able to initialize a new Throwaway Clearing Account (`Debt: <Person/Deal>`) directly from the Accounts & Cards header action. Users SHALL be able to drag-and-drop reorder accounts, which SHALL persist the updated `order` values upstream via `/Exchange/Ping` so that the order is updated across ExternalProvider mobile and web apps. Accounts whose name starts with `_` and whose balance is `0` SHALL be hidden by default and viewable on demand via a toggle; accounts whose name starts with `_` and whose balance is non-zero SHALL always remain visible with a warning indicator and reconciliation guidance. Each account row SHALL also display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's counterpart (source or target), amount, comment, and tags. Users SHALL be able to archive an active account via a row action, which SHALL prompt for confirmation, prefix the account name with `_`, move it to the very end of the account order list, and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to unarchive an archived account, which SHALL strip the leading `_` prefix, move it to become the last non-archived account (immediately preceding the first archived account), and persist the updated name and sequential orders to `/Exchange/Ping`. Users SHALL be able to reposition active accounts located below archived accounts to immediately above the first archived account individually via a row action or collectively via a batch action banner, preserving relative order and persisting updated orders to `/Exchange/Ping`.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances and `order` values
- **THEN** each active account is shown in ascending `category.order` sequence with its balance rendered in the appropriate currency

#### Scenario: Clicking an account filters transactions by that account

- **WHEN** the user clicks an account row in the accounts list
- **THEN** the account row is visually marked as selected and the transactions section filters to show all-time transactions involving that account

#### Scenario: Selecting a throwaway debt account opens the clearing ledger workbench

- **WHEN** the user selects a Throwaway Clearing Account (`Debt: <Name>`) in the accounts list or triggers "Open Clearing Ledger" from its row action menu
- **THEN** the Clearing Ledger Workbench opens for that account alongside its filtered transactions feed

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

### Requirement: Request deduplication, caching, and on-demand refresh

The Family Budget overview screen and its server proxy SHALL deduplicate concurrent requests and cache upstream ExternalProvider responses with a 5-hour time-to-live (TTL) across component mounts, period switches, Hot Module Replacement (HMR) rebuilds, and page reloads, while allowing explicit on-demand cache invalidation from the UI and automatically invalidating cached category, transaction, and statistics reads whenever a category write (`entityJson !== null` to `/Exchange/Ping`) or transaction write (`/api/transaction/create` or `/api/transaction/update`) is sent through the proxy.

#### Scenario: Initial dashboard load deduplicates shared data across sections

- **WHEN** the Family Budget screen mounts
- **THEN** shared upstream resources (settings, categories/accounts, 40-month budget statistics, and active-period/recent transactions) are requested at most once per unique resource rather than refetched independently by child cards

#### Scenario: Switching periods reuses cached 40-month budget statistics

- **WHEN** the user switches between Current Month, Previous Month, or a historical month within the already-loaded 40-month statistics window
- **THEN** the dashboard derives the selected period's category budget and spending metrics from the cached statistics payload without issuing a new `/stat/ping` request, and only requests transactions for the selected period if not already cached

#### Scenario: HMR rebuilds and page reloads serve cached responses within TTL

- **WHEN** a client or server HMR rebuild occurs or the page is reloaded within the 5-hour cache TTL
- **THEN** cached responses are served without issuing duplicate upstream requests to ExternalProvider or spawning duplicate keychain lookup processes

#### Scenario: On-demand force refresh bypasses caches

- **WHEN** the user clicks the "Refresh Data" action in the dashboard header or a section "Retry" action
- **THEN** both client and server proxy caches are bypassed for the refreshed resources, fresh data is fetched from the ExternalProvider upstream, the cache entries are updated, and the dashboard updates in place without unmounting the component tree

#### Scenario: Category reorder write invalidates cached category reads

- **WHEN** the client sends a category write payload (`entityJson` containing updated categories) to `/api/external-provider/Exchange/Ping`
- **THEN** the server proxy bypasses caching for the write request, invalidates cached `/Exchange/Ping` entries in the proxy cache, and the client updates its cached `categories` entry with the latest category state

#### Scenario: Transaction write invalidates cached transaction, category, and statistics reads

- **WHEN** the client sends a transaction creation or update request to `/api/external-provider/api/transaction/create` or `/api/external-provider/api/transaction/update`
- **THEN** the server proxy bypasses caching for the write request and invalidates cached `/api/transaction/get`, `/Exchange/Ping`, and `/stat/ping` entries so subsequent reads reflect updated account balances and transaction history
