# Spec Delta

## Purpose

Provides a unified iconography and icon selection capability for ExternalProvider entities across the dashboard, mapping ExternalProvider's 80 icon identifiers to Lucide icons with fallback mechanisms and a searchable picker.

## ADDED Requirements

### Requirement: ExternalProvider 80-Icon Catalog & Semantic Mapping
The system SHALL maintain a complete, type-safe registry mapping all 80 native ExternalProvider icon identifiers to vector icons, enriched with human-readable display labels, category groupings (Finance, Food & Drink, Transport, Home & Living, Tech & Gadgets, Lifestyle, Health & Family, Work & Admin), and searchable keywords.

#### Scenario: Exact icon lookup succeeds
- **WHEN** an application component requests an icon by its valid ExternalProvider key (e.g., `"savings"`, `"groceries"`, `"salary"`, `"airplane"`)
- **THEN** the system resolves and returns the corresponding Lucide vector icon component

#### Scenario: Search metadata indexing
- **WHEN** a user or search filter queries keywords such as `"fly"`, `"food"`, `"cash"`, or `"crypto"`
- **THEN** the system matches and returns the relevant icons (e.g. `"airplane"`, `"groceries"`, `"cash"`, `"emoney"`) based on their configured metadata

### Requirement: Dynamic Category Icon Rendering with Fallbacks
The system SHALL provide a shared icon component (`ExternalProviderIcon`) that renders the icon corresponding to a category's `icon` attribute. If the `icon` attribute is `null`, `undefined`, empty, or does not exist in the registry, the component SHALL fall back to a sensible default based on the entity's `categoryType` (e.g., `CategoryType.BankAccount` -> `Landmark`, `CategoryType.Account` -> `Wallet`, `CategoryType.DebtAccount` -> `Scale`, `CategoryType.Income` -> `Banknote`, `CategoryType.Expense` -> `Receipt`), and fall back to `CreditCard` if `categoryType` is absent.

#### Scenario: Category specifies valid icon
- **WHEN** an account category has `icon: "savings"` and `categoryType: 7` (Bank Account)
- **THEN** the system renders the `PiggyBank` icon rather than the generic bank `Landmark` icon

#### Scenario: Category omits icon
- **WHEN** an account category has `icon: null` or `icon: ""` and `categoryType: 2` (Cash / Wallet)
- **THEN** the system falls back to rendering the `Wallet` icon

#### Scenario: Category specifies unrecognized icon string
- **WHEN** a category has an unknown icon string (e.g. `"custom_future_icon"`) and `categoryType: 5` (Debt Account)
- **THEN** the system gracefully falls back to rendering the `Scale` icon without throwing errors

### Requirement: Searchable Icon Selection Interface
The system SHALL provide an interactive icon picker component (`ExternalProviderIconPicker`) supporting controlled form usage (`value` and `onChange`). The picker SHALL render an accessible popover containing a search input, category filtering tabs or sections, and a visual grid of icons.

#### Scenario: Search filtering in icon picker
- **WHEN** the user opens the icon picker and types `"car"` into the search input
- **THEN** the grid displays matching icons such as `"car"` and `"transport"`

#### Scenario: Selecting an icon updates state
- **WHEN** the user clicks an icon in the picker grid
- **THEN** the picker triggers `onChange` with the selected icon identifier and closes the popover

### Requirement: Accounts and Cards Dashboard Iconography
The Accounts & Cards card (`accounts-card.tsx`) SHALL render each account's specific ExternalProvider icon via `ExternalProviderIcon` in its row avatar.

#### Scenario: Distinct account icons displayed
- **WHEN** the Accounts & Cards card renders multiple accounts (e.g. a bank account with `icon: "card"`, cash account with `icon: "cash"`, and savings account with `icon: "savings"`)
- **THEN** each row displays its distinct icon rather than a uniform icon

### Requirement: Income Sources Dashboard Iconography
The Income Sources card (`income-sources-card.tsx`) SHALL render each income source's specific ExternalProvider icon via `ExternalProviderIcon` in place of the static banknote icon.

#### Scenario: Income source displays specific icon
- **WHEN** an income source category has `icon: "salary"`
- **THEN** the row displays the `salary` icon badge (`BadgeDollarSign`)

### Requirement: Recent Transactions Feed Iconography
The Recent Transactions card (`recent-transactions-card.tsx`) SHALL display a category icon badge alongside transaction entries based on the transaction's destination or source category.

#### Scenario: Transaction row shows category icon
- **WHEN** a transaction is linked to an expense category with `icon: "coffee"`
- **THEN** the transaction item displays the `coffee` icon badge

### Requirement: Debt Account Initialization Icon Selection
The Debt Account Initialization dialog (`debt-account-init-dialog.tsx`) SHALL include `ExternalProviderIconPicker`, allowing the user to select an icon for the new debt account, defaulting to `"debt"`.

#### Scenario: User chooses custom icon for new debt account
- **WHEN** the user initializes a new debt account and selects `icon: "house"` (e.g. for a mortgage or property-related loan)
- **THEN** the resulting category entity payload sent to the backend includes `icon: "house"`
