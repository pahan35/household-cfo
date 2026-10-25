# Spec Delta

## ADDED Requirements

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
