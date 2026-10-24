# Spec Delta

## MODIFIED Requirements

### Requirement: Family Budget screen navigation

The dashboard sidebar SHALL include a top-level "Family Budget" group positioned above the template "Dashboards" group. The "Family Budget" group SHALL include an "Accounts & Transactions" entry that navigates to `/dashboard/family-budget`, a "Budget Overview" entry that navigates to `/dashboard/family-budget/budget-overview`, and an "FX & Inflation" entry that navigates to `/dashboard/family-budget/fx-inflation`, and all routes SHALL render screens following the dashboard shell and visual conventions of nearby screens (finance reference). The `/dashboard/family-budget` screen SHALL focus on account liquidity, accounts management, and all-time transaction review without a header month selector, while `/dashboard/family-budget/budget-overview` SHALL house the period selector, net income and controllable expense metrics, expense composition pie chart, year-over-year trends chart, and budget spent-versus-limit summary.

#### Scenario: Navigating to the screen

- **WHEN** the user clicks "Accounts & Transactions" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget` loads and displays the account liquidity metrics, accounts and cards section, and all-time transactions feed without a header month selector

#### Scenario: Navigating to the Budget Overview screen

- **WHEN** the user clicks "Budget Overview" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/budget-overview` loads and displays the period selector, net income and controllable expense metrics strip, expense composition pie chart, year-over-year trends chart, and budget spent-versus-limit summary

#### Scenario: Navigating to the FX & Inflation Analysis screen

- **WHEN** the user clicks "FX & Inflation" under the "Family Budget" group in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget/fx-inflation` loads and displays the macroeconomic inflation and USD/PLN sensitivity analysis sections

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards, debt accounts) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable, and sorted ascending by ExternalProvider's `order` property (`category.order`). Money SHALL be presented in the category's currency or the default currency from settings. Users SHALL be able to click an account row to filter the transactions list to that account (and click again or clear the filter to restore the all-accounts view). Users SHALL be able to drag-and-drop reorder accounts, which SHALL persist the updated `order` values upstream via `/Exchange/Ping` so that the order is updated across ExternalProvider mobile and web apps. Accounts whose name starts with `_` and whose balance is `0` SHALL be hidden by default and viewable on demand via a toggle; accounts whose name starts with `_` and whose balance is non-zero SHALL always remain visible with a warning indicator and reconciliation guidance. Each account row SHALL also display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's counterpart (source or target), amount, comment, and tags.

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

### Requirement: Recent transactions list

The screen SHALL display all-time transactions in reverse-chronological order (either across all accounts or filtered by a selected account via `categoryIds`), each showing its date, explicit source and target names (`Source -> Target`) resolved from the categories lookup when omitted from the raw transaction payload, direction-aware amount in the account's native currency, any comment or tags, and the running balance of the involved account after that transaction in the account's currency. Additional older transactions SHALL be retrievable via incremental "Load more" paging whenever `hasMoreData` is true.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData`
- **THEN** a first page of transactions is listed newest-first with date, resolved source and target category names (`Source -> Target`), direction-aware amount in the account's native currency, comment/tags (if any), and the calculated balance of the account immediately after that transaction

#### Scenario: Filtering transactions by selected account

- **WHEN** an account is selected in the accounts list
- **THEN** the transactions list fetches and displays transactions for that `accountId`, shows an active filter indicator with the account's name and current balance in its native currency, and displays the account's running balance after each transaction

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page of older transactions (globally or for the selected account) is fetched with the continuation (`skip`), appended without duplicating already-shown items, and running account balances are continuously calculated across the appended rows

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions for the current view or selected account
- **THEN** the transactions section shows an empty state (with an option to clear the account filter if one is active)

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display, for the selected reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Categories at or above their limit SHALL be visually flagged as overruns. By default, budget categories SHALL be sorted ascending by ExternalProvider's `category.order` (with an option to sort by percentage spent), and users SHALL be able to drag-and-drop reorder categories in custom-order mode, persisting the updated `order` values upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category `currentAmount` and `limitAmount` values for the selected period
- **THEN** the screen shows each category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency and marks categories exceeding their limit

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags a budget category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), formatted amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user changes the displayed period (e.g. current month, previous month, or a selected historical month) on the Budget Overview screen
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that period

## ADDED Requirements

### Requirement: Account liquidity and currency breakdown metrics

The Accounts & Transactions screen (`/dashboard/family-budget`) SHALL display an account liquidity summary strip showing Total Net Liquid Balance converted into the user's default currency (using ExternalProvider's `ExchangeKey.Currency` exchange rates and excluding accounts marked `exceptFromBalance`), a breakdown of native balances grouped by account currency, and active filter/reconciliation status (highlighting either the currently selected account's balance and loaded flow or any debt/unreconciled archived accounts).

#### Scenario: Multi-currency liquidity metrics rendered

- **WHEN** the Accounts & Transactions screen loads with accounts in one or more currencies and currency exchange rates from `/Exchange/Ping`
- **THEN** the top metrics strip displays the converted total balance in the default currency, native currency subtotals (e.g. PLN, USD, EUR), and debt/reconciliation or selected-account status
