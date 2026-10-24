# budget-overview Specification

## Purpose

Provides a family budget overview screen that turns the verified ExternalProvider upstream data (accounts, transactions, budgets, settings) into a single live dashboard, replacing template-only finance screens as the first real-data screen in the app.

## Requirements

### Requirement: Family Budget screen navigation

The dashboard sidebar SHALL include a "Family Budget" entry that navigates to `/dashboard/family-budget`, and the route SHALL render a screen following the dashboard shell and visual conventions of nearby screens (finance reference).

#### Scenario: Navigating to the screen

- **WHEN** the user clicks "Family Budget" in the dashboard sidebar
- **THEN** the screen at `/dashboard/family-budget` loads and displays the overview sections

### Requirement: Accounts and cards snapshot

The screen SHALL display the user's account-type categories (accounts, bank accounts, cards) with their current balance, obtained through the proxy's categories exchange, grouped or labeled so account types are distinguishable. Money SHALL be presented in the default currency from settings.

#### Scenario: Accounts listed with balances

- **WHEN** the screen loads and the upstream returns account categories with nonzero balances
- **THEN** each account is shown by name with its balance rendered in the reporting currency

#### Scenario: No accounts defined

- **WHEN** the upstream returns no account-type categories
- **THEN** the accounts section shows an empty state with guidance to add accounts in ExternalProvider

### Requirement: Recent transactions list

The screen SHALL display the most recent transactions in reverse-chronological order, each showing its date, direction-aware amount (income vs expense visually distinguishable), and the counterpart category or comment. Additional older transactions SHALL be retrievable via paging.

#### Scenario: Recent transactions are shown

- **WHEN** the screen loads and the upstream returns transactions with `hasMoreData`
- **THEN** a first page of transactions is listed newest-first with date, amount (signed, currency-formatted), and counterpart or comment

#### Scenario: Loading more transactions

- **WHEN** the user requests more transactions and the previous response reported `hasMoreData`
- **THEN** the next page is fetched with the continuation and appended without duplicating already-shown items

#### Scenario: No transactions exist

- **WHEN** the upstream returns zero transactions
- **THEN** the transactions section shows an empty state

### Requirement: Budget spent-versus-limit summary

The screen SHALL display, for the current reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. Categories at or above their limit SHALL be visually flagged as overruns.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category `currentAmount` and `limitAmount` values for the selected period
- **THEN** the screen shows each category with spent and limit amounts in the reporting currency and marks categories exceeding their limit

#### Scenario: Period selection

- **WHEN** the user changes the displayed period (e.g. current month vs previous)
- **THEN** the budget summary and recent-transactions pages refresh for that period

### Requirement: Money and date presentation

Amounts SHALL be formatted in the screen's reporting currency (from settings, falling back to the stats response currency), and transaction timestamps SHALL be shown using the ISO variant provided by the upstream, displayed with existing project date formatting.

#### Scenario: Currency from settings

- **WHEN** settings report a default currency and a transaction excludes no explicit currency
- **THEN** amounts render with that currency's symbol/format

### Requirement: Loading, empty, and error states

The screen SHALL show loading placeholders while data is being fetched, SHALL render self-explanatory empty states when a section has no data, and SHALL on fetch or upstream failure render an error message identifying the failing section with a retry action, without exposing any credential values in the UI.

#### Scenario: Upstream failure on one section

- **WHEN** one data source returns an error (e.g. HTTP 500/502 from the proxy) while others succeed
- **THEN** the affected section shows an error state with a retry action while unaffected sections render their data

#### Scenario: Retry after failure

- **WHEN** the user triggers retry on a failed section
- **THEN** that section refetches and re-renders without reloading the whole screen

### Requirement: Credential-safe data access

All upstream access from this screen SHALL go through the local proxy path `/api/external-provider/...`; the client SHALL NOT send any credential, and error output rendered in the UI MUST remain scrubbed of credentials as established by the proxy.

#### Scenario: No credentials in client traffic

- **WHEN** any request from the screen is inspected
- **THEN** it targets `/api/external-provider/...` and contains no token, cookie, or user-id credential material

### Requirement: Expense composition pie chart

The Family Budget overview dashboard SHALL include an interactive Expense Composition Pie/Donut Chart card for the active reporting period, displaying the proportional distribution of spending across expense categories according to the active exclusion preset.

#### Scenario: Rendering expense pie chart
- **WHEN** the dashboard loads with expense data for the active period
- **THEN** an interactive pie chart renders with slices proportional to each category's spent amount, formatted in the reporting currency

#### Scenario: Hovering or inspecting a category slice
- **WHEN** the user hovers over a category slice or tooltip in the pie chart
- **THEN** the tooltip displays the category name, spent amount, percentage of controllable expenses, and budget limit if configured

#### Scenario: Quick exclusion toggle on the chart card
- **WHEN** the user toggles the quick "Exclude Rent" switch on the pie chart card
- **THEN** the pie chart recalculates immediately with the category omitted or restored without navigating away

### Requirement: Net income and controllable expense metrics

The Family Budget overview dashboard SHALL display key summary metrics reflecting the active exclusion preset, including Gross Income, Net Disposable Income (after tax deductions), and Controllable Expenses.

#### Scenario: Overview metric presentation
- **WHEN** the dashboard renders with the active period data
- **THEN** the metrics display the calculated Net Disposable Income, total Controllable Expenses, and the remaining net cash flow margin

