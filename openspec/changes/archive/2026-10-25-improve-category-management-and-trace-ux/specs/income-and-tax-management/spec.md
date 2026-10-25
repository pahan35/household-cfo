# Spec Delta

## MODIFIED Requirements

### Requirement: Income source listing and metrics

The system SHALL list all non-deleted ExternalProvider income sources (`CategoryType.Income`) with their current period received amount, budgeted target (`limitAmount`), assigned currency, and last transaction summary (date, counterpart, amount). Active income sources SHALL be displayed in ascending `category.order` sequence. The Income & Taxes screen (`/dashboard/family-budget/income`) SHALL also provide an action to open the shared Category Normalization Assistant pre-selected to the `Income` tab so users can normalize and audit income source names alongside their ordering.

#### Scenario: Viewing active income sources
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** all non-archived income sources are displayed with their period earnings, budgeted limits, and last transaction summary in ascending order sequence

#### Scenario: Missing budget target fallback
- **WHEN** an income source does not specify a `limitAmount` or specifies zero
- **THEN** the income source row displays the actual earnings without an overrun/adherence warning and indicates no target set

#### Scenario: Opening Category Normalization Assistant from Income & Taxes
- **WHEN** the user clicks "Normalize Categories" on the Income & Taxes screen
- **THEN** the Category Normalization Assistant dialog opens with the `Income` tab active by default, displaying only `CategoryType.Income` sources and their proposed normalization changes
