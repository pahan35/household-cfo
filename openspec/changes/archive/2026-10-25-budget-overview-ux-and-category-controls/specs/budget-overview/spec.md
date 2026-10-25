# Spec Delta

## MODIFIED Requirements

### Requirement: Budget spent-versus-limit summary

The Budget Overview screen SHALL display a comprehensive Expense Categories & Budget card supporting three primary view modes: an **Active in Month** mode (showing expense categories with a non-zero spent amount or budget limit in the selected reporting period), a **Zero Spend** mode (supporting multi-period dormancy analysis), and an **All Categories (Order & Lifecycle)** mode (showing non-deleted expense categories in ascending ExternalProvider `category.order`, including zero-spend categories such as rarely-used foreign-currency categories like `Hotels CHF`). The summary SHALL strictly include only expense categories (`CategoryType.Expense`, `Goal`, `ClassicGoal`) and SHALL exclude all income sources (`CategoryType.Income`) and account categories.

When the Zero Spend view mode is selected, the card SHALL provide a lookback scope selector allowing users to inspect zero-spend categories across `Current Month`, `Last 3 Months`, `Last 6 Months`, `Last 12 Months`, and `All-Time / Lifetime` (0 lifetime transactions). Truly dormant categories identified across the selected lookback scope SHALL be badged and offer direct lifecycle actions (such as archiving).

Every category row across all view modes SHALL display an interactive "Last active:" indicator reflecting the date or relative time of its most recent transaction, with a hover popover revealing transaction details (counterpart account, native and converted amount, comment, and tags).

Budget progress lines and spent-versus-limit metrics SHALL be computed in matching currencies to prevent skewed progress ratios. When an individual category has a budget limit defined in a native foreign currency, the progress ratio and overrun detection SHALL be computed in that category's native currency (or normalized consistently before computing the percentage), and the row SHALL display that native currency for limit and spend, with converted reporting currency equivalents available on hover. When smart category groups are displayed, the parent group SHALL display spending and limits normalized in the primary reporting currency (defaulting to PLN), while individual child categories SHALL display their original native currencies with reporting currency conversions. The progress bar SHALL reflect the true percentage without cross-currency mismatch or double currency conversions.

The card header SHALL provide a consolidated `Organize Categories...` action replacing scattered standalone reorder buttons. Clicking this action SHALL open an interactive Category Organization modal that lets users preview:
1. **Smart Activity Order** (time-decayed activity scores across 90-day, 180-day, or all-time lookbacks).
2. **Currency & Lifecycle Tier Cleanup** (grouping primary default-currency categories first, foreign-currency categories second, archived categories third, and soft-deleted categories last).
The modal SHALL display an interactive before/after diff table stating exactly how many categories will move, their current rank vs. projected rank, rank delta (+/-), and explanation, requiring explicit user confirmation before persisting updated sequential orders to `/api/external-provider/Exchange/Ping`. In custom-order mode, users SHALL also retain direct drag-and-drop row reordering.

Categories whose name starts with `_` SHALL be hidden by default when inactive and toggleable on demand via a "Show archived" toggle without leaking zero-spend unarchived or soft-deleted categories into the view. Soft-deleted categories (`category.deleted === true`) SHALL be hidden by default in all view modes, toggleable via a dedicated "Show removed" toggle, rendered with distinct removed badging and styling, editable via row actions, and ordered below archived categories. When a comparison baseline period is active, each category row SHALL also display the spent delta (amount and percentage) relative to the baseline period.

#### Scenario: Budget statuses are visible

- **WHEN** the upstream stats response contains per-category spent (`value`) and `limitAmount` values for the selected period
- **THEN** the screen shows each active expense category in ExternalProvider `order` sequence (or `% Spent` when toggled) with spent and limit amounts, evaluates progress percentages and overrun status using matching currencies (native currency for standalone foreign categories, reporting currency for smart groups), marks categories exceeding their limit, and completely omits income sources from the spent-versus-limit list

#### Scenario: Standalone foreign-currency budget limit presentation

- **WHEN** an individual expense category has a budget limit defined exclusively in a foreign currency (such as `Sport UAH` with currencyId `UAH` or name-detected foreign currency)
- **THEN** the row displays the limit and spend in that native foreign currency (e.g. `4 500,00 ₴ / 5 000,00 ₴`), calculates progress percentage natively (`90%`), and hovering over the amount reveals a tooltip with the converted reporting currency equivalent (e.g. `~439,02 zł / ~487,80 zł`)

#### Scenario: Smart category group multi-currency display

- **WHEN** a smart category group unites child categories across different currencies (such as `Sport PLN` and `Sport UAH`)
- **THEN** the parent group row displays total spending and limits normalized in the dashboard's primary reporting currency (PLN) with progress computed from normalized totals, and the category breakdown reveals each child category rendered in its respective native currency with converted equivalents

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
- **THEN** the organization modal surfaces the option to reposition misplaced active categories immediately above the first archived category (with foreign-currency categories placed immediately above archived when requested) and persists updated `order` values via `/Exchange/Ping` upon confirmation

#### Scenario: Adaptive banner and action when archived categories are positioned above active categories

- **WHEN** archived categories are positioned above active categories and the count of archived categories above active is strictly less than the count of active categories positioned below them (such as 4 archived categories sitting above 91 active categories)
- **THEN** the card surfaces an organization alert or action stating that archived categories are positioned above active categories with an action to move archived to bottom (and a row action "Move to bottom" on individual archived categories), which moves the archived categories to after the last active category and assigns sequential orders starting after the maximum active category order upon confirmation

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
- **THEN** the row shows the last transaction date/time and the hover popover displays the counterpart account (source or target), amount normalized to reporting currency with original native currency amount, comment (if any), and tags (if any)

#### Scenario: Period selection

- **WHEN** the user selects any available month and year using the header Month & Year Picker (via previous/next month steppers, quick Current/Previous shortcuts, or the month/year grid popover) or clicks a point in the trends chart
- **THEN** the budget summary, net income and controllable expense metrics, and expense composition pie chart refresh for that selected month without displaying a duplicate period toggle inside the Budget Summary card

#### Scenario: Zero-spend multi-period and lifetime dormancy filtering

- **WHEN** the user switches to the "Zero Spend" view mode and selects a lookback scope (such as "All-Time / Lifetime" or "Last 6 Months")
- **THEN** the card filters the categories to those with zero spend across the chosen lookback period, displays each category's last active date, and highlights dormant categories eligible for archiving or restructuring

#### Scenario: Last active indicator on every category row

- **WHEN** a category row is rendered in the Budget Spent vs Limit card
- **THEN** the row displays a "Last active:" indicator showing when the category was last used (or "No transactions" if never used), and hovering/focusing the indicator reveals the transaction details (counterpart account, amount, comment, and tags)

#### Scenario: Unified Category Organization modal with before/after diff preview

- **WHEN** the user clicks "Organize Categories..." in the card header
- **THEN** an organization modal opens showing the selected strategy (Smart Order or Tier Cleanup), displaying an exact count of affected categories and a side-by-side before/after preview with rank deltas (+/-), and updates are persisted to `/api/external-provider/Exchange/Ping` only after user confirmation
