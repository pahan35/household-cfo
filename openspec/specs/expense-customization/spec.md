# expense-customization Specification

## Purpose

Enables client-side category classification and reusable exclusion presets to separate fixed taxes and housing obligations from actionable living expenses, calculating net disposable income and controllable expense metrics.

## Requirements

### Requirement: Exclusion presets management

The system SHALL support creating, saving, selecting, and deleting reusable exclusion presets persisted in browser client storage (`localStorage`), where each preset defines a set of category IDs to deduct from income (e.g. taxes) and a set of category IDs to exclude from expense totals (e.g. rent).

#### Scenario: Switching active preset
- **WHEN** the user selects an exclusion preset from the preset selector
- **THEN** all dependent spending figures, pie charts, and net income metrics recalculate according to the newly selected preset rules

#### Scenario: Default out-of-the-box presets
- **WHEN** the application loads for the first time without custom saved presets
- **THEN** the system provides default selectable presets: "All Activity" (zero exclusions), "Net Living" (taxes deducted from income), and "Controllable Expenses" (taxes deducted from income and rent excluded from expenses)

#### Scenario: Persisting custom presets
- **WHEN** the user saves a custom preset with specific category exclusions and deductions
- **THEN** the preset is saved to `localStorage` and remains available across browser sessions and reloads

### Requirement: Net disposable income calculation

The system SHALL calculate and display Net Disposable Income for the active reporting period by taking total period income and subtracting amounts from categories designated as income deductions under the active preset.

#### Scenario: Calculating net income with tax deduction
- **WHEN** the active preset contains one or more tax category deductions and the period has recorded income and tax amounts
- **THEN** Net Disposable Income is displayed as Gross Income minus the sum of tax deduction category amounts

#### Scenario: Zero tax deductions configured
- **WHEN** the active preset has no category deductions assigned
- **THEN** Net Disposable Income equals Gross Income for that period

### Requirement: Controllable expenses filtering

The system SHALL calculate Controllable Expenses for the active reporting period by taking total period expenses and omitting amounts belonging to categories designated as expense exclusions or income deductions under the active preset.

#### Scenario: Rent exclusion applied
- **WHEN** the active preset excludes the Rent category and the current period includes rent expenses
- **THEN** the total expense metric and distribution reflect total expenses minus the rent expense amount, and the excluded amount is indicated
