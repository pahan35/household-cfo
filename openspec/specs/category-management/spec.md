# Category Management

## Purpose

Provides an in-app category audit and batch renaming assistant that detects legacy naming fragmentation, suggests standardized names following the Clean Default convention, and synchronizes category updates upstream to ExternalProvider.

## Requirements

### Requirement: In-app category normalization and batch renaming assistant

The Family Budget application SHALL provide an interactive Category Normalization & Renaming Assistant dialog accessible from the Budget Overview screen (`/dashboard/family-budget/budget-overview`, defaulting to the `Expenses` tab) and the Income & Taxes screen (`/dashboard/family-budget/income`, defaulting to the `Income` tab). The dialog SHALL NOT be triggered from the Accounts & Cards card on `/dashboard/family-budget`. The dialog SHALL render in a wide layout (`sm:max-w-4xl` or wider) without truncating category names, and SHALL partition categories strictly into `Expenses` (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and `Income` (`CategoryType.Income`) tabs so normalization rules, counterpart detection, collision checks, and `order` indexing never mix across category types. The dialog SHALL support viewing the full impact across categories of the selected type (showing current ExternalProvider `#order`, current name, tier classification, last transaction indicator, proposed rule tags, and final target name), grouping linked categories that share a canonical base name into Concept Rename Groups with explicit dependent step order, reactively recalculating collisions and broken-chain dependencies whenever a checkbox is toggled or a target name is edited, keeping unselected rows at readable high contrast with editable target inputs, supporting an explicit "Show removed" toggle to audit and rename soft-deleted categories (`category.deleted === true`), and batch-persisting approved changes in topological dependency order directly upstream to ExternalProvider via `/Exchange/Ping` under `ExchangeKey.Category = 2`.

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

#### Scenario: Auditing and renaming soft-deleted categories via Show Removed toggle
- **WHEN** the user toggles "Show removed" inside the normalization assistant
- **THEN** soft-deleted categories (`category.deleted === true`) are revealed with a distinct "Removed" indicator, included in rule matching, and allowed to be edited or renamed in topological batches upstream

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

### Requirement: Direct single-category and arbitrary batch renaming

The application SHALL provide direct single-category renaming accessible from the row dropdown menu of expense and income categories, as well as arbitrary in-place category renaming within the Category Renaming Assistant's full directory view. When renaming any category, the application SHALL enforce category name uniqueness strictly within the category's type scope (`Expense` vs `Income`) so identically named categories across scopes do not trigger collision blocks. The system SHALL prevent empty or whitespace-only target names, persist approved renames upstream via `/Exchange/Ping` under `ExchangeKey.Category = 2`, and immediately synchronize updated names across the client categories cache and all active category display items.

#### Scenario: Renaming an individual category from row actions
- **WHEN** the user selects "Rename category..." from the row dropdown menu of an expense or income category row
- **THEN** a rename dialog opens prefilled with the category's current name and scope indication
- **AND WHEN** the user enters a valid, non-colliding new name and confirms
- **THEN** the system persists the updated category name upstream via `/Exchange/Ping`, updates the client categories cache, and reflects the new name across budget cards and trace sheets without full page reloads

#### Scenario: Preventing duplicate name collisions within the same category scope
- **WHEN** the user attempts to rename an expense category to match an existing expense category's name
- **THEN** the system displays an inline validation error indicating that a category with that name already exists in expenses and disables the submission action

#### Scenario: Permitting matching names across different category scopes
- **WHEN** the user renames an expense category to match an existing income category's name (e.g. "Gifts")
- **THEN** the system validates the rename successfully without reporting a collision

#### Scenario: Arbitrary category renaming in the assistant full directory view
- **WHEN** the user navigates to the "All Categories" view in the Category Renaming Assistant
- **THEN** all rendered category rows (including those not triggering normalization rules) provide editable target name inputs, allowing the user to modify any category name and submit changes in the batch payload

### Requirement: Category activity auditing and orphan discovery

The system SHALL provide category activity auditing that classifies categories across all-time history into active, low-frequency ($\le 3$ lifetime transactions), and zero-transaction (orphaned) categories. The Category Renaming Assistant and Budget Summary views SHALL surface these classifications with dedicated filters. When evaluating foreign currency categories (such as `Hotels EUR` or `Hotels CHF`), if no counterpart exists in the primary default currency (`PLN`), the system SHALL classify the category as a standalone foreign category rather than an orphaned anomaly.

#### Scenario: Isolating zero-transaction categories in the assistant
- **WHEN** the user selects the "Zero / Low Activity" filter tab inside the Category Renaming Assistant
- **THEN** the view displays categories that have zero recorded lifetime transactions alongside low-frequency categories, with distinct indicators for each status
- **AND** provides a bulk action to archive (`_` prefix) selected zero-transaction categories

#### Scenario: Preserving standalone foreign currency categories in audit
- **WHEN** an audit scans an active foreign currency category (e.g. `Hotels EUR`) that has low or zero transactions in the recent window but lacks a `Hotels` or `Hotels PLN` counterpart
- **THEN** the audit marks the category as standalone foreign and excludes it from false-positive orphan warnings

#### Scenario: Filtering inactive and zero-spend categories on the budget summary card
- **WHEN** the user selects the "Zero Spend" filter pill on the Budget Spent vs Limit summary card
- **THEN** the table filters to categories that have zero recorded spending in the active reporting month, displaying their last transaction summary badge or "No transactions" indicator

### Requirement: Frequency and recency smart order optimization

The system SHALL provide a Smart Order Optimization engine that computes an activity score for each active category combining frequency and recency via an exponential half-life time-decay function ($\text{Score}(c) = \sum_{tx \in c} 2^{-\text{age}(tx)/\tau}$ with $\tau = 30$ days). The optimizer SHALL support both an all-time lookback scope for baseline sequencing and rolling scopes (90 and 180 days) for periodic calibration. The optimization SHALL preserve architectural tiers (ranking active default-currency categories first, active foreign-currency categories second, soft-archived `_` categories third, and soft-deleted categories last). The system SHALL present an interactive preview dialog displaying current rank, proposed rank, rank delta, transaction count, and last active date before persisting the reordered sequence upstream via `/Exchange/Ping`.

#### Scenario: Previewing smart order re-ranking with rank deltas
- **WHEN** the user opens the Smart Order Optimizer from the Budget Spent vs Limit toolbar
- **THEN** the optimizer displays a preview table showing each active category's current rank, suggested rank, rank delta pill (e.g. `+5` or `-3`), transaction count, last active date, and time-decayed score for the selected lookback window

#### Scenario: Recalibrating order between all-time and rolling lookback scopes
- **WHEN** the user toggles the lookback scope between "All-Time", "180 Days", and "90 Days"
- **THEN** the optimizer recalculates activity scores and preview rankings in real time according to transactions within the selected window

#### Scenario: Enforcing frequency order across regular monthly expenses
- **WHEN** regular monthly expenses (such as monthly rent with 1 tx/month) are ranked alongside high-frequency daily expenses (groceries) and rare irregular expenses (annual trips)
- **THEN** monthly expenses naturally rank below daily/weekly frequent expenses but above rare irregular expenses based on their decayed transaction count

#### Scenario: Preserving currency tiers and archived status during smart order application
- **WHEN** the user confirms and applies smart order optimization
- **THEN** active default-currency categories receive top sequential `#order` positions, active foreign categories follow in their own optimized sequence, soft-archived categories (`_`) remain positioned below active tiers, and soft-deleted categories remain at the bottom, before sending the updated category sequence upstream
