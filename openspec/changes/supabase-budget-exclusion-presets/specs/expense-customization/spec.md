# Spec Delta: expense-customization

## MODIFIED Requirements

### Requirement: Exclusion presets management
The system SHALL support creating, saving, selecting, renaming, and deleting reusable exclusion presets persisted in a shared Supabase PostgreSQL table (`budget_exclusion_presets`) for authenticated family users, with graceful client-side fallback/caching in browser `localStorage`. Each preset defines a set of category IDs to deduct from income (e.g. taxes) and a set of category IDs to exclude from expense totals (e.g. rent, insurance, tuition). User customizations to any preset (including built-in presets such as "Controllable Expenses") SHALL be persisted to Supabase and restored across all family devices without being filtered out or discarded. The system SHALL provide an interactive Preset Configuration Dialog allowing users to inspect all active expense categories, toggle category exclusions via checkboxes, and save changes. The dialog SHALL filter out account types (`Account`, `BankAccount`, `DebtAccount`), income sources (`Income`), and savings goals (`Goal`, `ClassicGoal`), presenting only legitimate expense categories. Inactive archived categories (names beginning with `_` with zero spending and zero limit for the period) SHALL be hidden by default with a user toggle to reveal them. Whenever the dialog opens, it SHALL synchronize its draft exclusion state with the active preset.

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

#### Scenario: Restoring custom presets from Supabase across devices
- **WHEN** an authenticated user opens the family budget dashboard on mobile or a secondary device
- **THEN** the dashboard loads the household's custom exclusion presets and active preset selection from Supabase, ensuring identical metric calculations across all devices

#### Scenario: Offline and unauthenticated localStorage fallback
- **WHEN** a user opens the dashboard without network connectivity
- **THEN** presets are loaded from browser `localStorage` and changes are held locally until connectivity is restored
