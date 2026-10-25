# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display a comprehensive Expense Categories & Budget card supporting two primary view modes: an **Active in Month** mode (showing expense categories with a non-zero spent amount or budget limit in the selected reporting period) and an **All Categories (Order & Lifecycle)** mode (showing non-deleted expense categories in ascending ExternalProvider `category.order`, including zero-spend categories such as rarely-used foreign-currency categories like `Hotels CHF`). The summary SHALL strictly include only expense categories (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories. Categories at or above their limit SHALL be visually flagged as overruns. Users SHALL be able to click any category row in either mode to open the Category Expense Trace sheet for that category. In custom-order mode, users SHALL be able to drag-and-drop reorder expense categories, soft-archive an active expense category (prefixing its name with `_` and moving it to the end of the active section), unarchive an archived expense category (stripping the leading `_` and placing it immediately before the first archived expense category), move active expense categories positioned below archived categories above the first archived category or move archived categories positioned above active categories to the bottom (adapting the banner and action to whichever direction mutates fewer entities), and position foreign/legacy currency expense categories (`UAH`, `CHF`, `EUR`, etc.) immediately above the archived section—persisting all `name` and `order` updates upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand via a "Show archived" toggle without leaking zero-spend unarchived or soft-deleted categories into the view. Soft-deleted categories (`category.deleted === true`) SHALL be hidden by default in both view modes, toggleable via a dedicated "Show removed" toggle, rendered with distinct removed badging and styling, editable via row actions, and ordered below archived categories. Each category row SHALL display its ExternalProvider `#order` index and the timestamp of its most recent transaction (resolving targeted transactions when outside the initial 300-transaction window) with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each active expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency, marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

#### Scenario: Viewing all expense categories regardless of monthly activity

- **WHEN** the user switches the Budget Spent vs Limit card to the "All Categories" view mode
- **THEN** all non-deleted expense categories (including categories with zero spend and zero limit in the selected month, such as `Hotels CHF`) are listed in ascending ExternalProvider `order` with their `#order` badge, currency/tier badge, and last transaction summary, and clicking any row opens the Category Expense Trace sheet

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags an expense category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archiving and unarchiving an expense category

- **WHEN** the user archives an active expense category or unarchives a `_`-prefixed expense category from its row action menu
- **THEN** archiving prefixes the category name with `_` and moves it to the end of the active expense category order list, unarchiving strips the `_` prefix and moves it immediately before the first archived expense category, and the modified entities are persisted upstream via `/Exchange/Ping`

#### Scenario: Moving active expense categories above archived categories and organizing foreign-currency tier

- **WHEN** active categories are positioned below archived categories and the count of active categories below archived is less than or equal to the count of archived categories above active (or the user triggers the action to group foreign/legacy currency categories right above archived)
- **THEN** the card surfaces a warning banner with action "Move above archived" that repositions misplaced active categories immediately above the first archived category (with foreign-currency categories placed immediately above archived when requested) and persists updated `order` values via `/Exchange/Ping`

#### Scenario: Adaptive banner and action when archived categories are positioned above active categories

- **WHEN** archived categories are positioned above active categories and the count of archived categories above active is strictly less than the count of active categories positioned below them (such as 4 archived categories sitting above 91 active categories)
- **THEN** the card surfaces a warning banner stating that archived categories are positioned above active categories with an action "Move archived to bottom" (and a row action "Move to bottom" on individual archived categories), which moves the archived categories to after the last active category, assigns sequential orders starting after the maximum active category order, and mutates only the archived categories without renumbering or mutating the active categories

#### Scenario: Isolated archived toggle without leaking inactive or removed categories

- **WHEN** the user toggles "Show archived" on
- **THEN** only inactive categories whose names begin with `_` are revealed, and unarchived zero-spend categories and soft-deleted categories are strictly excluded from the active list

#### Scenario: Dedicated removed categories toggle and bottom ordering

- **WHEN** the user toggles "Show removed" on
- **THEN** soft-deleted categories (`category.deleted === true`) are revealed with a distinct "Removed" badge and muted styling, positioned at the very bottom of the directory (below archived categories), and offer row actions to inspect transactions, rename, or adjust order

#### Scenario: Targeted resolution of last transaction timestamp outside initial window

- **WHEN** a visible category has historical transactions in ExternalProvider but has no transaction in the initial 300-transaction window
- **THEN** the dashboard performs a targeted query to `/api/transaction/get` filtered by category ID to resolve and display its most recent transaction timestamp and counterpart details

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), formatted amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card
