# Category Management

## Purpose

Provides an in-app category audit and batch renaming assistant that detects legacy naming fragmentation, suggests standardized names following the Clean Default convention, and synchronizes category updates upstream to ExternalProvider.

## Requirements

### Requirement: In-app category normalization and batch renaming assistant

The Family Budget application SHALL provide an interactive Category Normalization & Renaming Assistant dialog accessible from the dashboard interface. The dialog SHALL scan all available ExternalProvider categories, analyze their names against normalization rules, present proposed renames in an editable review table, and allow users to batch-persist approved changes directly upstream to ExternalProvider via `/Exchange/Ping` under `ExchangeKey.Category = 2`.

#### Scenario: Opening the normalization assistant and scanning categories
- **WHEN** the user opens the Category Normalization Assistant from the Family Budget interface
- **THEN** the system scans loaded categories, identifies candidates matching normalization rules (such as trailing default currency suffixes, Cyrillic category names, or pre-2022 legacy UAH categories), and renders a preview table listing current names, proposed names, and rule tags

#### Scenario: Editing proposed category renames prior to applying
- **WHEN** the user modifies a proposed category name directly in the preview table or unchecks a category row
- **THEN** the system updates the pending change set to reflect the edited name and excludes unchecked categories from the batch submission

#### Scenario: Batch persisting category renames upstream
- **WHEN** the user confirms and clicks "Apply Renames" in the assistant dialog with one or more checked categories
- **THEN** the system sends the modified `ExternalProviderCategory[]` entities via `POST /api/external-provider/Exchange/Ping` with `key: ExchangeKey.Category`, updates the client categories cache, displays a success toast notification with the count of renamed categories, and closes the dialog

#### Scenario: Handling collision when renaming existing categories
- **WHEN** a legacy category (e.g. pre-2022 UAH `Hotels`) and a modern default-currency category (e.g. `Hotels PLN`) both exist
- **THEN** the assistant proposes distinct non-colliding names (e.g. `Hotels UAH` for the legacy category and `Hotels` for the modern category) without overwriting or duplicating identifiers

### Requirement: Clean default currency naming convention enforcement

The system SHALL enforce a Clean Default naming standard where categories denominated in the dashboard's default currency (PLN) are rendered and stored without a currency suffix (e.g. `Medicine`, `Hotels`), while categories denominated in non-default currencies or legacy environments retain an explicit uppercase currency suffix (e.g. `Medicine UAH`, `Hotels EUR`).

#### Scenario: Detecting and stripping default currency suffixes
- **WHEN** a category's name ends with a case-insensitive match for the active default currency (e.g. `"Medicine PLN"` with default currency `"PLN"`)
- **THEN** the normalization assistant proposes stripping the suffix to yield the canonical base name (`"Medicine"`)

#### Scenario: Translating Ukrainian legacy categories to English with currency tag
- **WHEN** a category contains Ukrainian Cyrillic characters (e.g. `"Ліки"`) and has historical activity in UAH or pre-2022 creation
- **THEN** the normalization assistant proposes translating the canonical base name to English and appending the foreign currency code (`"Medicine UAH"`)
