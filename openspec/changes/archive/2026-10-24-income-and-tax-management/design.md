# Design: Income & Tax Management

## Context

See `proposal.md` for motivation and background.

The application currently has two primary screens under the Family Budget group:
- `/dashboard/family-budget` (Accounts & Transactions): Focuses on asset accounts, liquidity metrics, and transaction feeds.
- `/dashboard/family-budget/budget-overview` (Budget Overview): Focuses on expense budgeting, category spending limits, and YoY spending trends.

ExternalProvider represents income streams as categories with `categoryType: 1` (`CategoryType.Income`). Taxes are logged as expense transactions to currency-specific tax categories (e.g., "Taxes", "Podatki") and marked with tags (e.g., `#pit`, `#zus`, `#vat`). Currently, these income sources and tag-based tax distributions are not exposed in the UI.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated, focused screen at `/dashboard/family-budget/income` ("Income & Taxes").
- Enable full lifecycle management of income sources: drag-and-drop reordering, soft-archiving with `_` prefix, unarchiving, and budgeted targets.
- Enable tag-based tax aggregation across currencies, showing exact subtotals and effective tax rates.
- Provide an audit list for untagged tax transactions with one-click inline tag assignment persisted upstream via `/api/transaction/update`.
- Provide an embedded transaction ledger that filters to the selected income source or tax tag.

**Non-Goals:**
- Creating automated statutory tax return filings or integrating external tax calculation engines.
- Modifying the existing asset accounts view on `/dashboard/family-budget` (it will remain dedicated to liquid accounts and wallets).
- Bulk editing tags across hundreds of arbitrary transactions (the quick-fix is scoped specifically to untagged tax category transactions).

## Decisions

### 1. Dedicated Screen vs. Tabbed View
- **Decision**: Add a dedicated route at `/dashboard/family-budget/income` accessible via the "Family Budget" sidebar group with a `Banknote` icon.
- **Rationale**: Income planning, tax drag analysis, and income source management have distinct metrics (Gross Inflow, Effective Tax Rate, Net Disposable Income, Expense Coverage) that would clutter the Accounts liquidity screen or the Expense budget screen.
- **Alternatives Considered**: 
  - Sub-tabs inside `/dashboard/family-budget`: Rejected because the main dashboard is already dense with liquidity strips, cards, and transaction ledger.
  - Adding income rows to `AccountsCard`: Rejected because income sources do not hold asset balances and would distort total net liquid calculations.

### 2. Tax Category Detection & Tag Grouping
- **Decision**: Auto-detect the designated tax category per active currency using regex pattern `/(tax|podat|налог)/i`, while allowing the user to override the selected category if desired.
- **Rationale**: In standard ExternalProvider setups, users have one tax category per currency. Transactions within that category distinguish tax types via tags:
  - `#pit`, `#income-tax` -> Personal Income Tax
  - `#zus`, `#social` -> Social Security
  - `#health`, `#nfz` -> Health Insurance
  - `#vat` -> Value Added Tax
  - `#capital-gains`, `#belka` -> Capital Gains Tax
- **Alternatives Considered**: Requiring users to configure tax categories manually in local storage. Rejected in favor of smart auto-detection with fallback.

### 3. Missing Tag Audit & Quick-Fix Flow
- **Decision**: Identify all transactions where `destinationId` matches a detected tax category but `tags` is empty or lacks a known tax tag. Present these with an inline `<Select>` and check button that calls `updateTransaction` with the updated tags.
- **Rationale**: This turns a tedious audit chore into a fast, zero-friction workflow right on the Income & Taxes dashboard.
- **Upstream Integration**: Uses `/api/external-provider/api/transaction/update` (already permitted under the `/api/transaction` allowlist prefix in `src/server/external-provider/config.ts`).

### 4. Income Source Classification & Reordering
- **Decision**: Implement `filterAndClassifyIncomeSources(categories, { showArchived })` mirroring `filterAndClassifyAccounts`, and extend `reorderCategoriesSubset` group filtering to support `CategoryType.Income`.
- **Rationale**: Reuses the proven ordering, archiving, and synchronization pipeline already tested in `external-provider-data.ts`.

## Risks / Trade-offs

- **[Risk] Currency conversion for multi-currency taxes**: Tax transactions may occur in both PLN and USD.
  - **Mitigation**: Calculate native currency subtotals per tag (e.g. USD PIT vs PLN PIT) and convert to the user's default currency using rates from `ExchangeKey.Currency` for the top summary strip.
- **[Risk] Missing tags on non-tax transactions**: Only transactions whose destination is a tax category should be audited for missing tax tags.
  - **Mitigation**: Scrutinize only transactions whose destination matches the identified tax category ID for that currency.
- **[Risk] Client cache staleness after tag updates**: Updating transaction tags must reflect in both the audit list and the tax tag totals immediately.
  - **Mitigation**: On successful update, update local component state optimistically and invalidate client cache keys starting with `tx:` and `stat:`.
