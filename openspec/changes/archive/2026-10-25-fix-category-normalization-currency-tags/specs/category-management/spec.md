# Spec Delta

## MODIFIED Requirements

### Requirement: Clean default currency naming convention enforcement

The system SHALL enforce a Clean Default naming standard across both Expense and Income categories where categories denominated in the dashboard's default currency (PLN) are rendered and stored without a currency suffix (e.g. `Medicine`, `Hotels`, `Salary`), while categories denominated in non-default currencies or legacy environments retain an explicit uppercase currency suffix (e.g. `Medicine UAH`, `Learning EUR`, `Consulting USD`, `Hotels CHF`). When evaluating category normalization candidates, the system SHALL resolve the category's effective currency by checking `category.currencyId`, trailing currency code in the name, or transaction/creation timestamp history. When normalizing soft-archived categories whose names begin with `_`, the system SHALL preserve the leading `_` archive prefix (e.g. `_Diet PLN` -> `_Diet`, `_Ліки` -> `_Medicine UAH`, `_Навчання EUR` -> `_Learning EUR`).

#### Scenario: Detecting and stripping default currency suffixes
- **WHEN** a category's name ends with a case-insensitive match for the active default currency (e.g. `"Medicine PLN"` with default currency `"PLN"`)
- **THEN** the normalization assistant proposes stripping the suffix to yield the canonical base name (`"Medicine"`)

#### Scenario: Translating Ukrainian legacy categories to English with currency tag
- **WHEN** a category contains Ukrainian Cyrillic characters (e.g. `"Ліки"`) and has historical activity in UAH or pre-2022 creation
- **THEN** the normalization assistant proposes translating the canonical base name to English and appending the foreign currency code (`"Medicine UAH"`)

#### Scenario: Translating Ukrainian categories while preserving foreign currency suffix
- **WHEN** a category contains Ukrainian Cyrillic characters and already ends with a non-default currency suffix (such as `"Навчання EUR"` with currency EUR)
- **THEN** the normalization assistant translates the Ukrainian label to English and preserves the existing currency suffix (`"Learning EUR"`), proposing tag `[Translate UA]` without adding `[Add UAH]`

#### Scenario: Translating Ukrainian categories and adding non-default currency suffix
- **WHEN** a category contains Ukrainian Cyrillic characters without a currency suffix in its name, and its resolved currency differs from the default currency (such as `"Навчання"` with currency EUR, or `"Ліки"` with currency UAH)
- **THEN** the normalization assistant translates the canonical base name to English and appends the non-default currency code (e.g. `"Learning EUR"` with tags `[Translate UA]` and `[Add EUR]`, or `"Medicine UAH"` with tags `[Translate UA]` and `[Add UAH]`)

#### Scenario: Appending non-default currency suffix to untagged categories
- **WHEN** an active Expense or Income category has a resolved currency that does not equal the default currency (such as an expense `"Hotels"` with currency EUR, or an income `"B2B Client"` with currency USD) and does not currently have a currency suffix in its name
- **THEN** the normalization assistant proposes appending the uppercase currency suffix (e.g. `"Hotels EUR"` or `"B2B Client USD"`) with tag `[Add <CURRENCY>]` (e.g. `[Add EUR]` or `[Add USD]`)

#### Scenario: Preserving leading underscore prefix on archived categories
- **WHEN** a soft-archived category starting with `_` matches a normalization rule (e.g. `"_Diet PLN"` or `"_Ліки"`)
- **THEN** the normalization assistant preserves the leading `_` prefix in the proposed target name (`"_Diet"` or `"_Medicine UAH"`) so the category remains soft-archived
