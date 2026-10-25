# Spec Delta

## MODIFIED Requirements

### Requirement: Exclusion presets management

The system SHALL support creating, saving, selecting, and deleting reusable exclusion presets persisted in browser client storage (`localStorage`), where each preset defines a set of category IDs to deduct from income (e.g. taxes) and a set of category IDs to exclude from expense totals (e.g. rent, insurance). The system SHALL provide an interactive Preset Configuration Dialog allowing users to inspect all active expense categories, toggle category inclusion/exclusion explicitly via checkboxes, and save changes without relying on hardcoded name pattern matching.

#### Scenario: Switching active preset
- **WHEN** the user selects an exclusion preset from the preset selector
- **THEN** all dependent spending figures, pie charts, and net income metrics recalculate according to the newly selected preset rules

#### Scenario: Default out-of-the-box presets
- **WHEN** the application loads for the first time without custom saved presets
- **THEN** the system provides default selectable presets: "All Activity" (zero exclusions), "Net Living" (taxes deducted from income), and "Controllable Expenses" (taxes deducted from income and rent/insurance excluded from expenses)

#### Scenario: Persisting custom presets
- **WHEN** the user saves a custom preset with specific category exclusions and deductions
- **THEN** the preset is saved to `localStorage` and remains available across browser sessions and reloads

#### Scenario: Interactive preset configuration dialog
- **WHEN** the user opens the Preset Configuration Dialog and checks or unchecks category exclusions
- **THEN** the dialog displays the updated count of excluded categories and total excluded amount, and saving commits the exact category IDs to the active preset in `localStorage`

### Requirement: Controllable expenses filtering

The system SHALL calculate Controllable Expenses for the active reporting period by taking total period expenses and omitting amounts belonging to categories designated as expense exclusions (such as Rent and Insurance) or income deductions under the active preset.

#### Scenario: Rent exclusion applied
- **WHEN** the active preset excludes the Rent category and the current period includes rent expenses
- **THEN** the total expense metric and distribution reflect total expenses minus the rent expense amount, and the excluded amount is indicated

#### Scenario: Multi-category exclusions applied
- **WHEN** the active preset excludes multiple categories (e.g. Rent and Insurance PLN) and the current period includes expenses in those categories
- **THEN** the total controllable expense metric and distribution reflect total expenses minus the sum of all excluded category amounts, and the combined excluded amount is surfaced as fixed obligations
