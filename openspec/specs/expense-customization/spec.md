# expense-customization Specification

## Purpose

Enables client-side category classification and reusable exclusion presets to separate fixed taxes and housing obligations from actionable living expenses, calculating net disposable income and controllable expense metrics.

## Requirements

### Requirement: Exclusion presets management

The system SHALL support creating, saving, selecting, renaming, and deleting reusable exclusion presets persisted in browser client storage (`localStorage`), where each preset defines a set of category IDs to deduct from income (e.g. taxes) and a set of category IDs to exclude from expense totals (e.g. rent, insurance, tuition). User customizations to any preset (including built-in presets such as "Controllable Expenses") SHALL be persisted to `localStorage` and restored on page reloads without being filtered out or discarded. The system SHALL provide an interactive Preset Configuration Dialog allowing users to inspect all active expense categories, toggle category exclusions via checkboxes, and save changes. The dialog SHALL filter out account types (`Account`, `BankAccount`, `DebtAccount`), income sources (`Income`), and savings goals (`Goal`, `ClassicGoal`), presenting only legitimate expense categories. Inactive archived categories (names beginning with `_` with zero spending and zero limit for the period) SHALL be hidden by default with a user toggle to reveal them. Whenever the dialog opens, it SHALL synchronize its draft exclusion state with the active preset.

#### Scenario: Switching active preset
- **WHEN** the user selects an exclusion preset from the preset selector
- **THEN** all dependent spending figures, pie charts, and net income metrics recalculate according to the newly selected preset rules

#### Scenario: Default out-of-the-box presets
- **WHEN** the application loads for the first time without custom saved presets
- **THEN** the system provides default selectable presets: "All Activity" (zero exclusions), "Net Living" (taxes deducted from income), and "Controllable Expenses" (taxes deducted from income and rent/housing excluded from expenses)

#### Scenario: Persisting custom presets
- **WHEN** the user saves changes to category exclusions for any preset (including custom presets or built-in presets such as "Controllable Expenses") and hard-refreshes the page
- **THEN** the preset is saved to `localStorage`, is not discarded by built-in filters, and remains available with its configured category exclusions across browser sessions and reloads

#### Scenario: Interactive preset configuration dialog
- **WHEN** the user opens the Preset Configuration Dialog and checks or unchecks category exclusions
- **THEN** the dialog displays the updated count of excluded categories and total excluded amount, synchronizes draft selections when opened, presents only valid expense categories (excluding accounts, income, and goals), hides inactive archived categories by default behind a toggle, and saving commits the exact category IDs to the active preset in `localStorage`

### Requirement: Net disposable income calculation

The system SHALL calculate and display Net Disposable Income for the active reporting period by taking total period income and subtracting amounts from categories designated as income deductions under the active preset.

#### Scenario: Calculating net income with tax deduction
- **WHEN** the active preset contains one or more tax category deductions and the period has recorded income and tax amounts
- **THEN** Net Disposable Income is displayed as Gross Income minus the sum of tax deduction category amounts

#### Scenario: Zero tax deductions configured
- **WHEN** the active preset has no category deductions assigned
- **THEN** Net Disposable Income equals Gross Income for that period

### Requirement: Controllable expenses filtering

The system SHALL calculate Controllable Expenses for the active reporting period by taking total period expenses and omitting amounts belonging to categories designated as expense exclusions (such as Rent and Insurance) or income deductions under the active preset. All category exclusions SHALL be governed exclusively by the active preset without standalone in-memory quick toggle overrides.

#### Scenario: Rent exclusion applied
- **WHEN** the active preset excludes the Rent category and the current period includes rent expenses
- **THEN** the total expense metric and distribution reflect total expenses minus the rent expense amount, and the excluded amount is indicated without requiring a separate quick toggle

#### Scenario: Multi-category exclusions applied
- **WHEN** the active preset excludes multiple categories (e.g. Rent, Insurance PLN, Tuition) and the current period includes expenses in those categories
- **THEN** the total controllable expense metric and distribution reflect total expenses minus the sum of all excluded category amounts, and the combined excluded amount is surfaced as fixed obligations
