# Proposal

## Why

ExternalProvider categories (accounts, expenses, income sources) carry an `icon` identifier representing one of 80 built-in icons (e.g. `bank`, `savings`, `salary`, `groceries`, `debt`). Currently, the family budget screens ignore this `icon` property—rendering hardcoded generic icons solely based on `categoryType` (e.g., all bank accounts look identical as `Landmark`, all income sources look identical as `Banknote`, and creating debt accounts hardcodes `icon: "debt"` with no selection UI). Integrating full ExternalProvider icon support brings visual fidelity, instant scannability to financial feeds, and customizable icon selection when managing or creating accounts.

## What Changes

- **80-Icon Taxonomy & Lucide Mapping**: Define a type-safe catalog of ExternalProvider's 80 built-in icon identifiers mapped to Lucide vector icons with semantic search metadata (labels, category groupings, and keywords).
- **`<ExternalProviderIcon />` Component**: Create a shared icon renderer that resolves any ExternalProvider `icon` string, with graceful fallback to the entity's `categoryType` default (and ultimately a generic credit card/wallet icon) for missing or unknown icon names. Supports standard Tailwind sizing and color tokens.
- **`<ExternalProviderIconPicker />` Component**: Create an accessible, searchable icon picker popover/command dialog with category tabs (Finance, Living, Food, Transport, Tech, Lifestyle, Health, Work) and quick search filtering.
- **Accounts & Liquidity Integration**: Update `AccountsCard` to render each account's assigned ExternalProvider icon (e.g. PiggyBank for `savings`, CreditCard for `card`/`credit`, Coins for `emoney`, House for mortgages).
- **Income Sources Integration**: Update `IncomeSourcesCard` to render category icons (e.g. BadgeDollarSign for `salary`, TrendingUp for `investments`, Gift for `bonus`, Briefcase for `business`).
- **Recent Transactions Integration**: Add subtle category icon badges beside transaction line items in `RecentTransactionsCard` for rapid visual recognition of transaction context.
- **Debt Account Initialization Integration**: Integrate `ExternalProviderIconPicker` into `DebtAccountInitDialog` allowing users to select an icon when initializing a new debt/clearing account (defaulting to `debt` / Scale, but allowing `card`, `bank`, `house`, etc.).

## Capabilities

### New Capabilities
- `external-provider-icons`: Complete iconography system for ExternalProvider entities, including the 80-icon Lucide mapping registry, `<ExternalProviderIcon>` rendering component with category-type fallbacks, searchable `<ExternalProviderIconPicker>` component, and dashboard screen integrations across accounts, income sources, transactions, and account creation dialogs.

### Modified Capabilities
*(None - existing requirements remain compatible and are visually enriched.)*

## Impact

- **Affected Code**:
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-icons.tsx` (new)
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-icon-picker.tsx` (new)
  - `src/app/(main)/dashboard/family-budget/_components/accounts-card.tsx` (updated icon rendering)
  - `src/app/(main)/dashboard/family-budget/_components/income-sources-card.tsx` (updated icon rendering)
  - `src/app/(main)/dashboard/family-budget/_components/recent-transactions-card.tsx` (updated transaction row badge)
  - `src/app/(main)/dashboard/family-budget/_components/debt-account-init-dialog.tsx` (added icon picker)
  - `src/app/(main)/dashboard/family-budget/_components/__tests__/external-provider-icons.test.ts` (new unit tests)
- **Dependencies**: Uses existing `lucide-react` (all 80 icons already verified installed) and existing shadcn primitives (`Popover`, `Command`, `Button`). No new external packages required.
- **API / Upstream**: Reads existing `category.icon` string from `/Exchange/Ping` (`ExchangeKey.Category`); persists user-chosen icon string on account creation.
