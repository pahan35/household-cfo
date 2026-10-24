# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display, for the selected reporting period, per-category spent amount against the category budget limit, obtained through the proxy's stats endpoint using the documented `data` selection payload, with the reporting currency taken from the stats response. The summary SHALL strictly include only expense categories (`CategoryType.Expense`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories. Categories at or above their limit SHALL be visually flagged as overruns. By default, budget categories SHALL be sorted ascending by ExternalProvider's `category.order` (with an option to sort by percentage spent), and users SHALL be able to drag-and-drop reorder categories in custom-order mode, persisting the updated `order` values upstream via `/Exchange/Ping`. Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand. Each category row SHALL display the timestamp of its most recent transaction with an interactive hover/focus indicator revealing the transaction's source/target account, amount, comment, and tags. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts in the reporting currency, marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

#### Scenario: Reordering budget categories persists upstream to ExternalProvider

- **WHEN** the user drags a budget category row to a new position while in custom order mode
- **THEN** the UI immediately updates the category order and persists the updated category entities with recalculated `order` values to `/api/external-provider/Exchange/Ping`

#### Scenario: Archived `_` prefixed budget categories toggle

- **WHEN** a category's name starts with `_`
- **THEN** it is hidden by default when inactive (or controllable via the "Show archived" toggle) and revealed when the user enables the archived view

#### Scenario: Viewing last transaction details on a budget category

- **WHEN** a budget category has at least one recorded transaction and the user views the category row or hovers/focuses its last-transaction indicator
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), formatted amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card
