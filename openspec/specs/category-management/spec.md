# Category Management

## Purpose

Provides an in-app category audit and batch renaming assistant that detects legacy naming fragmentation, suggests standardized names following the Clean Default convention, and synchronizes category updates upstream to ExternalProvider.

## Requirements

### Requirement: In-app category normalization and batch renaming assistant

The Family Budget application SHALL provide an interactive Category Normalization & Renaming Assistant dialog accessible from the Budget Overview screen (`/dashboard/family-budget/budget-overview`, defaulting to the `Expenses` tab) and the Income & Taxes screen (`/dashboard/family-budget/income`, defaulting to the `Income` tab). The dialog SHALL NOT be triggered from the Accounts & Cards card on `/dashboard/family-budget`. The dialog SHALL render in a wide layout (`sm:max-w-4xl` or wider) without truncating category names, and SHALL partition categories strictly into `Expenses` (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and `Income` (`CategoryType.Income`) tabs so normalization rules, counterpart detection, collision checks, and `order` indexing never mix across category types. The dialog SHALL support viewing the full impact across all categories of the selected type (showing current ExternalProvider `#order`, current name, tier classification, last transaction indicator, proposed rule tags, and final target name), grouping linked categories that share a canonical base name into Concept Rename Groups with explicit dependent step order, reactively recalculating collisions and broken-chain dependencies whenever a checkbox is toggled or a target name is edited, keeping unselected rows at readable high contrast with editable target inputs, and batch-persisting approved changes in topological dependency order directly upstream to ExternalProvider via `/Exchange/Ping` under `ExchangeKey.Category = 2`.

#### Scenario: Opening the normalization assistant and scanning categories
- **WHEN** the user opens the Category Normalization Assistant from `/dashboard/family-budget/budget-overview` or `/dashboard/family-budget/income`
- **THEN** the dialog opens in a wide layout (`sm:max-w-4xl` or wider) with `Expenses` and `Income` tabs (defaulting to `Expenses` on Budget Overview and `Income` on Income & Taxes), scans loaded categories belonging to the active tab's category type, identifies candidates matching normalization rules (such as trailing default currency suffixes, Cyrillic category names, or pre-2022 legacy UAH categories), and renders a full impact preview listing current `#order`, current names, proposed names, rule tags, and unchanged categories

#### Scenario: Editing proposed category renames prior to applying
- **WHEN** the user modifies a proposed category name directly in the preview table (whether the row is currently selected or unselected) or unchecks a category row
- **THEN** the system updates the pending change set to reflect the edited name, keeps unselected rows legible at high contrast with editable inputs, reactively recalculates collision and dependency status across the active category type, and excludes unchecked categories from the batch submission

#### Scenario: Batch persisting category renames upstream
- **WHEN** the user confirms and clicks "Apply Renames" in the assistant dialog with one or more checked categories
- **THEN** the system orders the modified `ExternalProviderCategory[]` entities topologically (placing base-name-vacating `+UAH` and translation renames before base-name-claiming `[Strip PLN]` renames), sends them via `POST /api/external-provider/Exchange/Ping` with `key: ExchangeKey.Category`, updates the client categories cache, displays a success toast notification with the count of renamed categories, and closes the dialog

#### Scenario: Handling collision when renaming existing categories
- **WHEN** a legacy category (e.g. pre-2022 UAH `Hotels`) and a modern default-currency category (e.g. `Hotels PLN`) both exist within the same category type
- **THEN** the assistant groups them into a linked Concept Rename Group and proposes distinct non-colliding names in dependent step order (Step 1: `Hotels -> Hotels UAH` vacating `"Hotels"`, followed by Step 2: `Hotels PLN -> Hotels` claiming `"Hotels"`) without overwriting or duplicating identifiers

#### Scenario: Scoped collision detection between Expense and Income categories
- **WHEN** an Expense category and an Income category share the same base or target name (such as `"Gifts"` in both Expense and Income)
- **THEN** the assistant evaluates counterpart detection and target name collisions strictly within each category type tab and does not report a collision between Expense `"Gifts"` and Income `"Gifts"`

#### Scenario: Reactive impact when unchecking a prerequisite step in a coupled rename group
- **WHEN** the user unchecks Step 1 (`#12 Hotels -> Hotels UAH`) while Step 2 (`#3 Hotels PLN -> Hotels`) remains checked
- **THEN** the assistant immediately flags a live collision/dependency warning on Step 2 explaining that `#12 Hotels` remains unchanged and still occupies the target name `"Hotels"`, and provides a quick action to uncheck the dependent step or re-enable the prerequisite

### Requirement: Clean default currency naming convention enforcement

The system SHALL enforce a Clean Default naming standard where categories denominated in the dashboard's default currency (PLN) are rendered and stored without a currency suffix (e.g. `Medicine`, `Hotels`), while categories denominated in non-default currencies or legacy environments retain an explicit uppercase currency suffix (e.g. `Medicine UAH`, `Hotels EUR`, `Hotels CHF`). When normalizing soft-archived categories whose names begin with `_`, the system SHALL preserve the leading `_` archive prefix (e.g. `_Diet PLN` -> `_Diet`, `_Ліки` -> `_Medicine UAH`).

#### Scenario: Detecting and stripping default currency suffixes
- **WHEN** a category's name ends with a case-insensitive match for the active default currency (e.g. `"Medicine PLN"` with default currency `"PLN"`)
- **THEN** the normalization assistant proposes stripping the suffix to yield the canonical base name (`"Medicine"`)

#### Scenario: Translating Ukrainian legacy categories to English with currency tag
- **WHEN** a category contains Ukrainian Cyrillic characters (e.g. `"Ліки"`) and has historical activity in UAH or pre-2022 creation
- **THEN** the normalization assistant proposes translating the canonical base name to English and appending the foreign currency code (`"Medicine UAH"`)

#### Scenario: Preserving leading underscore prefix on archived categories
- **WHEN** a soft-archived category starting with `_` matches a normalization rule (e.g. `"_Diet PLN"` or `"_Ліки"`)
- **THEN** the normalization assistant preserves the leading `_` prefix in the proposed target name (`"_Diet"` or `"_Medicine UAH"`) so the category remains soft-archived
