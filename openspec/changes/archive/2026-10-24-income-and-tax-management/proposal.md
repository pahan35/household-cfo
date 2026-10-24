# Proposal: Income & Tax Management

## Why

In ExternalProvider, income sources (`categoryType: 1`) represent the top tier of cash flow, yet they are currently invisible in our app's accounts and budget interfaces. Users cannot manage their income sources, archive obsolete sources, or evaluate income stream diversification against living expenses. Furthermore, while taxes are paid from accounts to currency-specific tax categories with descriptive tags (e.g., `#pit`, `#zus`, `#health`), the app lacks visibility into tax type distribution, tax drag, and audit tools for untagged tax payments.

This change introduces first-class income source management and tax tag analysis on a dedicated "Income & Taxes" screen (`/dashboard/family-budget/income`), empowering users to plan expenses against true net income.

## What Changes

- **Income Sources Management**:
  - List and inspect all ExternalProvider `CategoryType.Income` sources with active status, current period income, and budgeted targets.
  - Drag-and-drop reordering of income sources with upstream synchronization to `/Exchange/Ping`.
  - Soft-archiving and unarchiving using the `_` name prefix convention (e.g., `_Consulting: Old Client`) with order repositioning and visibility toggles.
- **Tax Breakdown & Missing Tag Audit**:
  - Identify dedicated tax expense categories per currency.
  - Group tax outflow transactions by tags (`#pit`, `#zus`, `#vat`, `#health`, etc.) to visualize effective tax distribution and tax drag over time.
  - Audit tax transactions lacking tags and provide an inline quick-fix mechanism to assign tags and persist them via `/api/transaction/update`.
- **Income & Tax Analytics**:
  - Top metrics strip displaying Gross Inflow, Tax Deductions, Effective Tax Rate %, and Net Disposable Income.
  - Visual tax waterfall and income diversification breakdown (e.g. Salary vs Consulting vs Investments).
  - Living expense coverage ratio comparing baseline expenses with guaranteed vs variable income streams.
- **Dedicated Route & Navigation**:
  - Add "Income & Taxes" (`/dashboard/family-budget/income`) to the "Family Budget" sidebar navigation group.
  - Embedded transaction ledger filterable by income source, tax tag, or audit status.

## Capabilities

### New Capabilities
- `income-and-tax-management`: Covers income source management (ordering, soft-archiving with `_`), income stream composition and expense coverage analysis, tax breakdown by transaction tags, and missing tax tag audit with inline updates.

### Modified Capabilities
- `budget-overview`: Extends the `Family Budget screen navigation` requirement to include the "Income & Taxes" navigation item under the "Family Budget" sidebar group and support cross-navigation.

## Impact

- **UI Components**: New screen at `src/app/(main)/dashboard/family-budget/income/page.tsx` and components in `src/app/(main)/dashboard/family-budget/_components/` (income sources card, tax breakdown card, tax missing-tag audit, income metrics strip).
- **Navigation**: Update `src/navigation/sidebar/sidebar-items.ts` to include the new "Income & Taxes" route.
- **Client & Upstream API**: Reuse `/api/external-provider/Exchange/Ping` for category reorder and archive sync; use `/api/external-provider/api/transaction/update` for tagging untagged tax transactions.
- **Cache Management**: Invalidate `categories` and `tx:*` caches upon income reordering/archiving and transaction tag updates.
